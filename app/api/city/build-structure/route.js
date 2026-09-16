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

    // Check if can afford $GOLE
    if (city.gole_balance < config.buildCost) {
      return new Response(
        JSON.stringify({
          error: 'Not enough $GOLE tokens',
          need: config.buildCost,
          have: city.gole_balance
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Deduct $GOLE from city balance
    const newBalance = city.gole_balance - config.buildCost;

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

    // Update city $GOLE balance
    await supabaseAdmin
      .from('cities')
      .update({ gole_balance: newBalance })
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
        gole_balance_remaining: newBalance
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
