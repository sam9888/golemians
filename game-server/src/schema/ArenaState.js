import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.walletAddress = '';
    this.tokenId = 0;
    this.characterName = '';
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.isAirborne = false;
    this.isEliminated = false;
    this.placement = 0; // 0 = still in play; 1 = winner, 2 = runner-up, ...
  }
}

defineTypes(PlayerState, {
  walletAddress: 'string',
  tokenId: 'number',
  characterName: 'string',
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  isAirborne: 'boolean',
  isEliminated: 'boolean',
  placement: 'number',
});

// status: 'intact' | 'warning' (shaking/cracking/glowing) | 'collapsed'
export class TileState extends Schema {
  constructor() {
    super();
    this.key = '';
    this.q = 0;
    this.r = 0;
    this.x = 0;
    this.y = 0;
    this.status = 'intact';
  }
}

defineTypes(TileState, {
  key: 'string',
  q: 'number',
  r: 'number',
  x: 'number',
  y: 'number',
  status: 'string',
});

// matchPhase: 'waiting' | 'countdown' | 'playing' | 'ended'
export class ArenaState extends Schema {
  constructor() {
    super();
    this.matchId = '';
    this.matchPhase = 'waiting';
    this.countdownEndsAt = 0;
    this.matchStartedAt = 0;
    this.matchEndedAt = 0;
    this.survivorCount = 0;
    this.winnerWallet = '';
    this.winnerTokenId = 0;
    this.winnerCharacterName = '';
    this.players = new MapSchema();
    this.tiles = new MapSchema();
  }
}

defineTypes(ArenaState, {
  matchId: 'string',
  matchPhase: 'string',
  countdownEndsAt: 'number',
  matchStartedAt: 'number',
  matchEndedAt: 'number',
  survivorCount: 'number',
  winnerWallet: 'string',
  winnerTokenId: 'number',
  winnerCharacterName: 'string',
  players: { map: PlayerState },
  tiles: { map: TileState },
});
