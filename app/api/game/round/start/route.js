import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId } from '@/lib/gameLogic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || '').trim();

    if (!isValidSessionId(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: session } = await supabaseAdmin
      .from('game_sessions')
      .select('plays_used, won, bonus_plays')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (session?.won) {
      return new Response(JSON.stringify({ error: 'This session already won - no more plays allowed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: existingActive } = await supabaseAdmin
      .from('game_rounds')
      .select('id, step, status')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingActive) {
      // Already mid-round - just return it instead of starting a new one.
      return new Response(JSON.stringify({ roundId: existingActive.id, step: existingActive.step }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { count: tokensEarned } = await supabaseAdmin
      .from('game_task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    const playsUsedSoFar = session?.plays_used || 0;
    const bonusPlays = session?.bonus_plays || 0;
    const playsAvailable = Math.max((tokensEarned || 0) + bonusPlays - playsUsedSoFar, 0);

    if (playsAvailable <= 0) {
      return new Response(JSON.stringify({ error: 'No plays left - complete tasks above to earn more.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Spend one play with an optimistic lock.
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({ plays_used: playsUsedSoFar + 1, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('plays_used', playsUsedSoFar)
      .select()
      .maybeSingle();

    if (updateError || !updatedSession) {
      // A concurrent request for the same session likely just consumed
      // the play and created the round - check for it instead of just
      // erroring out.
      const { data: raceRound } = await supabaseAdmin
        .from('game_rounds')
        .select('id, step, status')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle();

      if (raceRound) {
        return new Response(JSON.stringify({ roundId: raceRound.id, step: raceRound.step }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'A play is already being started - please try again.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: newRound, error: roundError } = await supabaseAdmin
      .from('game_rounds')
      .insert({ session_id: sessionId, step: 0, status: 'active' })
      .select()
      .single();

    if (roundError) {
      console.error('Round start error:', roundError);
      return new Response(JSON.stringify({ error: roundError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ roundId: newRound.id, step: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Round start API error:', err);
    return new Response(JSON.stringify({ error: 'Server error starting round' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
