import { Redis } from "@upstash/redis";

// Lazily constructed so a missing env var fails at call time, not import/build time.
let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set");
  }
  cached = new Redis({ url, token });
  return cached;
}
