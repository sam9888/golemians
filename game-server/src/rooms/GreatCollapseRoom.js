import Matter from 'matter-js';
import crypto from 'crypto';
import colyseusPkg from 'colyseus';
import { ArenaState, PlayerState, TileState } from '../schema/ArenaState.js';
import { verifyJoinToken } from '../auth/joinToken.js';
import { createPlayerBody, applyMovement, applyImpulse } from '../physics/playerPhysics.js';
import {
  buildTileGrid,
  getSpawnPoints,
  worldToTile,
  tileKey,
  COLLAPSE_PHASES,
  TILE_WARNING_MS,
  FALL_ELIMINATION_DELAY_MS,
  ARENA_RADIUS,
  MAP_ID,
} from '../../../shared/mapConfig/greatCollapse.js';
import {
  MAP1_IDEAL_PLAYERS,
  MAP1_DEFAULT_MIN_PLAYERS_TO_START,
  MATCH_COUNTDOWN_SECONDS,
  ABILITY_TUNING,
} from '../../../shared/arenaConfig.js';
import { INPUT_ACTIONS } from '../../../shared/inputActions.js';

const { Room } = colyseusPkg;

const TICK_MS = 50; // 20Hz authoritative simulation tick
const MATCH_END_DISPOSE_DELAY_MS = 8000; // lets clients show the winner screen

function clampAxis(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

// Consumes the outer-ring-first tile list front-to-back, per collapse
// phase's cumulative removal fraction, so each phase's newly-warned tiles
// are exactly the next ring(s) inward.
function computePhaseTileAssignments(allTiles) {
  const total = allTiles.length;
  let removedSoFar = 0;
  return COLLAPSE_PHASES.map((phase, idx) => {
    if (idx === 0) return [];
    const targetRemoved = Math.floor(total * phase.cumulativeFractionRemoved);
    const slice = allTiles.slice(removedSoFar, targetRemoved);
    removedSoFar = targetRemoved;
    return slice;
  });
}

async function reportSettlement(standings, matchId) {
  const url = process.env.ARENA_SETTLE_URL;
  const secret = process.env.GAME_SERVER_SECRET;
  if (!url || !secret) {
    console.error('[GreatCollapseRoom] Missing ARENA_SETTLE_URL or GAME_SERVER_SECRET; cannot report settlement');
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ matchId, mapId: MAP_ID, standings }),
    });
    if (!res.ok) {
      console.error('[GreatCollapseRoom] Settlement report failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[GreatCollapseRoom] Settlement report error:', err);
  }
}

// Defaults to the settle URL's sibling /refund route so existing deploys
// don't need a second env var, but ARENA_REFUND_URL wins if the two routes
// are ever hosted apart.
function refundUrl() {
  const explicit = process.env.ARENA_REFUND_URL;
  if (explicit) return explicit;
  const settleUrl = process.env.ARENA_SETTLE_URL;
  return settleUrl ? settleUrl.replace(/\/settle\/?$/, '/refund') : null;
}

// Returns the entry fee for a player who paid but left before the match
// actually began, so an abandoned lobby doesn't quietly cost them 500 GLM.
// The Next.js route is idempotent and re-derives the amount from the
// original ledger row, so a duplicate call here is harmless.
async function reportRefund(entryId, wallet) {
  const url = refundUrl();
  const secret = process.env.GAME_SERVER_SECRET;
  if (!entryId) return;
  if (!url || !secret) {
    console.error('[GreatCollapseRoom] Missing ARENA_SETTLE_URL/ARENA_REFUND_URL or GAME_SERVER_SECRET; cannot refund', entryId);
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ entryId, wallet }),
    });
    if (!res.ok) {
      console.error('[GreatCollapseRoom] Refund failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[GreatCollapseRoom] Refund error:', err);
  }
}

export class GreatCollapseRoom extends Room {
  onCreate() {
    this.maxClients = MAP1_IDEAL_PLAYERS;
    this.matchId = crypto.randomUUID();
    this.autoDispose = true;

    this.setState(new ArenaState());
    this.state.matchId = this.matchId;
    this.state.matchPhase = 'waiting';

    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

    this.playerBodies = new Map();
    this.inputState = new Map();
    this.abilityCooldowns = new Map();
    this.dashState = new Map();
    this.airborneUntil = new Map();
    this.fallState = new Map();
    // sessionId -> entryId of the paid entry that bought this seat. Kept
    // server-side rather than on PlayerState so it isn't broadcast to other
    // clients, and cleared once the match starts (at which point the fee has
    // been spent on a real match and is no longer refundable).
    this.entryIds = new Map();
    this.eliminationOrder = [];

    this.currentPhaseIndex = 0;
    this.phaseTileAssignments = [];
    this.tileWarningStartedAt = new Map();

    this.onMessage('move', (client, message) => this.handleMove(client, message));
    this.onMessage('action', (client, message) => this.handleAction(client, message));

    this.setSimulationInterval(() => this.tick(), TICK_MS);
  }

