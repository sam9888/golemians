import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('project_stats')
      .select('claimed_count, total_spots')
      .eq('id', 'gtd')
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ claimed_count: 340, total_spots: 1200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ claimed_count: 340, total_spots: 1200 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
