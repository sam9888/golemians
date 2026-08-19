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

    // Guarantee a game_sessions row exists, regardless of whether the
    // task route's own upsert succeeded earlier - this endpoint should
    // never depend on that having worked.
    const { error: ensureSessionError } = await supabaseAdmin
      .from('game_sessions')
      .upsert(
        { session_id: sessionId },
        { onConflict: 'session_id', ignoreDuplicates: true }
      );

    if (ensureSessionError) {
      console.error('Failed to ensure game_sessions row exists:', ensureSessionError);
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

    const { data: existingActiveRows } = await supabaseAdmin
      .from('game_rounds')
      .select('id, step, status')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const existingActive = existingActiveRows?.[0] || null;

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
      // A concurrent request for the same session likely just won this
      // race and is in the middle of creating its round - that INSERT
      // hasn't necessarily committed yet at this exact instant, so give
      // it a few short retries instead of checking only once.
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const { data: raceRoundRows } = await supabaseAdmin
          .from('game_rounds')
          .select('id, step, status')
          .eq('session_id', sessionId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        const raceRound = raceRoundRows?.[0] || null;

        if (raceRound) {
          return new Response(JSON.stringify({ roundId: raceRound.id, step: raceRound.step }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        error: 'A play is already being started - please try again.',
        debug: { playsUsedSoFar, playsAvailable, tokensEarned, bonusPlays, sessionWon: session?.won || false }
      }), {
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
      // The play was already marked as spent above, but no round got
      // created for it - roll that back so it isn't silently lost.
      await supabaseAdmin
        .from('game_sessions')
        .update({ plays_used: playsUsedSoFar, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('plays_used', playsUsedSoFar + 1);

      return new Response(JSON.stringify({ error: 'Could not start the round - your play was not spent, please try again.' }), {
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