  async onAuth(client, options) {
    const { wallet, tokenId, entryId, characterName } = verifyJoinToken(options?.joinToken);

    const alreadySeated = [...this.state.players.values()].some((p) => p.walletAddress === wallet);
    if (alreadySeated) {
      throw new Error('This wallet already has a seat in this match');
    }
    if (this.state.matchPhase !== 'waiting' && this.state.matchPhase !== 'countdown') {
      throw new Error('This match has already started');
    }

    return { wallet, tokenId, entryId, characterName };
  }

  onJoin(client, options, auth) {
    const player = new PlayerState();
    player.walletAddress = auth.wallet;
    player.tokenId = auth.tokenId ?? 0;
    player.characterName = auth.characterName || '';
    this.state.players.set(client.sessionId, player);
    this.abilityCooldowns.set(client.sessionId, {});
    this.inputState.set(client.sessionId, { moveX: 0, moveY: 0 });
    if (auth.entryId) this.entryIds.set(client.sessionId, auth.entryId);

    this.maybeStartCountdown();
  }

  onLeave(client) {
    const state = this.state;
    const player = state.players.get(client.sessionId);
    if (!player) return;

    if (state.matchPhase === 'waiting' || state.matchPhase === 'countdown') {
      // Paid for a seat but left before the match began — return the fee.
      const entryId = this.entryIds.get(client.sessionId);
      this.entryIds.delete(client.sessionId);
      if (entryId) {
        reportRefund(entryId, player.walletAddress).catch((err) => {
          console.error('[GreatCollapseRoom] reportRefund threw:', err);
        });
      }

      state.players.delete(client.sessionId);
      this.inputState.delete(client.sessionId);
      this.abilityCooldowns.delete(client.sessionId);

      if (state.matchPhase === 'countdown' && state.players.size < MAP1_DEFAULT_MIN_PLAYERS_TO_START) {
        state.matchPhase = 'waiting';
        state.countdownEndsAt = 0;
      }
      return;
    }

    if (state.matchPhase === 'playing' && !player.isEliminated) {
      this.eliminatePlayer(client.sessionId, Date.now());
      this.checkWinCondition();
    }
  }

  maybeStartCountdown() {
    const state = this.state;
    if (state.matchPhase !== 'waiting') return;
    if (state.players.size < MAP1_DEFAULT_MIN_PLAYERS_TO_START) return;

    state.matchPhase = 'countdown';
    state.countdownEndsAt = Date.now() + MATCH_COUNTDOWN_SECONDS * 1000;
  }

  startMatch(now) {
    const state = this.state;
    state.matchPhase = 'playing';
    state.matchStartedAt = now;
    this.lock();

    // From here on the entry fees have bought an actual match, so leaving
    // mid-game is an elimination, not a refundable abandonment.
    this.entryIds.clear();

    const tiles = buildTileGrid();
    for (const tile of tiles) {
      const tileState = new TileState();
      tileState.key = tile.key;
      tileState.q = tile.q;
      tileState.r = tile.r;
      tileState.x = tile.x;
      tileState.y = tile.y;
      tileState.status = 'intact';
      state.tiles.set(tile.key, tileState);
    }

    this.currentPhaseIndex = 0;
    this.phaseTileAssignments = computePhaseTileAssignments(tiles);
    this.tileWarningStartedAt = new Map();

    const sessionIds = [...state.players.keys()];
    const spawnPoints = getSpawnPoints(sessionIds.length);
    sessionIds.forEach((sessionId, i) => {
      const player = state.players.get(sessionId);
      const spawn = spawnPoints[i];
      player.x = spawn.x;
      player.y = spawn.y;

      const body = createPlayerBody(spawn.x, spawn.y);
      Matter.Composite.add(this.engine.world, body);
      this.playerBodies.set(sessionId, body);
    });

    state.survivorCount = sessionIds.length;
  }

