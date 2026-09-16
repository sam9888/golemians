import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { calculateDailyProduction, calculateDefense, calculateDailyYield, canClaimDailyRewards } from '@/lib/cityLogic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!isValidWallet(wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet.toLowerCase();

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

    // Fetch structures
    const { data: structures = [] } = await supabaseAdmin
      .from('structures')
      .select('*')
      .eq('city_id', city.id);

    // Fetch Golemians
    const { data: golemians = [] } = await supabaseAdmin
      .from('golemians')
      .select('*')
      .eq('city_id', city.id);

    // Calculate production, yield, and defense
    const dailyProduction = calculateDailyProduction(structures);
    const dailyYield = calculateDailyYield(city.gole_balance);
    const defense = calculateDefense(structures);
    const canClaim = canClaimDailyRewards(city.gole_claimed_at);

    return new Response(
      JSON.stringify({
        ok: true,
        city: {
          id: city.id,
          name: city.city_name,
          wallet: normalizedWallet,
          x: city.x_coordinate,
          y: city.y_coordinate,
          gole_balance: city.gole_balance,
          nft_balance: city.nft_balance,
          total_strength: city.total_strength,
          last_attacked_at: city.last_attacked_at,
          structures: structures.length,
          golemians: golemians.length,
          daily_production: dailyProduction,
          daily_yield: dailyYield,
          total_daily_reward: dailyProduction + dailyYield,
          defensive_strength: defense,
          can_claim_rewards: canClaim,
          gole_claimed_at: city.gole_claimed_at,
          created_at: city.created_at
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Get city error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching city' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
