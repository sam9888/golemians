import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rankPlayers } from '@/lib/pvpLogic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 100, 1000);
    const offset = Math.max(parseInt(searchParams.get('offset')) || 0, 0);

    // Fetch players, ordered by wins then tokens won
    const { data: players, error, count } = await supabaseAdmin
      .from('pvp_players')
      .select('*', { count: 'exact' })
      .order('total_wins', { ascending: false })
      .order('total_tokens_won', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Leaderboard error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaderboard' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rank players
    const rankedPlayers = rankPlayers(players || []);

    return new Response(
      JSON.stringify({
        ok: true,
        players: rankedPlayers.map(p => ({
          rank: p.rank,
          wallet: p.wallet_address,
          wins: p.total_wins,
          losses: p.total_losses,
          tokens_won: p.total_tokens_won,
          tokens_lost: p.total_tokens_lost,
          tokens_held: p.tokens_held,
          nft_balance: p.nft_balance,
          verified_at: p.verified_at
        })),
        total: count,
        limit,
        offset
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('PvP leaderboard error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching leaderboard' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
