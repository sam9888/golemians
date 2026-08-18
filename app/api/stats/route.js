import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Falls back to these ONLY if the project_stats table/row doesn't exist yet.
const FALLBACK = { claimed_count: 0, total_spots: 1200 };

export async function GET() {
  try {
    // base_claimed_count = a manual/legacy starting count the team can set
    // (e.g. carried over from a previous phase). Real approvals add on top
    // of this — nothing here is incremented automatically by public submits.
    const { data: statsRow, error: statsError } = await supabaseAdmin
      .from('project_stats')
      .select('base_claimed_count, total_spots')
      .eq('id', 'gtd')
      .single();

    const baseClaimed = statsError || !statsRow ? FALLBACK.claimed_count : (statsRow.base_claimed_count ?? 0);
    const totalSpots = statsError || !statsRow ? FALLBACK.total_spots : (statsRow.total_spots ?? FALLBACK.total_spots);

    // Real, approved claims from the submissions table.
    const { count: approvedCount, error: countError } = await supabaseAdmin
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .or('claimed.eq.true,status.eq.approved,status.eq.allocated,status.eq.winner');

    const claimedCount = baseClaimed + (countError ? 0 : (approvedCount || 0));

    return new Response(JSON.stringify({
      claimed_count: claimedCount,
      total_spots: totalSpots
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return new Response(JSON.stringify(FALLBACK), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