  tick() {
    const now = Date.now();
    const state = this.state;

    if (state.matchPhase === 'countdown') {
      if (now >= state.countdownEndsAt) this.startMatch(now);
      return;
    }
    if (state.matchPhase !== 'playing') return;

    for (const [sessionId, player] of state.players.entries()) {
      if (player.isEliminated) continue;
      const body = this.playerBodies.get(sessionId);
      if (!body) continue;

      player.isAirborne = now < (this.airborneUntil.get(sessionId) || 0);

      const dash = this.dashState.get(sessionId);
      if (dash && now < dash.untilMs) {
        applyMovement(body, dash.dirX, dash.dirY, TICK_MS / 1000, ABILITY_TUNING.DASH.speedMultiplier);
      } else {
        const input = this.inputState.get(sessionId) || { moveX: 0, moveY: 0 };
        applyMovement(body, input.moveX, input.moveY, TICK_MS / 1000);
      }
    }

    Matter.Engine.update(this.engine, TICK_MS);

    const maxDist = ARENA_RADIUS * 1.8;
    for (const [sessionId, player] of state.players.entries()) {
      if (player.isEliminated) continue;
      const body = this.playerBodies.get(sessionId);
      if (!body) continue;

      const dist = Math.hypot(body.position.x, body.position.y);
      if (dist > maxDist) {
        const scale = maxDist / dist;
        Matter.Body.setPosition(body, { x: body.position.x * scale, y: body.position.y * scale });
      }

      player.x = body.position.x;
      player.y = body.position.y;
      player.vx = body.velocity.x;
      player.vy = body.velocity.y;
    }

    this.advanceCollapsePhases(now);
    this.updateTileWarnings(now);
    this.checkEliminations(now);
    this.checkWinCondition();
  }

  advanceCollapsePhases(now) {
    const elapsed = now - this.state.matchStartedAt;
    while (
      this.currentPhaseIndex + 1 < COLLAPSE_PHASES.length &&
      elapsed >= COLLAPSE_PHASES[this.currentPhaseIndex + 1].startAtMs
    ) {
      this.currentPhaseIndex += 1;
      const tilesToWarn = this.phaseTileAssignments[this.currentPhaseIndex] || [];
      for (const tile of tilesToWarn) {
        const tileState = this.state.tiles.get(tile.key);
        if (tileState && tileState.status === 'intact') {
          tileState.status = 'warning';
          this.tileWarningStartedAt.set(tile.key, now);
        }
      }
    }
  }

  updateTileWarnings(now) {
    for (const [key, startedAt] of this.tileWarningStartedAt.entries()) {
      if (now - startedAt >= TILE_WARNING_MS) {
        const tileState = this.state.tiles.get(key);
        if (tileState && tileState.status === 'warning') {
          tileState.status = 'collapsed';
        }
        this.tileWarningStartedAt.delete(key);
      }
    }
  }

  checkEliminations(now) {
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isEliminated) continue;
      if (player.isAirborne) {
        this.fallState.delete(sessionId);
        continue;
      }

      const { q, r } = worldToTile(player.x, player.y);
      const tile = this.state.tiles.get(tileKey(q, r));
      const standingOnIntactTile = tile && tile.status !== 'collapsed';

      if (standingOnIntactTile) {
        this.fallState.delete(sessionId);
        continue;
      }

