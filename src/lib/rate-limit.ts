// Fixed-window in-memory limiter. For multi-instance deployments swap for Redis (see docs/ARCHITECTURE.md).
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return true; }
  b.count++;
  return b.count <= limit;
}
