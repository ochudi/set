import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "@/lib/redis";

// Magic-link request limits (CLAUDE.md stack: Upstash rate limiting).
let perEmail: Ratelimit | null = null;
let perIp: Ratelimit | null = null;

/** 3 magic-link requests per email per hour. */
export function magicLinkEmailLimiter(): Ratelimit {
  return (perEmail ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "rl:magic:email",
    analytics: false,
  }));
}

/** 10 magic-link requests per IP per hour. */
export function magicLinkIpLimiter(): Ratelimit {
  return (perIp ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:magic:ip",
    analytics: false,
  }));
}

let search: Ratelimit | null = null;

/** 20 people-search queries per user per minute (command palette). */
export function peopleSearchLimiter(): Ratelimit {
  return (search ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:search",
    analytics: false,
  }));
}

// --- public external pledge limit: 5 per hour per IP ----------------------
// Uses Upstash when configured; otherwise an in-process sliding window so the
// limit still holds in local/dev (single instance). Returns true if allowed.

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

const PLEDGE_LIMIT = 5;
const PLEDGE_WINDOW_MS = 60 * 60 * 1000;
const memoryHits = new Map<string, number[]>();

function memoryAllow(key: string): boolean {
  const now = Date.now();
  const recent = (memoryHits.get(key) ?? []).filter(
    (t) => now - t < PLEDGE_WINDOW_MS,
  );
  if (recent.length >= PLEDGE_LIMIT) {
    memoryHits.set(key, recent);
    return false;
  }
  recent.push(now);
  memoryHits.set(key, recent);
  return true;
}

let pledgeLimiter: Ratelimit | null = null;

export async function publicPledgeAllowed(ip: string): Promise<boolean> {
  if (upstashConfigured()) {
    try {
      pledgeLimiter ??= new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(PLEDGE_LIMIT, "1 h"),
        prefix: "rl:pledge:ip",
        analytics: false,
      });
      const res = await pledgeLimiter.limit(ip);
      return res.success;
    } catch {
      return memoryAllow(ip);
    }
  }
  return memoryAllow(ip);
}
