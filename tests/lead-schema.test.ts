import { describe, it, expect } from "vitest";
import {
  leadPublicSchema,
  leadAdminSchema,
  leadUpdateSchema,
} from "@/domain/leads/lead.schema";

describe("leadPublicSchema", () => {
  it("accepts a valid submission with email only", () => {
    const r = leadPublicSchema.safeParse({ firstName: "Sam", email: "sam@example.com" });
    expect(r.success).toBe(true);
  });

  it("accepts phone only", () => {
    const r = leadPublicSchema.safeParse({ firstName: "Sam", phone: "+91 98765 43210" });
    expect(r.success).toBe(true);
  });

  it("rejects when neither email nor phone is present", () => {
    const r = leadPublicSchema.safeParse({ firstName: "Sam" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.email?.[0]).toMatch(/email or a phone/i);
  });

  it("rejects a malformed email", () => {
    const r = leadPublicSchema.safeParse({ firstName: "Sam", email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects a bad phone", () => {
    const r = leadPublicSchema.safeParse({ firstName: "Sam", phone: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects missing first name", () => {
    const r = leadPublicSchema.safeParse({ email: "sam@example.com" });
    expect(r.success).toBe(false);
  });

  it("lowercases the email", () => {
    const r = leadPublicSchema.parse({ firstName: "Sam", email: "SAM@Example.COM" });
    expect(r.email).toBe("sam@example.com");
  });

  it("flags a filled honeypot", () => {
    const r = leadPublicSchema.safeParse({
      firstName: "Sam",
      email: "sam@example.com",
      website: "http://spam",
    });
    expect(r.success).toBe(false);
  });
});

describe("leadAdminSchema", () => {
  it("accepts full admin payload", () => {
    const r = leadAdminSchema.safeParse({
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@example.com",
      phone: "9999999999",
      company: "Acme",
      priority: "HIGH",
      statusKey: "qualified",
      sourceKey: "referral",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown priority", () => {
    const r = leadAdminSchema.safeParse({ firstName: "Sam", email: "s@x.com", priority: "SOON" });
    expect(r.success).toBe(false);
  });

  it("rejects an over-long first name", () => {
    const r = leadAdminSchema.safeParse({ firstName: "x".repeat(81), email: "s@x.com" });
    expect(r.success).toBe(false);
  });
});

describe("leadUpdateSchema", () => {
  it("allows a single-field patch", () => {
    expect(leadUpdateSchema.safeParse({ statusKey: "contacted" }).success).toBe(true);
  });
  it("rejects an empty patch", () => {
    expect(leadUpdateSchema.safeParse({}).success).toBe(false);
  });
});
