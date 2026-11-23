import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed parent-session token, kept in an httpOnly cookie. Expires after 30 minutes. */
const SECRET = randomBytes(32);
const TTL_MS = 30 * 60 * 1000;

export function issueParentToken(now = Date.now()): string {
  const exp = String(now + TTL_MS);
  return `${exp}.${createHmac("sha256", SECRET).update(exp).digest("hex")}`;
}

export function checkParentToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(exp).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) && Number(exp) > now;
}
