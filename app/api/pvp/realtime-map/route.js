import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import {
  getNearbyEnemies,
  getTerritoryBonus,
  getProximityAlert
} from '@/lib/mapLogic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!isValidWallet(wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet.toLowerCase();

    // Get player's city
    const { data: playerCity } = await supabaseAdmin
      .from('cities')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (!playerCity) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all cities for map
    const { data: allCities } = await supabaseAdmin
      .from('cities')
      .select('id, city_name, x_coordinate, y_coordinate, nft_balance, total_strength, gole_balance');

    // Get player's territories
    const { data: territories } = await supabaseAdmin
      .from('territories')
      .select('*')
      .eq('controlled_by', playerCity.id);

    // Calculate nearby enemies
    const nearbyEnemies = getNearbyEnemies(
      playerCity.x_coordinate,
      playerCity.y_coordinate,
      allCities.filter(c => c.id !== playerCity.id)
    );

    // Get proximity alert
    const alert = getProximityAlert(
      playerCity.x_coordinate,
      playerCity.y_coordinate,
      nearbyEnemies
    );

    // Calculate territory bonus
    const territoryCount = territories?.length || 0;
    const territoryBonus = getTerritoryBonus(territoryCount);

    return new Response(
      JSON.stringify({
        ok: true,
        player: {
          id: playerCity.id,
          name: playerCity.city_name,
          x: playerCity.x_coordinate,
          y: playerCity.y_coordinate,
          nft_balance: playerCity.nft_balance,
          strength: playerCity.total_strength,
          gole_balance: playerCity.gole_balance
        },
        nearby_enemies: nearbyEnemies.map(e => ({
          id: e.id,
          name: e.city_name,
          x: e.x_coordinate,
          y: e.y_coordinate,
          distance: e.distance.toFixed(1),
          nft_balance: e.nft_balance,
          strength: e.total_strength,
          gole_balance: e.gole_balance,
          damage_multiplier: e.damageMultiplier,
          can_raid: e.canRaid
        })),
        proximity_alert: alert,
        territories: {
          count: territoryCount,
          bonus_percent: (territoryBonus * 100).toFixed(1),
          daily_bonus_gole: Math.floor(playerCity.gole_balance * territoryBonus)
        },
        map_stats: {
          total_players: allCities.length,
          nearby_count: nearbyEnemies.length,
          threat_level: alert
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Real-time map error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching map' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
