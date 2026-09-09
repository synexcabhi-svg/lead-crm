import { describe, it, expect } from "vitest";
import { resolveAccountName, resolveDealName } from "@/domain/leads/lead.convert";

const baseLead = {
  id: "l1",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@acme.com",
  phone: "123",
  company: "Acme Corp",
  ownerId: null,
};

describe("resolveAccountName", () => {
  it("prefers an explicit account name", () => {
    expect(resolveAccountName(baseLead, { accountName: "  Custom Ltd " })).toBe("Custom Ltd");
  });
  it("falls back to the lead's company", () => {
    expect(resolveAccountName(baseLead, {})).toBe("Acme Corp");
  });
  it("falls back to the person name when there is no company", () => {
    expect(resolveAccountName({ ...baseLead, company: null }, {})).toBe("Jane Doe");
  });
  it("never returns empty", () => {
    expect(resolveAccountName({ ...baseLead, company: "  ", firstName: "", lastName: null }, {})).toBe(
      "Untitled account",
    );
  });
});

describe("resolveDealName", () => {
  it("prefers an explicit deal name", () => {
    expect(resolveDealName(baseLead, "Acme Corp", { dealName: "Big deal" })).toBe("Big deal");
  });
  it("builds '<account> - <person>' by default", () => {
    expect(resolveDealName(baseLead, "Acme Corp", {})).toBe("Acme Corp - Jane Doe");
  });
  it("handles a person with no name", () => {
    expect(resolveDealName({ ...baseLead, firstName: "", lastName: null }, "Acme Corp", {})).toBe("Acme Corp");
  });
});
