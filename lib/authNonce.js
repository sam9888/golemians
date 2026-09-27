// In-memory, single-use nonce store for wallet sign-in (proof of ownership).
// Same "simple utility, no new infra" pattern as lib/rateLimit.js.
// A nonce never authorizes a transaction — it only proves the caller can
// produce a valid signature for a specific wallet address.

import crypto from 'crypto';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const nonces = new Map(); // wallet -> { nonce, expiresAt }

export function issueNonce(wallet) {
  const nonce = crypto.randomUUID();
  nonces.set(wallet, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

export function buildSignInMessage(wallet, nonce) {
  return [
    'Sign in to Golemians',
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    '',
    'This signature only proves you control this wallet.',
    'It will NOT trigger a blockchain transaction, spend gas, or move any funds/tokens/NFTs.'
  ].join('\n');
}

// Consumes (single-use) and returns the expected message for this wallet,
// or null if there is no valid, unexpired nonce on file.
export function consumeNonce(wallet) {
  const record = nonces.get(wallet);
  nonces.delete(wallet);

  if (!record || Date.now() > record.expiresAt) return null;

  return buildSignInMessage(wallet, record.nonce);
}

// Periodic cleanup so stale nonces don't accumulate forever.
setInterval(() => {
  const now = Date.now();
  for (const [wallet, record] of nonces.entries()) {
    if (now > record.expiresAt) nonces.delete(wallet);
  }
}, 5 * 60 * 1000);
