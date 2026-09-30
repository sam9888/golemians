import { getSessionWallet } from '@/lib/session';

// Returns only the wallet authenticated by the httpOnly session cookie. The
// address is never accepted from query/body input, so this endpoint is safe
// for client-side session hydration after a page reload.
export async function GET(request) {
  const wallet = getSessionWallet(request);

  return new Response(
    JSON.stringify(wallet
      ? { authenticated: true, wallet }
      : { authenticated: false, wallet: null }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}
