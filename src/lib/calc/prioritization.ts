/** Weighted scoring (BRD 9.3). Scores 0..10 per criterion, weights in %; result 0..100. */
export interface Criterion { id: string; weight: number }
export function weightedScore(criteria: Criterion[], scores: Record<string, number>): number {
  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  if (totalWeight === 0) return 0;
  const raw = criteria.reduce((a, c) => a + (Math.max(0, Math.min(10, scores[c.id] ?? 0)) / 10) * c.weight, 0);
  return Math.round((raw / totalWeight) * 1000) / 10;
}
/** Rank projects: an override (with mandatory justification, enforced in the API) wins over the computed score. */
export function rankProjects<T extends { id: string; score: number; override?: number | null }>(items: T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const ranked = sorted.map((p, i) => ({ ...p, rank: i + 1 }));
  const overridden = ranked.filter((p) => p.override != null);
  if (!overridden.length) return ranked;
  const rest = ranked.filter((p) => p.override == null);
  const out: (T & { rank: number })[] = [];
  const byRank = new Map(overridden.map((p) => [p.override!, p]));
  let ri = 0;
  for (let r = 1; r <= ranked.length; r++) {
    const o = byRank.get(r);
    out.push({ ...(o ?? rest[ri++]), rank: r });
  }
  return out;
}
