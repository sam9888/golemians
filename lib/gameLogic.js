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
