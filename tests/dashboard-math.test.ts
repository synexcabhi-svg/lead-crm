import { describe, it, expect } from "vitest";
import { conversionRate, openCount } from "@/domain/dashboard/dashboard.math";

describe("conversionRate", () => {
  it("is 0 when there are no leads", () => {
    expect(conversionRate(0, 0)).toBe(0);
  });
  it("computes a one-decimal percentage", () => {
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(25, 100)).toBe(25);
    expect(conversionRate(2, 7)).toBe(28.6);
  });
  it("handles 100%", () => {
    expect(conversionRate(10, 10)).toBe(100);
  });
});

describe("openCount", () => {
  it("subtracts converted and lost from total", () => {
    expect(openCount(100, 20, 15)).toBe(65);
  });
  it("never goes negative", () => {
    expect(openCount(5, 10, 10)).toBe(0);
  });
});
