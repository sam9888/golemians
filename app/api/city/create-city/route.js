import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet, NFT_MIN_BALANCE } from '@/lib/pvpLogic';
import { generateCityCoordinates } from '@/lib/cityLogic';
import { checkRateLimit } from '@/lib/rateLimit';
import { verifyNftOwnership } from '@/lib/web3Connect';

export async function POST(request) {
  try {
    const { wallet_address, city_name } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid EVM wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: max 5 city creation attempts per wallet per hour
    const rateCheck = checkRateLimit(wallet_address, 5, 3600);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Try again later.',
          retryAfter: rateCheck.retryAfter
        }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': rateCheck.retryAfter } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();

    // Verify NFT balance on blockchain (10+ minimum)
    let nftBalance;
    try {
      nftBalance = await verifyNftOwnership(normalizedWallet);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Failed to verify NFT balance. Please try again.',
          details: err.message
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (nftBalance < NFT_MIN_BALANCE) {
      return new Response(
        JSON.stringify({
          error: 'You need 10+ Golemians NFTs to play',
          have: nftBalance,
          need: NFT_MIN_BALANCE
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if city already exists
    const { data: existing } = await supabaseAdmin
      .from('cities')
      .select('id')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'You already have a city' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate coordinates
    const coords = generateCityCoordinates();

    // Create city with starting $GOLE balance
    const { data: city, error } = await supabaseAdmin
      .from('cities')
      .insert({
        wallet_address: normalizedWallet,
        city_name: city_name || 'My City',
        x_coordinate: coords.x,
        y_coordinate: coords.y,
        gole_balance: 100000, // Starting balance: 100,000 $GOLE
        gole_claimed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('City creation error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create city' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create resource production tracker
    await supabaseAdmin
      .from('resource_production')
      .insert({
        city_id: city.id,
        last_collected_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        ok: true,
        city: {
          id: city.id,
          name: city.city_name,
          wallet: normalizedWallet,
          x: city.x_coordinate,
          y: city.y_coordinate,
          gole_balance: city.gole_balance
        }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Create city error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error creating city' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
