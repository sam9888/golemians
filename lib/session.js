// Server-only signed session tokens.
//
// This proves a browser controls a wallet's private key (via a signed
// message) WITHOUT ever touching funds, tokens, or NFTs — no transaction,
// no approval, no transfer. The token is a plain HMAC-signed cookie value,
// not a JWT library, to avoid adding a new dependency for something this
// small (same "keep it simple" spirit as lib/rateLimit.js).

import crypto from 'crypto';

const SESSION_COOKIE = 'golemians_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not configured');
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionToken(wallet) {
  const payload = base64url(JSON.stringify({
    wallet: wallet.toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS
  }));
  return `${payload}.${sign(payload)}`;
}

// Returns the verified, lowercased wallet address, or null if the token is
// missing, malformed, expired, or has an invalid signature.
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  let expectedSig;
  try {
    expectedSig = sign(payload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!data.wallet || typeof data.exp !== 'number' || Date.now() > data.exp) return null;

  return data.wallet;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        // Ignore malformed cookie values and let session verification fail
        // closed instead of turning an invalid client cookie into a 500.
        return null;
      }
    }
  }
  return null;
}

// Returns the wallet in a valid session cookie, or null when the request is
// unauthenticated. This is useful for session hydration without trusting a
// wallet address supplied by the browser.
export function getSessionWallet(request) {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

// Verifies the request's session cookie proves ownership of expectedWallet.
// Returns the verified wallet on success, or throws { status, message }.
export function requireSession(request, expectedWallet) {
  const sessionWallet = getSessionWallet(request);

  if (!sessionWallet) {
    throw { status: 401, message: 'Not signed in. Please connect and verify your wallet.' };
  }

  if (!expectedWallet || sessionWallet !== expectedWallet.toLowerCase()) {
    throw { status: 401, message: 'Wallet does not match your signed-in session.' };
  }

  return sessionWallet;
}

// Convenience wrapper for API routes: returns null if the session is valid,
// or a ready-to-return 401 Response if not. Usage:
//   const authError = requireSessionResponse(request, wallet_address);
//   if (authError) return authError;
export function requireSessionResponse(request, expectedWallet) {
  try {
    requireSession(request, expectedWallet);
    return null;
  } catch (err) {
    const status = err?.status || 401;
    const message = err?.message || 'Not signed in.';
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export function sessionCookieHeader(wallet) {
  const token = createSessionToken(wallet);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function clearSessionCookieHeader() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
