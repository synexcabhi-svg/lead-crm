import { describe, it, expect } from "vitest";
import { dealCreateSchema, convertLeadSchema, dealUpdateSchema } from "@/domain/deals/deal.schema";

describe("dealCreateSchema", () => {
  it("accepts a minimal valid deal", () => {
    const r = dealCreateSchema.safeParse({ name: "Website revamp", accountId: "acc_1" });
    expect(r.success).toBe(true);
  });
  it("requires a name and an account", () => {
    expect(dealCreateSchema.safeParse({ accountId: "acc_1" }).success).toBe(false);
    expect(dealCreateSchema.safeParse({ name: "X" }).success).toBe(false);
  });
  it("coerces amount to an integer and rejects negatives", () => {
    expect(dealCreateSchema.parse({ name: "X", accountId: "a", amount: "250000" }).amount).toBe(250000);
    expect(dealCreateSchema.safeParse({ name: "X", accountId: "a", amount: -5 }).success).toBe(false);
  });
  it("rejects a bad date format", () => {
    expect(
      dealCreateSchema.safeParse({ name: "X", accountId: "a", expectedCloseDate: "31-12-2026" }).success,
    ).toBe(false);
  });
});

describe("convertLeadSchema", () => {
  it("defaults createDeal to true", () => {
    expect(convertLeadSchema.parse({}).createDeal).toBe(true);
  });
  it("allows converting without a deal", () => {
    const r = convertLeadSchema.safeParse({ createDeal: false });
    expect(r.success).toBe(true);
  });
  it("accepts an account name or an account id", () => {
    expect(convertLeadSchema.safeParse({ accountName: "Acme" }).success).toBe(true);
    expect(convertLeadSchema.safeParse({ accountId: "acc_1" }).success).toBe(true);
  });
});

describe("dealUpdateSchema", () => {
  it("rejects an empty patch", () => {
    expect(dealUpdateSchema.safeParse({}).success).toBe(false);
  });
  it("accepts a single stage change", () => {
    expect(dealUpdateSchema.safeParse({ stageKey: "proposal" }).success).toBe(true);
  });
});
