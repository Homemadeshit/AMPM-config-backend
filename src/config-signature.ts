import crypto from "crypto";
import { getPricingConfig } from "./config";

export function configSignature() {
  const cfg = getPricingConfig();
  const hash = crypto.createHash("sha256").update(JSON.stringify(cfg)).digest("hex").slice(0, 8);
  return { version: process.env.PRICING_CONFIG || "config/pricing.v1.json", hash };
}
