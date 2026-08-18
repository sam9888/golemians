import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, TASK_KEYS } from '@/lib/gameLogic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!isValidSessionId(sessionId)) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { data: completions } = await supabaseAdmin
      .from('game_task_completions')
      .select('task_key')
      .eq('session_id', sessionId);

    const { data: session } = await supabaseAdmin
      .from('game_sessions')
      .select('plays_used, won, won_tier, claimed, bonus_plays')
      .eq('session_id', sessionId)
      .maybeSingle();

    const { data: activeRound } = await supabaseAdmin
      .from('game_rounds')
      .select('id, step, status')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    const completedTasks = (completions || []).map((c) => c.task_key);
    const tokensEarned = completedTasks.length;
    const playsUsed = session?.plays_used || 0;
    const bonusPlays = session?.bonus_plays || 0;
    const playsAvailable = Math.max(tokensEarned + bonusPlays - playsUsed, 0);

    return new Response(JSON.stringify({
      completedTasks,
      allTasks: TASK_KEYS,
      playsAvailable,
      bonusPlays,
      won: session?.won || false,
      wonTier: session?.won_tier || null,
      claimed: session?.claimed || false,
      activeRound: activeRound || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Game status error:', err);
    return new Response(JSON.stringify({ error: 'Server error fetching game status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
