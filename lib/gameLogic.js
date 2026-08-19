export function isValidSessionId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(id.trim());
}

export function isValidEvm(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export function isValidHandle(h) {
  return typeof h === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(h.trim().replace(/^@/, ''));
}

export const TASK_KEYS = ['follow', 'retweet', 'quote'];

// Ladder: step 0 = nothing banked. Climbing to step 1/2/3 requires
// surviving that step's roll. Step 3 is the top - reaching it is an
// automatic GTD win, no further pushing possible.
//
// These per-step survival probabilities are chosen so that, for a
// player who always pushes as far as possible, the overall odds work
// out to roughly: GTD 3%, FCFS 7%, Public 15%, nothing 75% - the same
// figures used elsewhere on the site.
export const STEP_INFO = {
  1: { tier: 'public', multiplier: '2x', survivalChance: 0.25 },
  2: { tier: 'fcfs', multiplier: '5x', survivalChance: 0.40 },
  3: { tier: 'gtd', multiplier: '10x', survivalChance: 0.30 }
};

export const MAX_STEP = 3;

export function tierForStep(step) {
  return STEP_INFO[step]?.tier || null;
}

export function rollSurvives(step) {
  const info = STEP_INFO[step];
  if (!info) return false;
  return Math.random() < info.survivalChance;
}

export const FALLBACK_TWEET_URL = 'https://x.com/golemians/status/2087073858809446418?s=20';
const DAILY_EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_FRESHNESS_MS = 26 * 60 * 60 * 1000; // a bit over 24h, tolerates the cron running slightly late

// Shared with app/api/daily-tweet so the task route can verify a quote
// submission against whichever tweet is actually live today, not a
// hardcoded one. Prefers a real tweet auto-pulled from X (via the
// scheduled cron job) if it's fresh; falls back to the manually
// maintained rotation list, then to a hardcoded URL if neither exists.
export async function getDailyTweetUrl(supabaseAdmin) {
  try {
    const { data: cached } = await supabaseAdmin
      .from('auto_tweet_cache')
      .select('tweet_url, fetched_at')
      .eq('id', 'current')
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_FRESHNESS_MS) {
      return cached.tweet_url;
    }

    const { data: tweets, error } = await supabaseAdmin
      .from('daily_tweets')
      .select('tweet_url')
      .order('sort_order', { ascending: true });

    if (error || !tweets || tweets.length === 0) {
      return FALLBACK_TWEET_URL;
    }

    const daysSinceEpoch = Math.floor((Date.now() - DAILY_EPOCH) / DAY_MS);
    const index = ((daysSinceEpoch % tweets.length) + tweets.length) % tweets.length;
    return tweets[index].tweet_url;
  } catch {
    return FALLBACK_TWEET_URL;
  }
}

export function isValidTweetUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname) && u.pathname.includes('/status/');
  } catch {
    return false;
  }
}

// Pulls the numeric tweet ID out of any twitter.com/x.com status URL, so
// two different-looking links to the same tweet can be compared.
export function extractTweetId(url) {
  try {
    const u = new URL(url.trim());
    const match = u.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Uses X's public oEmbed endpoint (no API key/auth needed) to confirm a
// tweet URL is real, publicly viewable, actually mentions Golemians, is
// not just the original promoted tweet pasted back, and is not posted
// by the @golemians account itself (a genuine quote-tweet task submission
// should come from a fan's account, not the project's own account).
// This can't prove it's technically a *quote* tweet vs a plain mention,
// but it closes the two easiest ways to fake this task for free.
export async function verifyQuoteTweet(tweetUrl, targetTweetUrl) {
  try {
    const submittedId = extractTweetId(tweetUrl);
    const targetId = targetTweetUrl ? extractTweetId(targetTweetUrl) : null;

    if (submittedId && targetId && submittedId === targetId) {
      return { ok: false, reason: 'That\'s the original tweet - paste the link to YOUR quote tweet instead.' };
    }

    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) {
      return { ok: false, reason: 'Could not find that tweet - check the link and make sure it is public.' };
    }
    const data = await res.json();
    const html = (data.html || '').toLowerCase();
    const authorName = (data.author_name || '').toLowerCase();
    const authorUrl = (data.author_url || '').toLowerCase();

    if (authorName === 'golemians' || authorUrl.includes('/golemians')) {
      return { ok: false, reason: 'That tweet is from the official Golemians account - paste your own quote tweet instead.' };
    }

    if (!html.includes('golemians')) {
      return { ok: false, reason: 'That tweet does not appear to mention Golemians.' };
    }

    return { ok: true, authorName: data.author_name || null };
  } catch (err) {
    console.error('Tweet verification error:', err);
    return { ok: false, reason: 'Could not verify that tweet right now - please try again.' };
  }
}
