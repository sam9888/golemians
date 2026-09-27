import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { STEP_INFO, rollSurvives, MAX_STEP } from '@/lib/gameLogic';
import { determineMatchWinner, calculateTokenTransfer } from '@/lib/pvpLogic';
import { checkRateLimit } from '@/lib/rateLimit';
import { requireSessionResponse } from '@/lib/session';

export async function POST(request) {
  try {
    const { match_id, action, wallet_address } = await request.json();

    if (!wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet_address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authError = requireSessionResponse(request, wallet_address);
    if (authError) return authError;

    const normalizedWallet = wallet_address.toLowerCase();

    const rateCheck = checkRateLimit(`play_match_${normalizedWallet}`, 120, 3600);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Try again later.', retryAfter: rateCheck.retryAfter }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': rateCheck.retryAfter } }
      );
    }

    // Fetch match
    const { data: match, error: matchError } = await supabaseAdmin
      .from('pvp_matches')
      .select('*')
      .eq('id', match_id)
      .single();

    if (matchError || !match) {
      return new Response(
        JSON.stringify({ error: 'Match not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is actually a participant in this match
    const { data: participants } = await supabaseAdmin
      .from('pvp_players')
      .select('id, wallet_address')
      .in('id', [match.player1_id, match.player2_id]);

    const isParticipant = participants?.some(p => p.wallet_address === normalizedWallet);
    if (!isParticipant) {
      return new Response(
        JSON.stringify({ error: 'You are not a participant in this match' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (match.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Match is not active' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // action: 'climb', 'cashout', or 'step_results'
    if (action === 'climb') {
      // Both players attempt to climb: flip for each, advance if survive
      const p1Survives = rollSurvives(match.player1_final_step + 1);
      const p2Survives = rollSurvives(match.player2_final_step + 1);

      const p1Step = p1Survives ? Math.min(match.player1_final_step + 1, MAX_STEP) : match.player1_final_step;
      const p2Step = p2Survives ? Math.min(match.player2_final_step + 1, MAX_STEP) : match.player2_final_step;

      const { error: updateError } = await supabaseAdmin
        .from('pvp_matches')
        .update({
          player1_final_step: p1Step,
          player2_final_step: p2Step,
          updated_at: new Date().toISOString()
        })
        .eq('id', match_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          ok: true,
          player1_step: p1Step,
          player2_step: p2Step,
          player1_survived: p1Survives,
          player2_survived: p2Survives,
          at_top: p1Step === MAX_STEP || p2Step === MAX_STEP
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cashout' || action === 'finish') {
      // Determine winner and transfer tokens
      const winner = determineMatchWinner(match.player1_final_step, match.player2_final_step);

      if (winner === 'tie') {
        // Draw: no transfer
        const { error: drawError } = await supabaseAdmin
          .from('pvp_matches')
          .update({ status: 'draw', completed_at: new Date().toISOString() })
          .eq('id', match_id);

        if (drawError) throw drawError;

        return new Response(
          JSON.stringify({
            ok: true,
            result: 'draw',
            player1_step: match.player1_final_step,
            player2_step: match.player2_final_step
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const winnerId = winner === 'player1' ? match.player1_id : match.player2_id;
      const loserId = winner === 'player1' ? match.player2_id : match.player1_id;

      // Fetch players for token amounts
      const { data: players, error: playerError } = await supabaseAdmin
        .from('pvp_players')
        .select('id, tokens_held')
        .in('id', [winnerId, loserId]);

      if (playerError || !players || players.length < 2) throw playerError;

      const loserData = players.find(p => p.id === loserId);
      const tokensTransferred = calculateTokenTransfer(loserData.tokens_held, match.stake_amount);

      // Update match
      const { error: matchUpdateError } = await supabaseAdmin
        .from('pvp_matches')
        .update({
          winner_id: winnerId,
          tokens_transferred: tokensTransferred,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', match_id);

      if (matchUpdateError) throw matchUpdateError;

      // Update winner
      const { error: winnerError } = await supabaseAdmin
        .from('pvp_players')
        .update({
          total_wins: supabaseAdmin.rpc('increment', { increment_by: 1 }),
          tokens_held: supabaseAdmin.rpc('increment', { increment_by: tokensTransferred }),
          total_tokens_won: supabaseAdmin.rpc('increment', { increment_by: tokensTransferred }),
          updated_at: new Date().toISOString()
        })
        .eq('id', winnerId);

      // Update loser
      const { error: loserError } = await supabaseAdmin
        .from('pvp_players')
        .update({
          total_losses: supabaseAdmin.rpc('increment', { increment_by: 1 }),
          tokens_held: supabaseAdmin.rpc('decrement', { decrement_by: tokensTransferred }),
          total_tokens_lost: supabaseAdmin.rpc('increment', { increment_by: tokensTransferred }),
          updated_at: new Date().toISOString()
        })
        .eq('id', loserId);

      // Record transfer
      const { error: transferError } = await supabaseAdmin
        .from('pvp_token_transfers')
        .insert({
          match_id,
          from_player_id: loserId,
          to_player_id: winnerId,
          amount: tokensTransferred,
          reason: `PvP Match - Loser of PvP duel (stake: ${match.stake_amount})`
        });

      if (transferError) console.error('Transfer logging error:', transferError);

      return new Response(
        JSON.stringify({
          ok: true,
          result: 'completed',
          winner: winner,
          tokens_transferred: tokensTransferred,
          player1_final_step: match.player1_final_step,
          player2_final_step: match.player2_final_step
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('PvP play-match error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error processing match', debug: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
