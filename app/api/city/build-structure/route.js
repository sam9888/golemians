import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { STRUCTURE_TYPES } from '@/lib/cityLogic';

export async function POST(request) {
  try {
    const { wallet_address, structure_type } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!STRUCTURE_TYPES[structure_type]) {
      return new Response(
        JSON.stringify({ error: 'Invalid structure type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();
    const config = STRUCTURE_TYPES[structure_type];

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

    const resources = city.resources || { gold: 0, wood: 0, food: 0 };

    // Check if can afford
    if (
      resources.gold < config.buildCost.gold ||
      resources.wood < config.buildCost.wood ||
      resources.food < config.buildCost.food
    ) {
      return new Response(
        JSON.stringify({
          error: 'Not enough resources',
          need: config.buildCost,
          have: resources
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Deduct resources
    const newResources = {
      gold: resources.gold - config.buildCost.gold,
      wood: resources.wood - config.buildCost.wood,
      food: resources.food - config.buildCost.food
    };

    // Build structure
    const { data: structure, error: buildError } = await supabaseAdmin
      .from('structures')
      .insert({
        city_id: city.id,
        structure_type,
        level: 1
      })
      .select()
      .single();

    if (buildError) throw buildError;

    // Update city resources
    await supabaseAdmin
      .from('cities')
      .update({ resources: newResources })
      .eq('id', city.id);

    return new Response(
      JSON.stringify({
        ok: true,
        structure: {
          id: structure.id,
          type: structure.structure_type,
          level: structure.level,
          created_at: structure.created_at
        },
        resources_remaining: newResources
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Build structure error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error building structure' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
