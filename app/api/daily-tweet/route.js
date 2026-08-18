import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDailyTweetUrl } from '@/lib/gameLogic';

export async function GET() {
  const tweetUrl = await getDailyTweetUrl(supabaseAdmin);
  return new Response(JSON.stringify({ tweetUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
