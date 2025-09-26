import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { PriceInputSchema, calculatePrice } from "./price";
import { reloadPricingConfig } from "./config";
import { configSignature } from "./config-signature";
import { PriceCalculatorService, PriceRequestSchema } from "./services/priceCalculator";
import { sendInquiryEmail, testEmailConnection, InquiryData, PriceBreakdown } from "./email";

const app = express();
app.set("trust proxy", 1); // DO/App Platform
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(",") }));

const keyMatches = (req: Request) =>
  Boolean(process.env.API_KEY) && req.header("x-api-key") === process.env.API_KEY;

const guard = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.API_KEY && !keyMatches(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
};

const priceLimiter = rateLimit({ windowMs: 60_000, max: 60 });

// Initialize Google Sheets price calculator (with error handling)
let priceCalculator: PriceCalculatorService | null = null;
try {
  priceCalculator = new PriceCalculatorService();
} catch (error) {
  console.warn('Google Sheets not configured. Price calculator will be disabled.');
  console.warn('Please set up GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY in .env file');
}

app.get("/", (_req, res) => res.json({ ok: true, service: "inox-price-api" }));

// Liveness/readiness
app.get("/healthz", (_req, res) => {
  const sig = configSignature();
  res.json({ ok: true, ...sig, time: new Date().toISOString() });
});

// Strip powerful override fields for public calls
function sanitizeOverrides(input: any, allow: boolean) {
  if (allow) return input;
  const {
    base_override_eur,
    startup_discount_eur,
    first_order_discount_eur,
    delivery_surcharge_override,
    two_pcs_line_discount_eur,
    advance_payment_discount_eur,
    custom_unit_adjust_eur,
    custom_line_adjust_eur,
    ...safe
  } = input;
  return safe;
}

// Legacy price endpoint (keep for backward compatibility)
app.post("/price", priceLimiter, (req: Request, res: Response) => {
  const parsed = PriceInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  // Only allow overrides when API key matches
  const payload = sanitizeOverrides(parsed.data, keyMatches(req));

  try {
    res.json(calculatePrice(payload));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});

// New Google Sheets price endpoint
app.post("/price/sheets", priceLimiter, async (req: Request, res: Response) => {
  if (!priceCalculator) {
    return res.status(503).json({ 
      error: "Google Sheets price calculator not available",
      details: "Please configure Google Sheets credentials in environment variables"
    });
  }

  try {
    const parsed = PriceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid payload", 
        details: parsed.error.flatten() 
      });
    }

    const result = await priceCalculator.calculatePrice(parsed.data);
    res.json(result);
  } catch (error: any) {
    console.error("Google Sheets price calculation error:", error);
    res.status(500).json({ 
      error: error.message || "Internal error",
      details: "Failed to calculate price from Google Sheets"
    });
  }
});

// Force refresh Google Sheets cache
app.post("/refresh-cache", async (_req, res) => {
  if (!priceCalculator) {
    return res.status(503).json({ 
      error: "Price calculator not available",
      details: "Please configure Google Sheets credentials"
    });
  }

  try {
    const result = await priceCalculator.forceRefreshCache();
    res.json(result);
  } catch (error: any) {
    console.error("Cache refresh error:", error);
    res.status(500).json({ 
      error: error.message || "Internal error",
      details: "Failed to refresh Google Sheets cache"
    });
  }
});

// Get available dimensions (for Big Table)
app.get("/dimensions", (_req, res) => {
  if (!priceCalculator) {
    return res.status(503).json({ 
      error: "Price calculator not available",
      details: "Please configure Google Sheets credentials"
    });
  }

  try {
    const dimensions = priceCalculator.getAvailableDimensions();
    res.json({ 
      success: true, 
      dimensions,
      count: dimensions.length 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Internal error" 
    });
  }
});

// Get available packages (for All-in-One)
app.get("/packages", (_req, res) => {
  if (!priceCalculator) {
    return res.status(503).json({ 
      error: "Price calculator not available",
      details: "Please configure Google Sheets credentials"
    });
  }

  try {
    const packages = priceCalculator.getAvailablePackages();
    res.json({ 
      success: true, 
      packages,
      count: packages.length 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Internal error" 
    });
  }
});

// Send inquiry email
app.post("/api/send-inquiry", async (req: Request, res: Response) => {
  try {
    const { inquiry, priceBreakdown } = req.body;
    
    // Validate inquiry data
    if (!inquiry || !inquiry.name || !inquiry.email) {
      return res.status(400).json({ error: "Missing required inquiry data" });
    }

    // Send email
    await sendInquiryEmail(inquiry as InquiryData, priceBreakdown as PriceBreakdown);
    
    res.json({ 
      ok: true, 
      message: "Inquiry email sent successfully",
      inquiryId: inquiry.inquiryId 
    });
  } catch (error: any) {
    console.error("Error sending inquiry email:", error);
    res.status(500).json({ 
      error: "Failed to send inquiry email", 
      details: error.message 
    });
  }
});

// Test email connection
app.get("/api/test-email", async (_req: Request, res: Response) => {
  try {
    const result = await testEmailConnection();
    if (result.success) {
      res.json({ 
        ok: true, 
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        error: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      ok: false, 
      error: "Email test failed", 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin: hot-reload pricing config (always requires API key)
app.post("/admin/reload-config", (req: Request, res: Response) => {
  if (!keyMatches(req)) return res.status(401).json({ error: "Unauthorized" });
  const cfg = reloadPricingConfig();
  res.json({ ok: true, version: process.env.PRICING_CONFIG || "config/pricing.v1.json", dimensions: Object.keys(cfg.dimensionBaseEUR).length });
});

export default app;
