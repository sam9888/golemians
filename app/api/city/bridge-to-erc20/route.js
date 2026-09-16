import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { isBridgeEnabled } from '@/lib/goleBridge';

// Bridge in-game $GOLE tokens to ERC20 token on blockchain
// Requires GOLE_BRIDGE_ENABLED=true and NEXT_PUBLIC_GOLE_TOKEN_CONTRACT set

export async function POST(request) {
  try {
    const { wallet_address, amount } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if bridge is enabled
    if (!isBridgeEnabled()) {
      return new Response(
        JSON.stringify({
          error: 'Token bridge not yet available',
          message: 'Waiting for $GOLE token deployment on Robin Hood Launchpad'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();

    // Fetch city
    const { data: city, error: cityError } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (cityError || !city) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount
    if (!Number.isInteger(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check balance
    if (city.gole_balance < amount) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient $GOLE balance',
          have: city.gole_balance,
          requested: amount
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: After Robin Hood deployment, implement:
    // 1. Call game contract to mint tokens to wallet
    // 2. Deduct from in-game balance
    // 3. Log transaction

    // For now, return pending status
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'bridge_not_active',
        message: 'Waiting for $GOLE token deployment on Robin Hood Launchpad',
        ready_to_bridge: amount,
        wallet: normalizedWallet
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Bridge error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error processing bridge' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
