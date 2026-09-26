interface Bucket {
  start: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10000;

function sweep(now: number, windowMs: number) {
  for (const [k, b] of buckets) {
    if (now - b.start >= windowMs) buckets.delete(k);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs || now < b.start) {
    if (buckets.size >= MAX_KEYS) sweep(now, windowMs);
    if (buckets.size >= MAX_KEYS) return false;
    buckets.set(key, { start: now, count: 1 });
    return limit >= 1;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

const budgets = new Map<string, { day: number; used: number }>();

export function spendBudget(name: string, perDay: number, now: number = Date.now()): boolean {
  const day = Math.floor(now / 86_400_000);
  const b = budgets.get(name);
  if (!b || b.day !== day) {
    budgets.set(name, { day, used: 1 });
    return perDay >= 1;
  }
  if (b.used >= perDay) return false;
  b.used += 1;
  return true;
}

export function resetRateLimits() {
  buckets.clear();
  budgets.clear();
}
