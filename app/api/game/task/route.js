import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, TASK_KEYS } from '@/lib/gameLogic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || '').trim();
    const taskKey = (body.task || '').trim();

    if (!isValidSessionId(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!TASK_KEYS.includes(taskKey)) {
      return new Response(JSON.stringify({ error: 'Unknown task' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('game_task_completions')
      .insert({ session_id: sessionId, task_key: taskKey });

    // Ignore unique-violation (already completed) - not a real error.
    if (insertError && insertError.code !== '23505') {
      console.error('Game task insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure a game_sessions row exists so play tracking has something to update.
    await supabaseAdmin
      .from('game_sessions')
      .upsert(
        { session_id: sessionId, updated_at: new Date().toISOString() },
        { onConflict: 'session_id', ignoreDuplicates: true }
      );

    const { data: completions } = await supabaseAdmin
      .from('game_task_completions')
      .select('task_key')
      .eq('session_id', sessionId);

    return new Response(JSON.stringify({
      success: true,
      completedTasks: (completions || []).map((c) => c.task_key)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Game task API error:', err);
    return new Response(JSON.stringify({ error: 'Server error recording task' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
