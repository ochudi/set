import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for the optional email+password login path.
 *
 * NOTE (CLAUDE.md): the decided stack is Auth.js v5 magic links. Password login
 * is an additive convenience the owner explicitly requested; magic links still
 * work. Hashes use scrypt (no extra dependency) in the format
 * `scrypt$<N>$<saltB64>$<hashB64>`.
 */

const KEYLEN = 64;
const COST = 16384; // scrypt N (CPU/memory cost); 128*N*r = 16MB at r=8

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  if (!Number.isInteger(cost) || cost < 1024) return false;
  const salt = Buffer.from(parts[2], "base64");
  const expected = Buffer.from(parts[3], "base64");
  let derived: Buffer;
  try {
    derived = scryptSync(plain, salt, expected.length, { N: cost });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
