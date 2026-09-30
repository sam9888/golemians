// Map 1: "The Great Collapse" — a circular arena of floor tiles that shake,
// crack, glow red, and collapse across 4 phases. Falling off/through a
// missing tile eliminates the player. Last player standing wins.
//
// This module is pure data + pure functions (no engine/runtime dependency)
// so both the Colyseus room (authoritative) and the client (rendering,
// prediction) build the identical tile grid from the same source.

export const MAP_ID = 'great-collapse';

export const TILE_SIZE = 40;
export const GRID_RADIUS_TILES = 10;
export const ARENA_RADIUS = GRID_RADIUS_TILES * TILE_SIZE;

// After a player's tile disappears beneath them, how long they have
// (visually falling) before they're actually eliminated.
export const FALL_ELIMINATION_DELAY_MS = 600;

// How long a tile spends shaking + cracking + glowing red (status
// "warning") before it flips to "collapsed", once selected for removal.
export const TILE_WARNING_MS = 3000;

// Each phase names when it starts (ms since match start) and what fraction
// of the ORIGINAL tile count should be removed (cumulatively) by the time
// the phase's tiles finish collapsing. Phase 1 is the full intact floor.
export const COLLAPSE_PHASES = Object.freeze([
  { id: 1, startAtMs: 0, cumulativeFractionRemoved: 0 },
  { id: 2, startAtMs: 20000, cumulativeFractionRemoved: 0.4 },
  { id: 3, startAtMs: 45000, cumulativeFractionRemoved: 0.75 },
  { id: 4, startAtMs: 70000, cumulativeFractionRemoved: 0.95 },
]);

export function tileKey(q, r) {
  return `${q},${r}`;
}

// Every integer (q, r) within GRID_RADIUS_TILES of the origin, mapped to
// world-space tile centers. Sorted outer-ring-first so phase-based removal
// can simply consume from the front of the array to collapse edges inward.
export function buildTileGrid() {
  const tiles = [];
  for (let q = -GRID_RADIUS_TILES; q <= GRID_RADIUS_TILES; q++) {
    for (let r = -GRID_RADIUS_TILES; r <= GRID_RADIUS_TILES; r++) {
      const distanceFromCenter = Math.sqrt(q * q + r * r);
      if (distanceFromCenter <= GRID_RADIUS_TILES) {
        tiles.push({
          key: tileKey(q, r),
          q,
          r,
          x: q * TILE_SIZE,
          y: r * TILE_SIZE,
          distanceFromCenter,
        });
      }
    }
  }
  tiles.sort((a, b) => b.distanceFromCenter - a.distanceFromCenter);
  return tiles;
}

// Evenly places `count` spawn points around a ring at 60% of arena radius.
export function getSpawnPoints(count) {
  const spawnRadius = ARENA_RADIUS * 0.6;
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * spawnRadius,
      y: Math.sin(angle) * spawnRadius,
      angle,
    });
  }
  return points;
}

// Converts a world (x, y) position to the (q, r) grid cell it's over.
export function worldToTile(x, y) {
  return {
    q: Math.round(x / TILE_SIZE),
    r: Math.round(y / TILE_SIZE),
  };
}
