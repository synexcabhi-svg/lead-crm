import { describe, it, expect } from "vitest";
import {
  resolveDuplicateAction,
  matchedFields,
  normalizePhone,
} from "@/domain/leads/lead.dedupe";

const fields: Array<"email" | "phone"> = ["email", "phone"];

describe("normalizePhone", () => {
  it("strips formatting but keeps digits and +", () => {
    expect(normalizePhone("+91 (98) 765-4321")).toBe("+91987654321");
    expect(normalizePhone("098 765 4321")).toBe("0987654321");
  });
});

describe("matchedFields", () => {
  it("matches email case-insensitively", () => {
    expect(matchedFields({ email: "A@X.com" }, { email: "a@x.com" }, fields)).toEqual(["email"]);
  });
  it("matches phone ignoring formatting", () => {
    expect(matchedFields({ phone: "+91 98765 43210" }, { phone: "+919876543210" }, fields)).toEqual([
      "phone",
    ]);
  });
  it("returns [] when nothing matches", () => {
    expect(matchedFields({ email: "a@x.com" }, { email: "b@x.com" }, fields)).toEqual([]);
  });
  it("respects the configured match-field subset", () => {
    expect(matchedFields({ phone: "123456789" }, { phone: "123456789" }, ["email"])).toEqual([]);
  });
});

describe("resolveDuplicateAction", () => {
  const incoming = { email: "dup@x.com", phone: "999" };
  const existing = { id: "lead_1", email: "dup@x.com", phone: "111" };

  it("no existing lead -> plain create", () => {
    expect(resolveDuplicateAction("flag", null, incoming, fields)).toEqual({
      action: "create",
      flagDuplicate: false,
    });
  });

  it("strategy=allow -> plain create even with a match", () => {
    expect(resolveDuplicateAction("allow", existing, incoming, fields)).toEqual({
      action: "create",
      flagDuplicate: false,
    });
  });

  it("strategy=flag -> create but flag + link", () => {
    expect(resolveDuplicateAction("flag", existing, incoming, fields)).toEqual({
      action: "create",
      flagDuplicate: true,
      duplicateOfId: "lead_1",
      matchedOn: ["email"],
    });
  });

  it("strategy=reject -> reject with existing id", () => {
    expect(resolveDuplicateAction("reject", existing, incoming, fields)).toEqual({
      action: "reject",
      existingId: "lead_1",
      matchedOn: ["email"],
    });
  });

  it("strategy=update -> merge into existing", () => {
    expect(resolveDuplicateAction("update", existing, incoming, fields)).toEqual({
      action: "merge",
      existingId: "lead_1",
      matchedOn: ["email"],
    });
  });

  it("existing lead but no field actually matches -> plain create", () => {
    const noMatch = { id: "lead_2", email: "other@x.com", phone: "000" };
    expect(resolveDuplicateAction("reject", noMatch, incoming, fields)).toEqual({
      action: "create",
      flagDuplicate: false,
    });
  });
});
