import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, MAX_STEP, tierForStep, rollSurvives } from '@/lib/gameLogic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || '').trim();
    const roundId = (body.round_id || '').trim();

    if (!isValidSessionId(sessionId) || !roundId) {
      return new Response(JSON.stringify({ error: 'Invalid session or round' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: round } = await supabaseAdmin
      .from('game_rounds')
      .select('id, session_id, step, status')
      .eq('id', roundId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!round || round.status !== 'active') {
      return new Response(JSON.stringify({ error: 'No active round found.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (round.step >= MAX_STEP) {
      return new Response(JSON.stringify({ error: 'Already at the top of the ladder.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nextStep = round.step + 1;
    const survived = rollSurvives(nextStep);

    if (!survived) {
      await supabaseAdmin
        .from('game_rounds')
        .update({ status: 'busted', updated_at: new Date().toISOString() })
        .eq('id', roundId);

      return new Response(JSON.stringify({
        survived: false,
        busted: true,
        message: 'BUSTED! You lost this attempt - use another play to try again.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Survived. If this is the top rung (now FCFS - GTD has been
    // removed from the game), it auto-cashes unconditionally, since
    // FCFS has no live capacity tracking to check against.
    if (nextStep === MAX_STEP) {
      const finalTier = tierForStep(nextStep); // 'fcfs'

      await supabaseAdmin
        .from('game_rounds')
        .update({ step: nextStep, status: 'cashed', updated_at: new Date().toISOString() })
        .eq('id', roundId);

      await supabaseAdmin
        .from('game_sessions')
        .update({ won: true, won_tier: finalTier, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);

      return new Response(JSON.stringify({
        survived: true,
        step: nextStep,
        topOfLadder: true,
        tier: finalTier,
        message: `You reached the top! ${finalTier.toUpperCase()} spot secured.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await supabaseAdmin
      .from('game_rounds')
      .update({ step: nextStep, updated_at: new Date().toISOString() })
      .eq('id', roundId);

    return new Response(JSON.stringify({
      survived: true,
      step: nextStep,
      topOfLadder: false,
      tier: tierForStep(nextStep),
      message: `Survived! You're banked at ${tierForStep(nextStep).toUpperCase()} - cash out now or push your luck further.`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Round push API error:', err);
    return new Response(JSON.stringify({ error: 'Server error processing climb' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
