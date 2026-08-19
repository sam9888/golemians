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

    // Everything - creating the session row if missing, checking won
    // status, checking for an in-progress round, checking play
    // availability, and spending a play - happens atomically inside
    // this one database function call. No separate read-then-write
    // steps from here, so there's no window for two requests to race
    // each other or for a play to be spent without a round to show
    // for it.
    const { data, error } = await supabaseAdmin.rpc('start_game_round', {
      p_session_id: sessionId
    });

    if (error) {
      console.error('start_game_round RPC error:', error);
      return new Response(JSON.stringify({
        error: 'Server error starting round.',
        debug: { rpcErrorCode: error.code || null, rpcErrorMsg: error.message || null }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const row = data?.[0];

    if (!row) {
      return new Response(JSON.stringify({ error: 'Server error starting round - no result returned.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (row.error_msg) {
      return new Response(JSON.stringify({ error: row.error_msg }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ roundId: row.round_id, step: row.step }), {
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
