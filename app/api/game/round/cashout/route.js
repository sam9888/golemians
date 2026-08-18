import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, tierForStep } from '@/lib/gameLogic';

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

    if (round.step < 1) {
      return new Response(JSON.stringify({ error: 'Nothing banked yet - climb at least one rung first.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tier = tierForStep(round.step);

    await supabaseAdmin
      .from('game_rounds')
      .update({ status: 'cashed', updated_at: new Date().toISOString() })
      .eq('id', roundId);

    await supabaseAdmin
      .from('game_sessions')
      .update({ won: true, won_tier: tier, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    return new Response(JSON.stringify({
      tier,
      message: `Cashed out! ${tier.toUpperCase()} spot secured.`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Round cashout API error:', err);
    return new Response(JSON.stringify({ error: 'Server error processing cash out' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