      const fallStartedAt = this.fallState.get(sessionId);
      if (!fallStartedAt) {
        this.fallState.set(sessionId, now);
      } else if (now - fallStartedAt >= FALL_ELIMINATION_DELAY_MS) {
        this.eliminatePlayer(sessionId, now);
      }
    }
  }

  eliminatePlayer(sessionId) {
    const player = this.state.players.get(sessionId);
    if (!player || player.isEliminated) return;
    player.isEliminated = true;
    this.fallState.delete(sessionId);
    this.eliminationOrder.push(sessionId);

    const body = this.playerBodies.get(sessionId);
    if (body) Matter.Body.setStatic(body, true);
  }

  checkWinCondition() {
    const state = this.state;
    if (state.matchPhase !== 'playing') return;

    const survivors = [...state.players.entries()].filter(([, p]) => !p.isEliminated);
    state.survivorCount = survivors.length;
    if (survivors.length > 1) return;

    let winnerSessionId = null;
    if (survivors.length === 1) {
      winnerSessionId = survivors[0][0];
    } else if (this.eliminationOrder.length > 0) {
      winnerSessionId = this.eliminationOrder[this.eliminationOrder.length - 1];
    }
    if (!winnerSessionId) return;

    this.finishMatch(winnerSessionId);
  }

  finishMatch(winnerSessionId) {
    const state = this.state;
    const now = Date.now();
    state.matchPhase = 'ended';
    state.matchEndedAt = now;

    const winner = state.players.get(winnerSessionId);
    if (winner) {
      winner.placement = 1;
      state.winnerWallet = winner.walletAddress;
      state.winnerTokenId = winner.tokenId;
      state.winnerCharacterName = winner.characterName || '';
    }

    let place = 2;
    for (let i = this.eliminationOrder.length - 1; i >= 0; i--) {
      const sessionId = this.eliminationOrder[i];
      if (sessionId === winnerSessionId) continue;
      const p = state.players.get(sessionId);
      if (p) p.placement = place++;
    }

    const standings = [...state.players.entries()]
      .map(([, p]) => ({ wallet: p.walletAddress, tokenId: p.tokenId, placement: p.placement }))
      .filter((s) => s.placement > 0)
      .sort((a, b) => a.placement - b.placement);

    reportSettlement(standings, this.matchId).catch((err) => {
      console.error('[GreatCollapseRoom] reportSettlement threw:', err);
    });

    this.clock.setTimeout(() => this.disconnect(), MATCH_END_DISPOSE_DELAY_MS);
  }

  handleMove(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.isEliminated || this.state.matchPhase !== 'playing') return;
    this.inputState.set(client.sessionId, {
      moveX: clampAxis(message?.x),
      moveY: clampAxis(message?.y),
    });
  }

  handleAction(client, message) {
    const state = this.state;
    const player = state.players.get(client.sessionId);
    if (!player || player.isEliminated || state.matchPhase !== 'playing') return;

    const type = message?.type;
    const isKnownAction = [
      INPUT_ACTIONS.JUMP,
      INPUT_ACTIONS.DASH,
      INPUT_ACTIONS.PUSH,
      INPUT_ACTIONS.GRAB,
      INPUT_ACTIONS.GROUND_SLAM,
    ].includes(type);
    if (!isKnownAction) return;

    const tuning = ABILITY_TUNING[type];
    const cooldowns = this.abilityCooldowns.get(client.sessionId) || {};
    const now = Date.now();
    if (now - (cooldowns[type] || 0) < tuning.cooldownMs) return;
    cooldowns[type] = now;
    this.abilityCooldowns.set(client.sessionId, cooldowns);

    const body = this.playerBodies.get(client.sessionId);
    if (!body) return;

    if (type === INPUT_ACTIONS.JUMP) {
      this.airborneUntil.set(client.sessionId, now + tuning.airborneMs);
      return;
    }

    if (type === INPUT_ACTIONS.DASH) {
      const input = this.inputState.get(client.sessionId) || { moveX: 0, moveY: 0 };
      const mag = Math.hypot(input.moveX, input.moveY);
      const dir = mag > 0.05 ? { x: input.moveX / mag, y: input.moveY / mag } : { x: 1, y: 0 };
      this.dashState.set(client.sessionId, { untilMs: now + tuning.durationMs, dirX: dir.x, dirY: dir.y });
      return;
    }

    if (type === INPUT_ACTIONS.PUSH) {
      this.applyAreaEffect(client.sessionId, { x: body.position.x, y: body.position.y }, tuning.range, tuning.knockback, 'push');
      return;
    }

    if (type === INPUT_ACTIONS.GRAB) {
      this.applyAreaEffect(client.sessionId, { x: body.position.x, y: body.position.y }, tuning.range, tuning.pull, 'pull');
      return;
    }

    if (type === INPUT_ACTIONS.GROUND_SLAM) {
      // Brief telegraphed startup: the epicenter is captured now, so a
      // target that dashes away mid-startup correctly escapes the blast.
      const point = { x: body.position.x, y: body.position.y };
      this.clock.setTimeout(() => {
        this.applyAreaEffect(client.sessionId, point, tuning.range, tuning.knockback, 'push');
      }, tuning.startupMs);
    }
  }

  applyAreaEffect(sourceSessionId, sourcePoint, range, strength, mode) {
    const now = Date.now();
    for (const [sessionId, player] of this.state.players.entries()) {
      if (sessionId === sourceSessionId || player.isEliminated) continue;
      if (now < (this.airborneUntil.get(sessionId) || 0)) continue;

      const targetBody = this.playerBodies.get(sessionId);
      if (!targetBody) continue;

      const dist = Math.hypot(targetBody.position.x - sourcePoint.x, targetBody.position.y - sourcePoint.y);
      if (dist > range) continue;

      applyImpulse(targetBody, sourcePoint, strength, mode);
    }
  }
}
