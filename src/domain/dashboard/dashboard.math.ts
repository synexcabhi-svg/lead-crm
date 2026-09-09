/** Pure dashboard calculations - no DB, unit-tested in tests/dashboard-math.test.ts */

export function conversionRate(converted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((converted / total) * 1000) / 10; // one decimal place
}

export function openCount(total: number, converted: number, lost: number): number {
  return Math.max(0, total - converted - lost);
}
