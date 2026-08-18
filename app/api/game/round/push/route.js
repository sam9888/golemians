import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, MAX_STEP, tierForStep, rollSurvives } from '@/lib/gameLogic';

async function isGtdFull() {
  const { data: statsRow } = await supabaseAdmin
    .from('project_stats')
    .select('base_claimed_count, total_spots')
    .eq('id', 'gtd')
    .single();

  const totalSpots = statsRow?.total_spots ?? 1500;
  const baseClaimed = statsRow?.base_claimed_count ?? 0;

  const { count: approvedCount } = await supabaseAdmin
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .or('claimed.eq.true,status.eq.approved,status.eq.allocated,status.eq.winner');

  return baseClaimed + (approvedCount || 0) >= totalSpots;
}

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

    // Survived. If this is the top rung, auto-cash as GTD - unless GTD
    // is already full, in which case gracefully bank whatever tier they
    // already had (the previous step) instead of granting a spot that
    // doesn't exist.
    if (nextStep === MAX_STEP) {
      let finalTier = tierForStep(nextStep); // 'gtd'
      if (await isGtdFull()) {
        finalTier = round.step > 0 ? tierForStep(round.step) : null;
      }

      await supabaseAdmin
        .from('game_rounds')
        .update({ step: nextStep, status: 'cashed', updated_at: new Date().toISOString() })
        .eq('id', roundId);

      if (finalTier) {
        await supabaseAdmin
          .from('game_sessions')
          .update({ won: true, won_tier: finalTier, updated_at: new Date().toISOString() })
          .eq('session_id', sessionId);
      }

      return new Response(JSON.stringify({
        survived: true,
        step: nextStep,
        topOfLadder: true,
        tier: finalTier,
        message: finalTier
          ? `You reached the top! ${finalTier.toUpperCase()} spot secured.`
          : 'You reached the top, but GTD is full - no spot available.'
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
