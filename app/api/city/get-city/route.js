import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { calculateHourlyProduction, calculateDefense } from '@/lib/cityLogic';

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

    // Calculate production and defense
    const production = calculateHourlyProduction(structures);
    const defense = calculateDefense(structures);

    // Calculate resources including production since last update
    const updatedResources = { ...city.resources };
    if (city.updated_at) {
      const hoursPassed = (Date.now() - new Date(city.updated_at).getTime()) / (1000 * 60 * 60);
      updatedResources.gold += Math.floor(production.gold * hoursPassed);
      updatedResources.wood += Math.floor(production.wood * hoursPassed);
      updatedResources.food += Math.floor(production.food * hoursPassed);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        city: {
          id: city.id,
          name: city.city_name,
          wallet: normalizedWallet,
          x: city.x_coordinate,
          y: city.y_coordinate,
          resources: updatedResources,
          nft_balance: city.nft_balance,
          total_strength: city.total_strength,
          last_attacked_at: city.last_attacked_at,
          structures: structures.length,
          golemians: golemians.length,
          production_per_hour: production,
          defensive_strength: defense,
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
