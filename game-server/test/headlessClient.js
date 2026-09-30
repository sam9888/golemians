import crypto from 'crypto';
import { Client } from 'colyseus.js';

// Minimal 2-player smoke test for the great_collapse room: mints join tokens
// the same way lib/arena/joinToken.js does (HMAC-SHA256 over a base64url
// JSON payload), joins two clients, waits out the countdown, sends input for
// one player, and prints state snapshots so a human can eyeball that the
// match actually progresses (waiting -> countdown -> playing, position
// changing in response to input).

const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'ws://localhost:2567';
const secret = process.env.GAME_SERVER_SECRET;

if (!secret) {
  console.error('[test:client] GAME_SERVER_SECRET is not set - check game-server/.env');
  process.exit(1);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createJoinToken({ wallet, tokenId = null, entryId, characterName = null }) {
  const payload = base64url(JSON.stringify({
    wallet: wallet.toLowerCase(),
    tokenId,
    entryId,
    characterName,
    exp: Date.now() + 60_000,
  }));
  return `${payload}.${sign(payload)}`;
}

function snapshotState(room, label) {
  const state = room.state;
  const me = state?.players?.get(room.sessionId);
  const pos = me ? { x: Math.round(me.x), y: Math.round(me.y), airborne: me.isAirborne, eliminated: me.isEliminated } : 'n/a';
  console.log(`[${label}] phase=${state?.matchPhase} survivors=${state?.survivorCount} countdownEndsAt=${state?.countdownEndsAt} me=${JSON.stringify(pos)}`);
}

async function joinPlayer(label, walletSuffix) {
  const client = new Client(GAME_SERVER_URL);
  const joinToken = createJoinToken({
    wallet: `0x${'0'.repeat(39)}${walletSuffix}`,
    entryId: crypto.randomUUID(),
    characterName: `Test${label}`,
  });

  const room = await client.joinOrCreate('great_collapse', { joinToken });
  console.log(`[${label}] joined room ${room.id} as ${room.sessionId}`);
  room.onError((code, message) => console.error(`[${label}] room error`, code, message));
  return { client, room };
}

async function main() {
  console.log(`[test:client] connecting 2 players to ${GAME_SERVER_URL} ...`);

  const p1 = await joinPlayer('P1', '1');
  const p2 = await joinPlayer('P2', '2');

  snapshotState(p1.room, 'P1 @join');

  console.log('[test:client] waiting for countdown to elapse (~10s)...');
  await new Promise((resolve) => setTimeout(resolve, 11_000));
  snapshotState(p1.room, 'P1 @after-countdown');
  snapshotState(p2.room, 'P2 @after-countdown');

  console.log('[test:client] sending movement + jump for P1...');
  p1.room.send('move', { x: 1, y: 0 });
  p1.room.send('action', { type: 'JUMP' });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  snapshotState(p1.room, 'P1 @after-move-1s');

  p1.room.send('move', { x: 0, y: 0 });
  p1.room.leave();
  p2.room.leave();

  console.log('[test:client] done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test:client] FAILED:', err);
  process.exit(1);
});
