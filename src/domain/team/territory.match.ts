/**
 * Pure territory-matching logic (no DB) so it can be unit-tested.
 *
 * A rule matches a lead's location when every field the rule specifies equals
 * (case-insensitively, trimmed) the lead's corresponding field. The most
 * specific matching rule wins: city (4) + state (2) + country (1). Ties are
 * broken by sortOrder (lower first), then by rule id for stability.
 */
export interface LeadLocation {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface TerritoryRule {
  id: string;
  technicalMemberId: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  sortOrder?: number;
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

/** Does this rule apply to this location? (a rule with no fields never matches) */
export function territoryMatches(rule: TerritoryRule, loc: LeadLocation): boolean {
  const parts: Array<[string | null | undefined, string | null | undefined]> = [
    [rule.city, loc.city],
    [rule.state, loc.state],
    [rule.country, loc.country],
  ];
  let specified = 0;
  for (const [ruleVal, locVal] of parts) {
    if (!norm(ruleVal)) continue;
    specified++;
    if (norm(ruleVal) !== norm(locVal)) return false;
  }
  return specified > 0;
}

export function territoryScore(rule: TerritoryRule): number {
  return (norm(rule.city) ? 4 : 0) + (norm(rule.state) ? 2 : 0) + (norm(rule.country) ? 1 : 0);
}

/** Returns the technicalMemberId of the best-matching rule, or null. */
export function matchTerritory(loc: LeadLocation, rules: TerritoryRule[]): string | null {
  if (!norm(loc.city) && !norm(loc.state) && !norm(loc.country)) return null;

  const matches = rules.filter((r) => territoryMatches(r, loc));
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const s = territoryScore(b) - territoryScore(a);
    if (s !== 0) return s;
    const o = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (o !== 0) return o;
    return a.id.localeCompare(b.id);
  });
  return matches[0].technicalMemberId;
}
