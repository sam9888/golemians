import crypto from 'crypto';

// Verifies join tokens minted by the Vercel app's /api/arena/enter route
// (see lib/arena/joinToken.js for the signer). The match server independently
// checks the HMAC signature here rather than trusting anything the client
// claims — this is the only bridge between Vercel-side auth/economy and the
// realtime loop, so it must never trust client-supplied eligibility.

const consumedEntryIds = new Map(); // entryId -> expiresAtMs

function pruneConsumed() {
  const now = Date.now();
  for (const [id, expiresAt] of consumedEntryIds) {
    if (now > expiresAt) consumedEntryIds.delete(id);
  }
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

// Returns { wallet, tokenId, entryId, characterName } on success, or throws.
// Single-use: an entryId that's already been consumed is rejected, closing
// the replay window within the token's own short TTL.
export function verifyJoinToken(token) {
  const secret = process.env.GAME_SERVER_SECRET;
  if (!secret) {
    throw new Error('GAME_SERVER_SECRET is not configured on the match server');
  }
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Malformed join token');
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    throw new Error('Malformed join token');
  }

  const expectedSig = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid join token signature');
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid join token payload');
  }

  if (!data.wallet || typeof data.exp !== 'number') {
    throw new Error('Invalid join token payload');
  }
  if (Date.now() > data.exp) {
    throw new Error('Join token has expired');
  }

  pruneConsumed();
  if (data.entryId) {
    if (consumedEntryIds.has(data.entryId)) {
      throw new Error('Join token has already been used');
    }
    consumedEntryIds.set(data.entryId, data.exp);
  }

  return {
    wallet: data.wallet,
    tokenId: typeof data.tokenId === 'number' ? data.tokenId : null,
    entryId: data.entryId || null,
    characterName: typeof data.characterName === 'string' ? data.characterName : null,
  };
}
