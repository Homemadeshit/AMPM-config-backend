import { z } from "zod";
import { getPricingConfig } from "./config";

type DeliveryDays = 7 | 30 | 45 | 60;

export const PriceInputSchema = z.object({
  product_type: z.enum(["dimensioned","table_only","all_in_one"]),
  dimension: z.string().optional(),
  quantity: z.number().min(1).max(500).default(1),
  delivery_days: z.union([z.literal(7), z.literal(30), z.literal(45), z.literal(60)]),

  // built-in overrides
  base_override_eur: z.number().optional(),
  startup_discount_eur: z.number().optional(),
  first_order_discount_eur: z.number().optional(),
  delivery_surcharge_override: z.record(z.string(), z.number()).optional(),
  advance_payment: z.enum(["none","50","100"]).default("none"),
  two_pcs_line_discount_eur: z.number().optional(),

  // NEW per-quote knobs
  advance_payment_discount_eur: z.number().optional(), // override advance discount directly
  custom_unit_adjust_eur: z.number().optional(),       // +/- per unit before qty
  custom_line_adjust_eur: z.number().optional()        // +/- once after qty
});
export type PriceInput = z.infer<typeof PriceInputSchema>;

export function calculatePrice(input: PriceInput) {
  const cfg = getPricingConfig();

  // Base
  const base =
    input.base_override_eur ??
    (input.product_type === "dimensioned"
      ? (() => {
          if (!input.dimension || !(input.dimension in cfg.dimensionBaseEUR)) {
            throw new Error("Missing or invalid 'dimension'.");
          }
          return cfg.dimensionBaseEUR[input.dimension];
        })()
      : input.product_type === "table_only"
      ? cfg.base_table_only
      : cfg.base_all_in_one);

  // Per-unit adjustments
  const startup = input.startup_discount_eur ?? cfg.startup_discount_eur;
  const firstOrder = input.first_order_discount_eur ?? cfg.first_order_discount_by_type[input.product_type];

  const overrideMap = (input.delivery_surcharge_override ?? {}) as Record<string, number>;
  const delivery =
    overrideMap[String(input.delivery_days)] ??
    cfg.delivery_surcharge_eur[String(input.delivery_days) as keyof typeof cfg.delivery_surcharge_eur];

  const advance =
    input.advance_payment_discount_eur ?? cfg.advance_payment_discount_eur[input.advance_payment];

  const unit_before_qty =
    Math.max(0, base - startup - firstOrder + delivery - advance) +
    (input.custom_unit_adjust_eur ?? 0);

  // Quantity & line adjustments
  const qty = input.quantity;
  const subtotalBeforeLineAdj = unit_before_qty * qty;

  const pairs = Math.floor(qty / 2);
  const twoPcsLineDiscount =
    qty >= 2 ? (input.two_pcs_line_discount_eur ?? cfg.two_pcs_line_discount_eur) * pairs : 0;

  const total = Math.max(
    0,
    Math.round(subtotalBeforeLineAdj - twoPcsLineDiscount + (input.custom_line_adjust_eur ?? 0))
  );

  return {
    base,
    adjustments: {
      startup_discount: startup,
      first_order_discount: firstOrder,
      delivery_surcharge: delivery,
      advance_payment_discount: advance,
      two_pcs_line_discount_total: twoPcsLineDiscount,
      custom_unit_adjust_eur: input.custom_unit_adjust_eur ?? 0,
      custom_line_adjust_eur: input.custom_line_adjust_eur ?? 0
    },
    unit: Math.round(unit_before_qty),
    subtotal: Math.round(subtotalBeforeLineAdj), // subtotal BEFORE line adj (matches prior tests)
    total
  };
}
