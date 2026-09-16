import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { calculateDailyProduction, calculateDailyYield, canClaimDailyRewards } from '@/lib/cityLogic';

export async function POST(request) {
  try {
    const { wallet_address } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    // Check if can claim (24 hour cooldown)
    if (!canClaimDailyRewards(city.gole_claimed_at)) {
      const timeSinceLastClaim = Date.now() - new Date(city.gole_claimed_at).getTime();
      const timeUntilNextClaim = Math.ceil((24 * 60 * 60 * 1000 - timeSinceLastClaim) / 1000);

      return new Response(
        JSON.stringify({
          error: `Already claimed today. Try again in ${Math.floor(timeUntilNextClaim / 3600)} hours.`,
          seconds_until_next_claim: timeUntilNextClaim
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch structures to calculate production
    const { data: structures = [] } = await supabaseAdmin
      .from('structures')
      .select('*')
      .eq('city_id', city.id);

    // Calculate rewards:
    // 1. Daily production from generators
    const structureProduction = calculateDailyProduction(structures);

    // 2. Daily yield (5% of holdings)
    const dailyYield = calculateDailyYield(city.gole_balance);

    // Total reward
    const totalReward = structureProduction + dailyYield;

    if (totalReward <= 0) {
      return new Response(
        JSON.stringify({
          error: 'No rewards available. Build generators to earn $GOLE.',
          structure_production: structureProduction,
          daily_yield: dailyYield
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update city balance and claim timestamp
    const newBalance = city.gole_balance + totalReward;
    const { error: updateError } = await supabaseAdmin
      .from('cities')
      .update({
        gole_balance: newBalance,
        gole_claimed_at: new Date().toISOString()
      })
      .eq('id', city.id);

    if (updateError) throw updateError;

    // Record reward claim
    await supabaseAdmin
      .from('gole_rewards')
      .insert({
        city_id: city.id,
        reward_amount: totalReward
      });

    return new Response(
      JSON.stringify({
        ok: true,
        reward: {
          structure_production: structureProduction,
          daily_yield: dailyYield,
          total_reward: totalReward,
          new_balance: newBalance
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Claim rewards error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error claiming rewards' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
