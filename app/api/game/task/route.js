import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, TASK_KEYS, isValidTweetUrl, verifyQuoteTweet } from '@/lib/gameLogic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || '').trim();
    const taskKey = (body.task || '').trim();
    const tweetUrl = (body.tweetUrl || '').trim();
    const ref = (body.ref || '').trim();

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

    // The quote task requires an actual tweet link, verified against
    // X's public oEmbed endpoint - not just an honor-system click.
    if (taskKey === 'quote') {
      if (!isValidTweetUrl(tweetUrl)) {
        return new Response(JSON.stringify({ error: 'Paste a valid X/Twitter tweet link.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const verification = await verifyQuoteTweet(tweetUrl);
      if (!verification.ok) {
        return new Response(JSON.stringify({ error: verification.reason }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Ensure a game_sessions row exists for this session.
    await supabaseAdmin
      .from('game_sessions')
      .upsert(
        { session_id: sessionId, updated_at: new Date().toISOString() },
        { onConflict: 'session_id', ignoreDuplicates: true }
      );

    // Record the referrer, only once, only if it's a different valid session.
    let referredBy = null;
    if (ref && isValidSessionId(ref) && ref !== sessionId) {
      const { data: existingSession } = await supabaseAdmin
        .from('game_sessions')
        .select('referred_by')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingSession && !existingSession.referred_by) {
        await supabaseAdmin
          .from('game_sessions')
          .update({ referred_by: ref })
          .eq('session_id', sessionId);
        referredBy = ref;
      } else {
        referredBy = existingSession?.referred_by || null;
      }
    }

    const { count: tasksBeforeCount } = await supabaseAdmin
      .from('game_task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

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

    const isFirstEverCompletion = (tasksBeforeCount || 0) === 0 && !insertError;

    // Grant the referrer 1 bonus play, once, the first time this
    // referred session completes any task.
    if (isFirstEverCompletion) {
      const { data: sessionRow } = await supabaseAdmin
        .from('game_sessions')
        .select('referred_by, referral_bonus_granted')
        .eq('session_id', sessionId)
        .maybeSingle();

      const effectiveReferrer = referredBy || sessionRow?.referred_by;

      if (effectiveReferrer && !sessionRow?.referral_bonus_granted) {
        const { data: referrerRow } = await supabaseAdmin
          .from('game_sessions')
          .select('bonus_plays')
          .eq('session_id', effectiveReferrer)
          .maybeSingle();

        if (referrerRow) {
          await supabaseAdmin
            .from('game_sessions')
            .update({ bonus_plays: (referrerRow.bonus_plays || 0) + 1, updated_at: new Date().toISOString() })
            .eq('session_id', effectiveReferrer);
        }

        await supabaseAdmin
          .from('game_sessions')
          .update({ referral_bonus_granted: true, updated_at: new Date().toISOString() })
          .eq('session_id', sessionId);
      }
    }

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
