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

export function isValidTweetUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname) && u.pathname.includes('/status/');
  } catch {
    return false;
  }
}

// Uses X's public oEmbed endpoint (no API key/auth needed) to confirm a
// tweet URL is real, publicly viewable, and actually mentions Golemians.
// This can't prove it's technically a *quote* tweet rather than a plain
// mention, but it rules out the common case of submitting a fake/empty
// link without posting anything.
export async function verifyQuoteTweet(tweetUrl) {
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) {
      return { ok: false, reason: 'Could not find that tweet - check the link and make sure it is public.' };
    }
    const data = await res.json();
    const html = (data.html || '').toLowerCase();
    if (!html.includes('golemians')) {
      return { ok: false, reason: 'That tweet does not appear to mention Golemians.' };
    }
    return { ok: true, authorName: data.author_name || null };
  } catch (err) {
    console.error('Tweet verification error:', err);
    return { ok: false, reason: 'Could not verify that tweet right now - please try again.' };
  }
}
