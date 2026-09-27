import { isValidWallet } from '@/lib/pvpLogic';
import { issueNonce, buildSignInMessage } from '@/lib/authNonce';
import { checkRateLimit } from '@/lib/rateLimit';

// Issues a one-time nonce + human-readable message for the wallet to sign.
// Read-only: no chain interaction, no funds involved.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!isValidWallet(wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid EVM wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet.toLowerCase();

    const rateCheck = checkRateLimit(`auth_nonce_${normalizedWallet}`, 20, 3600);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many sign-in attempts. Try again later.', retryAfter: rateCheck.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': rateCheck.retryAfter } }
      );
    }

    const nonce = issueNonce(normalizedWallet);
    const message = buildSignInMessage(normalizedWallet, nonce);

    return new Response(
      JSON.stringify({ ok: true, nonce, message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Auth nonce error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error issuing nonce' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
