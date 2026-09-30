// Economy, match-sizing, and ability-tuning constants shared by the Next.js
// app and the Colyseus match server. Deliberately free of `process.env`
// reads so this file is safe to import from client bundles, API routes, and
// game-server/ alike.

export const MIN_GOLEMIANS_TO_PLAY = 10;
export const MIN_GOLEMIANS_FOR_DAILY_CLAIM = 10;

export const DAILY_CLAIM_AMOUNT_GLM = 1000;
export const MATCH_ENTRY_GLM = 500;
export const MATCH_WINNER_GLM = 3000;
export const DAILY_CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const MAP1_IDEAL_PLAYERS = 8;
export const MAP1_DEFAULT_MIN_PLAYERS_TO_START = 2;
export const MATCH_COUNTDOWN_SECONDS = 10;

// How long a signed join token is valid for after Vercel mints it. Short
// enough to make a leaked/replayed token low-value, long enough to survive
// the redirect + WebSocket handshake to the match server.
export const JOIN_TOKEN_TTL_SECONDS = 60;

// Player movement + ability tuning. Not spec-sourced (missing sections) —
// concrete, playable defaults chosen so all 7 InputManager actions have a
// real, testable gameplay effect rather than being stubbed.
export const PLAYER_RADIUS = 14;
export const PLAYER_MOVE_SPEED = 220; // px/sec

// Impulse/knockback strengths live in the same "px added to velocity per
// tick" unit space as movement (see game-server/src/physics), not raw
// Matter.js force units — roughly comparable to PLAYER_MOVE_SPEED * tickSeconds.
export const ABILITY_TUNING = Object.freeze({
  JUMP: { cooldownMs: 600, airborneMs: 500 },
  DASH: { cooldownMs: 1200, durationMs: 180, speedMultiplier: 3 },
  PUSH: { cooldownMs: 800, range: 60, knockback: 14 },
  GRAB: { cooldownMs: 1000, range: 70, pull: 10 },
  GROUND_SLAM: { cooldownMs: 2000, range: 90, knockback: 18, startupMs: 200 },
});
