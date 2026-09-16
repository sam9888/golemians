import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';

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

    const { data: player, error } = await supabaseAdmin
      .from('pvp_players')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (error) {
      console.error('Player stats error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch player stats' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!player) {
      return new Response(
        JSON.stringify({ error: 'Player not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate win rate
    const totalGames = player.total_wins + player.total_losses;
    const winRate = totalGames > 0 ? (player.total_wins / totalGames * 100).toFixed(1) : 0;

    return new Response(
      JSON.stringify({
        ok: true,
        wallet: normalizedWallet,
        stats: {
          nft_balance: player.nft_balance,
          tokens_held: player.tokens_held,
          total_wins: player.total_wins,
          total_losses: player.total_losses,
          win_rate: parseFloat(winRate),
          total_tokens_won: player.total_tokens_won,
          total_tokens_lost: player.total_tokens_lost,
          verified_at: player.verified_at,
          created_at: player.created_at,
          updated_at: player.updated_at
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('PvP player-stats error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching player stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
