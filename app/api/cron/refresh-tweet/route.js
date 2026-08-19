import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Runs once a day via Vercel Cron (see vercel.json). Pulls the account's
// most recent original tweet (excludes replies/retweets) from the X API
// and caches it in Supabase. If X_BEARER_TOKEN isn't set yet, this is a
// harmless no-op - the site just keeps using the manual daily_tweets
// rotation until credentials are added.

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // no secret configured yet - allow (dev/testing)
  const provided = request.headers.get('authorization');
  return provided === `Bearer ${cronSecret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const bearerToken = process.env.X_BEARER_TOKEN;
  const username = process.env.X_USERNAME || 'golemians';

  if (!bearerToken) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: 'X_BEARER_TOKEN not configured yet - site is using the manual tweet rotation.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Look up the account's user ID.
    const userRes = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${bearerToken}` }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('X user lookup failed:', userRes.status, errText);
      return new Response(JSON.stringify({ error: `X user lookup failed: ${userRes.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = await userRes.json();
    const userId = userData?.data?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Could not resolve X user ID' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Fetch the most recent original tweet (no replies, no retweets).
    const tweetsRes = await fetch(
      `https://api.x.com/2/users/${userId}/tweets?max_results=5&exclude=retweets,replies`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );

    if (!tweetsRes.ok) {
      const errText = await tweetsRes.text();
      console.error('X tweets fetch failed:', tweetsRes.status, errText);
      return new Response(JSON.stringify({ error: `X tweets fetch failed: ${tweetsRes.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tweetsData = await tweetsRes.json();
    const latestTweet = tweetsData?.data?.[0];

    if (!latestTweet?.id) {
      return new Response(JSON.stringify({ error: 'No recent tweets found for this account' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tweetUrl = `https://x.com/${username}/status/${latestTweet.id}`;

    const { error: upsertError } = await supabaseAdmin
      .from('auto_tweet_cache')
      .upsert({
        id: 'current',
        tweet_url: tweetUrl,
        tweet_id: latestTweet.id,
        fetched_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Auto tweet cache upsert error:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, tweetUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Refresh tweet cron error:', err);
    return new Response(JSON.stringify({ error: 'Server error refreshing tweet' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
