import request from "supertest";
import app from "../src/app";
import { describe, it, expect } from "vitest";

const H = { "x-api-key": process.env.API_KEY || "devkey123" }; // ok even if API_KEY unset

describe("POST /price", () => {
  it("dimensioned 200x100, 60d, none, qty 1 → unit 1120", async () => {
    const res = await request(app).post("/price").set(H).send({
      product_type: "dimensioned",
      dimension: "200x100",
      quantity: 1,
      delivery_days: 60,
      advance_payment: "none"
    });
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe(1120);
    expect(res.body.total).toBe(1120);
  });

  it("table_only, 45d, 50% advance, qty 2 → total 785", async () => {
    const res = await request(app).post("/price").set(H).send({
      product_type: "table_only",
      quantity: 2,
      delivery_days: 45,
      advance_payment: "50"
    });
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe(405);   // 430-25-50+100-50
    expect(res.body.subtotal).toBe(810);
    expect(res.body.adjustments.two_pcs_line_discount_total).toBe(25);
    expect(res.body.total).toBe(785);
  });

  it("all_in_one, 30d, none, qty 1 → total 925", async () => {
    const res = await request(app).post("/price").set(H).send({
      product_type: "all_in_one",
      quantity: 1,
      delivery_days: 30,
      advance_payment: "none"
    });
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe(925);   // 900-25-150+200
    expect(res.body.total).toBe(925);
  });
});

describe("custom overrides", () => {
  it("supports advance override + unit & line adjustments", async () => {
    const res = await request(app).post("/price").send({
      product_type: "dimensioned",
      dimension: "200x100",
      quantity: 2,
      delivery_days: 60,
      advance_payment: "none",
      advance_payment_discount_eur: 30, // override
      custom_unit_adjust_eur: 15,       // +15 per unit
      custom_line_adjust_eur: -20       // -20 once
    });
    // Base(1170) - startup(25) - first(50) + delivery(25) - advance(30) + unitAdj(15) = 1105 per unit
    // Subtotal before line adj: 1105*2 = 2210
    // Two-pcs discount: 25 (1 pair)
    // Line adj: -20
    // Total: 2210 - 25 - 20 = 2165
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe(1105);
    expect(res.body.subtotal).toBe(2210);
    expect(res.body.total).toBe(2165);
  });
});
