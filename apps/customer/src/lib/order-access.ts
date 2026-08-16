import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * A no-login link to one booking's tracking page.
 *
 * A WhatsApp-only customer has no password to log in with, so "go check your
 * order" needs a door that isn't a login screen. This signs the booking id
 * with a server secret rather than storing a token anywhere - nothing to
 * clean up, nothing to leak from a database row.
 *
 * Reuses WHATSAPP_APP_SECRET rather than adding a new required env var: it is
 * already a private, server-only secret with the shape this needs (long,
 * random, never sent to a browser), just used here for a different signature.
 */

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function sign(bookingId: string, expiresAt: number): string {
  const secret = serverEnv().WHATSAPP_APP_SECRET;
  if (!secret) throw new Error("No signing secret configured for order access tokens");
  return createHmac("sha256", secret).update(`${bookingId}.${expiresAt}`).digest("hex");
}

export function createOrderAccessToken(bookingId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return `${expiresAt}.${sign(bookingId, expiresAt)}`;
}

export function verifyOrderAccessToken(bookingId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAtStr, signature] = token.split(".");
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = sign(bookingId, expiresAt);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
