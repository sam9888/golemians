import { supabaseAdmin } from '@/lib/supabaseAdmin';

const EPOCH = Date.UTC(2026, 0, 1); // Jan 1 2026 UTC - arbitrary fixed reference point
const DAY_MS = 24 * 60 * 60 * 1000;

const FALLBACK_URL = 'https://x.com/golemians/status/2087073858809446418?s=20';

export async function GET() {
  try {
    const { data: tweets, error } = await supabaseAdmin
      .from('daily_tweets')
      .select('tweet_url')
      .order('sort_order', { ascending: true });

    if (error || !tweets || tweets.length === 0) {
      return new Response(JSON.stringify({ tweetUrl: FALLBACK_URL, index: 0, total: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const daysSinceEpoch = Math.floor((Date.now() - EPOCH) / DAY_MS);
    const index = ((daysSinceEpoch % tweets.length) + tweets.length) % tweets.length;

    return new Response(JSON.stringify({
      tweetUrl: tweets[index].tweet_url,
      index,
      total: tweets.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Daily tweet error:', err);
    return new Response(JSON.stringify({ tweetUrl: FALLBACK_URL, index: 0, total: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
