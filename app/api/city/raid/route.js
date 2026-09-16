import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { calculateRaidOutcome, calculateStolenGole, calculateDefense } from '@/lib/cityLogic';

export async function POST(request) {
  try {
    const { attacker_wallet, defender_city_id } = await request.json();

    if (!isValidWallet(attacker_wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedAttackerWallet = attacker_wallet.toLowerCase();

    // Fetch attacker city
    const { data: attackerCity, error: attackerError } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('wallet_address', normalizedAttackerWallet)
      .maybeSingle();

    if (attackerError || !attackerCity) {
      return new Response(
        JSON.stringify({ error: 'Attacker city not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch defender city
    const { data: defenderCity, error: defenderError } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('id', defender_city_id)
      .maybeSingle();

    if (defenderError || !defenderCity) {
      return new Response(
        JSON.stringify({ error: 'Defender city not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (attackerCity.id === defenderCity.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot raid your own city' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch structures for both cities
    const { data: attackerStructures = [] } = await supabaseAdmin
      .from('structures')
      .select('*')
      .eq('city_id', attackerCity.id);

    const { data: defenderStructures = [] } = await supabaseAdmin
      .from('structures')
      .select('*')
      .eq('city_id', defenderCity.id);

    // Fetch Golemians for both cities
    const { data: attackerGolemians = [] } = await supabaseAdmin
      .from('golemians')
      .select('*')
      .eq('city_id', attackerCity.id)
      .eq('status', 'idle');

    const { data: defenderGolemians = [] } = await supabaseAdmin
      .from('golemians')
      .select('*')
      .eq('city_id', defenderCity.id)
      .eq('status', 'idle');

    // Calculate strength (Golemians + defensive structures)
    const attackerStrength = attackerGolemians.length * 10; // 10 power per Golemian
    const defenderStrength = (defenderGolemians.length * 10) + calculateDefense(defenderStructures);

    // Determine outcome
    const attackerWins = calculateRaidOutcome(attackerStrength, defenderStrength);

    let stolenGole = 0;
    let raidStatus = 'defended';

    if (attackerWins) {
      stolenGole = calculateStolenGole(defenderCity.gole_balance, attackerStrength);
      raidStatus = 'success';

      // Update defender $GOLE
      const newDefenderBalance = Math.max(0, defenderCity.gole_balance - stolenGole);

      await supabaseAdmin
        .from('cities')
        .update({
          gole_balance: newDefenderBalance,
          last_attacked_at: new Date().toISOString()
        })
        .eq('id', defenderCity.id);

      // Update attacker $GOLE
      const newAttackerBalance = attackerCity.gole_balance + stolenGole;

      await supabaseAdmin
        .from('cities')
        .update({ gole_balance: newAttackerBalance })
        .eq('id', attackerCity.id);
    }

    // Record raid
    const { data: raid, error: raidError } = await supabaseAdmin
      .from('raids')
      .insert({
        attacker_city_id: attackerCity.id,
        defender_city_id: defenderCity.id,
        attacker_strength: attackerStrength,
        defender_strength: defenderStrength,
        resources_stolen: { gole: stolenGole },
        status: raidStatus,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (raidError) throw raidError;

    return new Response(
      JSON.stringify({
        ok: true,
        raid: {
          id: raid.id,
          status: raidStatus,
          attacker_strength: attackerStrength,
          defender_strength: defenderStrength,
          gole_stolen: stolenGole
        }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Raid error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error processing raid' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
