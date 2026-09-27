import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { getCitiesInTerritory, getTerritoryBonus } from '@/lib/mapLogic';
import { requireSessionResponse } from '@/lib/session';

export async function POST(request) {
  try {
    const { attacker_wallet, defender_city_id, raid_id } = await request.json();

    if (!isValidWallet(attacker_wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authError = requireSessionResponse(request, attacker_wallet);
    if (authError) return authError;

    if (!raid_id) {
      return new Response(
        JSON.stringify({ error: 'Missing raid_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = attacker_wallet.toLowerCase();

    // Fetch attacker city
    const { data: attackerCity } = await supabaseAdmin
      .from('cities')
      .select('id')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (!attackerCity) {
      return new Response(
        JSON.stringify({ error: 'Your city not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch defender city
    const { data: defenderCity } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('id', defender_city_id)
      .maybeSingle();

    if (!defenderCity) {
      return new Response(
        JSON.stringify({ error: 'Defender city not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify a real, successful raid actually happened between these two
    // cities before allowing a territory claim — never trust a client flag.
    const { data: raid } = await supabaseAdmin
      .from('raids')
      .select('id, attacker_city_id, defender_city_id, status, territory_claimed')
      .eq('id', raid_id)
      .maybeSingle();

    if (
      !raid ||
      raid.attacker_city_id !== attackerCity.id ||
      raid.defender_city_id !== defenderCity.id ||
      raid.status !== 'success'
    ) {
      return new Response(
        JSON.stringify({ error: 'No successful raid found for this attack' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (raid.territory_claimed) {
      return new Response(
        JSON.stringify({ error: 'Territory already claimed for this raid' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already controlled
    const { data: existingTerritory } = await supabaseAdmin
      .from('territories')
      .select('id')
      .eq('city_id', defenderCity.id)
      .eq('controlled_by', attackerCity.id)
      .maybeSingle();

    if (existingTerritory) {
      return new Response(
        JSON.stringify({ error: 'Territory already controlled' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Claim territory (overwrite previous control)
    const { error: claimError } = await supabaseAdmin
      .from('territories')
      .upsert({
        city_id: defenderCity.id,
        controlled_by: attackerCity.id,
        claimed_at: new Date().toISOString()
      }, { onConflict: 'city_id' });

    if (claimError) throw claimError;

    // Mark this raid as consumed so it can't be used to claim territory twice
    await supabaseAdmin
      .from('raids')
      .update({ territory_claimed: true })
      .eq('id', raid.id);

    // Get all territories controlled by attacker
    const { data: allTerritories } = await supabaseAdmin
      .from('territories')
      .select('id')
      .eq('controlled_by', attackerCity.id);

    const territoryCount = allTerritories?.length || 0;
    const territoryBonus = getTerritoryBonus(territoryCount);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Territory claimed! Total territories: ${territoryCount}`,
        territory_bonus: {
          count: territoryCount,
          percent: (territoryBonus * 100).toFixed(1),
          daily_bonus: Math.floor(10000 * territoryBonus)  // Base bonus of 10K
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Claim territory error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error claiming territory' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
