import { describe, it, expect } from "vitest";
import { matchTerritory, territoryMatches, territoryScore } from "@/domain/team/territory.match";

const rules = [
  { id: "r_country", technicalMemberId: "m_country", country: "India", sortOrder: 0 },
  { id: "r_state", technicalMemberId: "m_state", state: "Maharashtra", country: "India", sortOrder: 0 },
  { id: "r_city", technicalMemberId: "m_city", city: "Pune", state: "Maharashtra", sortOrder: 0 },
  { id: "r_other", technicalMemberId: "m_other", state: "Karnataka", sortOrder: 0 },
];

describe("territoryMatches", () => {
  it("matches when every specified field equals the location (case-insensitive)", () => {
    expect(territoryMatches({ id: "x", technicalMemberId: "m", state: "maharashtra" }, { state: "Maharashtra" })).toBe(true);
  });
  it("fails when a specified field differs", () => {
    expect(territoryMatches({ id: "x", technicalMemberId: "m", state: "Goa" }, { state: "Maharashtra" })).toBe(false);
  });
  it("an empty rule never matches", () => {
    expect(territoryMatches({ id: "x", technicalMemberId: "m" }, { state: "Maharashtra" })).toBe(false);
  });
});

describe("territoryScore", () => {
  it("city beats state beats country", () => {
    expect(territoryScore({ id: "a", technicalMemberId: "m", city: "Pune" })).toBeGreaterThan(
      territoryScore({ id: "b", technicalMemberId: "m", state: "MH" }),
    );
    expect(territoryScore({ id: "b", technicalMemberId: "m", state: "MH" })).toBeGreaterThan(
      territoryScore({ id: "c", technicalMemberId: "m", country: "India" }),
    );
  });
});

describe("matchTerritory", () => {
  it("returns null for an empty location", () => {
    expect(matchTerritory({}, rules)).toBeNull();
  });
  it("picks the most specific matching rule (city > state > country)", () => {
    expect(matchTerritory({ city: "Pune", state: "Maharashtra", country: "India" }, rules)).toBe("m_city");
  });
  it("falls back to the state rule when city does not match any rule", () => {
    expect(matchTerritory({ city: "Nagpur", state: "Maharashtra", country: "India" }, rules)).toBe("m_state");
  });
  it("falls back to the country rule when only the country matches", () => {
    expect(matchTerritory({ state: "Kerala", country: "India" }, rules)).toBe("m_country");
  });
  it("returns null when nothing matches", () => {
    expect(matchTerritory({ state: "Texas", country: "United States" }, rules)).toBeNull();
  });
  it("breaks score ties by sortOrder (lower wins)", () => {
    const tie = [
      { id: "b", technicalMemberId: "m_b", state: "Delhi", sortOrder: 5 },
      { id: "a", technicalMemberId: "m_a", state: "Delhi", sortOrder: 1 },
    ];
    expect(matchTerritory({ state: "Delhi" }, tie)).toBe("m_a");
  });
});
