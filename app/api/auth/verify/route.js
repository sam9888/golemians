import { ethers } from 'ethers';
import { isValidWallet } from '@/lib/pvpLogic';
import { consumeNonce } from '@/lib/authNonce';
import { sessionCookieHeader } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

// Verifies a signed nonce proves ownership of the wallet, then issues a
// session cookie. This never touches the blockchain and never requests a
// transaction, approval, or transfer — it only checks a signature.
export async function POST(request) {
  try {
    const { wallet, signature } = await request.json();

    if (!isValidWallet(wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid EVM wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!signature || typeof signature !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet.toLowerCase();

    const rateCheck = checkRateLimit(`auth_verify_${normalizedWallet}`, 20, 3600);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many sign-in attempts. Try again later.', retryAfter: rateCheck.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': rateCheck.retryAfter } }
      );
    }

    const expectedMessage = consumeNonce(normalizedWallet);
    if (!expectedMessage) {
      return new Response(
        JSON.stringify({ error: 'No pending sign-in request for this wallet. Request a new nonce and try again.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(expectedMessage, signature);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (recoveredAddress.toLowerCase() !== normalizedWallet) {
      return new Response(
        JSON.stringify({ error: 'Signature does not match wallet' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, wallet: normalizedWallet }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookieHeader(normalizedWallet)
        }
      }
    );
  } catch (err) {
    console.error('Auth verify error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error verifying signature' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
