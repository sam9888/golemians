import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 100, 1000);

    // Fetch all cities
    const { data: cities, error } = await supabaseAdmin
      .from('cities')
      .select('id, city_name, x_coordinate, y_coordinate, nft_balance, total_strength, resources, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Map fetch error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch map' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cities: cities?.map(c => ({
          id: c.id,
          name: c.city_name,
          x: c.x_coordinate,
          y: c.y_coordinate,
          nft_balance: c.nft_balance,
          strength: c.total_strength,
          resources: c.resources,
          created_at: c.created_at
        })) || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Map error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching map' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
