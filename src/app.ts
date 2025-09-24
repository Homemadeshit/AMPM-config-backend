import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { PriceInputSchema, calculatePrice } from "./price";
import { reloadPricingConfig } from "./config";
import { configSignature } from "./config-signature";
import { sendInquiryEmail, InquiryData, PriceBreakdown } from "./email";

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

// Admin: hot-reload pricing config (always requires API key)
app.post("/admin/reload-config", (req: Request, res: Response) => {
  if (!keyMatches(req)) return res.status(401).json({ error: "Unauthorized" });
  const cfg = reloadPricingConfig();
  res.json({ ok: true, version: process.env.PRICING_CONFIG || "config/pricing.v1.json", dimensions: Object.keys(cfg.dimensionBaseEUR).length });
});

export default app;
