import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { generateCityCoordinates } from '@/lib/cityLogic';

export async function POST(request) {
  try {
    const { wallet_address, city_name } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid EVM wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();

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

    // Create city
    const { data: city, error } = await supabaseAdmin
      .from('cities')
      .insert({
        wallet_address: normalizedWallet,
        city_name: city_name || 'My City',
        x_coordinate: coords.x,
        y_coordinate: coords.y,
        resources: { gold: 1000, wood: 1000, food: 1000 }
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
          resources: city.resources
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
