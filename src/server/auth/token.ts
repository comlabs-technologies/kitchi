import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed session cookie value: `<userId>.<hmac>`. This is still a placeholder for a real auth provider
 * (Auth.js / Clerk / WorkOS), but it means a client can't mint a session for someone else's user id.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "kitchi-dev-secret");
  if (!s) throw new Error("SESSION_SECRET must be set in production");
  return s;
}

const mac = (userId: string) => createHmac("sha256", secret()).update(userId).digest("base64url");

export function signSession(userId: string): string {
  return `${userId}.${mac(userId)}`;
}

export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 1) return null;
  const userId = value.slice(0, i);
  const given = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(mac(userId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
