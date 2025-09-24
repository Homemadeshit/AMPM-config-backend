import fs from "fs";
import path from "path";
import { z } from "zod";

const DeliveryDaysSchema = z.enum(["7","30","45","60"]);

export const PricingSchema = z.object({
  dimensionBaseEUR: z.record(z.string(), z.number()),
  base_table_only: z.number(),
  base_all_in_one: z.number(),
  startup_discount_eur: z.number(),
  first_order_discount_by_type: z.object({
    table_only: z.number(),
    all_in_one: z.number(),
    dimensioned: z.number()
  }),
  delivery_surcharge_eur: z.record(DeliveryDaysSchema, z.number()),
  advance_payment_discount_eur: z.object({
    none: z.number(),
    "50": z.number(),
    "100": z.number()
  }),
  two_pcs_line_discount_eur: z.number()
});

export type PricingConfig = z.infer<typeof PricingSchema>;

let cached: PricingConfig | null = null;

export function getPricingConfig(): PricingConfig {
  if (cached) return cached;

  const cfgPath = process.env.PRICING_CONFIG
    ? path.resolve(process.cwd(), process.env.PRICING_CONFIG)
    : path.resolve(process.cwd(), "config/pricing.v1.json");

  let raw = fs.readFileSync(cfgPath, "utf8"); if (raw.charCodeAt(0) === 0xFEFF) { raw = raw.slice(1); }
  const json = JSON.parse(raw);
  const parsed = PricingSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Invalid pricing config: " + JSON.stringify(parsed.error.flatten(), null, 2));
  }
  cached = parsed.data;
  return cached;
}
export function reloadPricingConfig() {
  // clear cache and re-read the JSON
  // (getPricingConfig() is already BOM-safe)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore
  cached = null as any;
  return getPricingConfig();
}
