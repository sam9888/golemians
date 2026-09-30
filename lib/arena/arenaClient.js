'use client';

import { Client } from 'colyseus.js';
import { getGameServerUrl } from '@/lib/arena/config';

// Thin wrapper around colyseus.js. Deliberately avoids the schema callbacks
// API (getStateCallbacks / onAdd / onChange) since its exact shape has
// shifted across @colyseus/schema versions — instead, `room.state` is a
// live object colyseus.js keeps mutated in place as patches arrive, so
// callers (the render loop in ArenaCanvas) just read state.* directly every
// animation frame without subscribing to per-field change events.
export class ArenaClient {
  constructor() {
    this.client = new Client(getGameServerUrl());
    this.room = null;
  }

  get state() {
    return this.room?.state || null;
  }

  get sessionId() {
    return this.room?.sessionId || null;
  }

  async join(joinToken) {
    this.room = await this.client.joinOrCreate('great_collapse', { joinToken });
    return this.room;
  }

  onLeave(callback) {
    this.room?.onLeave(callback);
  }

  onError(callback) {
    this.room?.onError(callback);
  }

  sendMove(x, y) {
    if (this.room) this.room.send('move', { x, y });
  }

  sendAction(type) {
    if (this.room) this.room.send('action', { type });
  }

  leave() {
    this.room?.leave();
    this.room = null;
  }
}
