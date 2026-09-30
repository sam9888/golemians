import crypto from 'crypto';
import { JOIN_TOKEN_TTL_SECONDS } from '@/shared/arenaConfig';
import { getGameServerSecret } from '@/lib/arena/config';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', getGameServerSecret()).update(payload).digest('base64url');
}

// Mints a short-lived, single-use token proving this app has already
// verified the wallet's session, on-chain holder status, and GLM balance,
// and has debited the entry fee. The match server (game-server/src/auth/
// joinToken.js) independently re-verifies the signature — it never trusts
// client-supplied eligibility.
export function createJoinToken({ wallet, tokenId, entryId, characterName }) {
  const payload = base64url(JSON.stringify({
    wallet: wallet.toLowerCase(),
    tokenId: typeof tokenId === 'number' ? tokenId : null,
    entryId,
    characterName: characterName || null,
    exp: Date.now() + JOIN_TOKEN_TTL_SECONDS * 1000,
  }));
  return `${payload}.${sign(payload)}`;
}
