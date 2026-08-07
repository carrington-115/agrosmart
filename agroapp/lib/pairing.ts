import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived pairing tokens for the QR sensor-add flow.
 *
 * The SRS describes the flow as: the desktop "generates a secured link that the
 * user can use on their mobile phone to scan the QR code on the back of the
 * sensor". So the desktop mints a link, shows it as a QR, and the phone opens it
 * and scans the sensor.
 *
 * That link carries the user's identity to a device with no session, which makes
 * it a bearer credential. Three properties follow:
 *
 *   * **Signed, not stored.** The token is `<payload>.<hmac>`, so verifying it
 *     needs no database round trip and no table — there is nothing to clean up
 *     when a link is never used, which is the common case.
 *
 *   * **Short-lived.** Ten minutes is long enough to walk to the sensor and
 *     short enough that a screenshot in a chat log stops working. The expiry is
 *     inside the signed payload, so it cannot be extended by editing the URL.
 *
 *   * **Scoped to one action.** The token authorises registering a sensor to its
 *     issuer and nothing else. It is not a session and cannot read data.
 *
 * The signing key is derived from `SENSOR_INGEST_KEY`, which every deployment
 * that can pair a sensor already sets, with a distinct HMAC label so the two uses
 * cannot be substituted for one another.
 */

const TOKEN_TTL_SECONDS = 600;
const HMAC_LABEL = "agrosmart-pairing-v1";

function signingKey(): string {
  const secret = process.env.SENSOR_INGEST_KEY;
  if (!secret) {
    throw new Error(
      "SENSOR_INGEST_KEY is not set. QR pairing needs it to sign pairing links. " +
        "See agroapp/.env.example.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey())
    .update(`${HMAC_LABEL}:${payload}`)
    .digest("base64url");
}

/** Base64url without padding, so the token is URL-safe in a path segment. */
function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Mints a pairing token for a user. */
export function createPairingToken(userId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = encode(JSON.stringify({ sub: userId, exp: expiresAt }));
  return `${payload}.${sign(payload)}`;
}

export type PairingClaims = { userId: string; expiresAt: number };

/**
 * Verifies a pairing token, returning its claims or `null`.
 *
 * Every failure mode — malformed, wrong signature, expired — returns `null`
 * without distinguishing them to the caller. The reason a link does not work is
 * not information the holder of a bad link needs.
 */
export function verifyPairingToken(token: string): PairingClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // No signing key configured: nothing can be verified, so nothing is valid.
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const json = decode(payload);
  if (!json) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(json);
  } catch {
    return null;
  }

  if (
    typeof claims !== "object" ||
    claims === null ||
    typeof (claims as { sub?: unknown }).sub !== "string" ||
    typeof (claims as { exp?: unknown }).exp !== "number"
  ) {
    return null;
  }

  const { sub, exp } = claims as { sub: string; exp: number };
  if (exp * 1000 < Date.now()) return null;

  return { userId: sub, expiresAt: exp };
}
