'use client';

import { INPUT_ACTIONS } from '@/shared/inputActions';

// Normalizes Keyboard/Touch/Gamepad into the shared INPUT_ACTIONS vocabulary
// (see shared/inputActions.js) so gameplay/network code only ever consumes
// actions, never raw DOM/Gamepad events. Keyboard + gamepad are wired
// directly here (both are window-level event sources); touch is fed in from
// TouchControls.jsx instead, since a virtual joystick/buttons need DOM
// elements to render and hit-test, which belongs in a component, not here.
//
// Keybindings and gamepad button mapping are concrete, playable defaults
// [MY CALL] — the spec sections that likely defined exact bindings were
// never received. Nothing downstream depends on these specific choices
// (everything consumes INPUT_ACTIONS), so they can be remapped freely later.
const AXIS_KEY_BINDINGS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const ACTION_KEY_BINDINGS = {
  Space: INPUT_ACTIONS.JUMP,
  ShiftLeft: INPUT_ACTIONS.DASH,
  ShiftRight: INPUT_ACTIONS.DASH,
  KeyE: INPUT_ACTIONS.PUSH,
  KeyQ: INPUT_ACTIONS.GRAB,
  KeyF: INPUT_ACTIONS.GROUND_SLAM,
};

// Standard gamepad mapping button indices (face buttons + right bumper).
const GAMEPAD_BUTTON_ACTIONS = {
  0: INPUT_ACTIONS.JUMP,
  2: INPUT_ACTIONS.DASH,
  1: INPUT_ACTIONS.PUSH,
  3: INPUT_ACTIONS.GRAB,
  5: INPUT_ACTIONS.GROUND_SLAM,
};

const GAMEPAD_DEADZONE = 0.15;

function clampVector(x, y) {
  const mag = Math.hypot(x, y);
  if (mag <= 1) return { x, y };
  return { x: x / mag, y: y / mag };
}

export class InputManager {
  constructor() {
    this.heldKeys = new Set();
    this.keyboardAxes = { x: 0, y: 0 };
    this.touchMoveVector = { x: 0, y: 0 };
    this.actionListeners = new Set();
    this.gamepadIndex = null;
    this.gamepadPrevButtons = new Set();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onGamepadConnected = this._onGamepadConnected.bind(this);
    this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
  }

  attach() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('gamepadconnected', this._onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    }
    this.actionListeners.clear();
  }

  // Subscribe to momentary actions (JUMP/DASH/PUSH/GRAB/GROUND_SLAM).
  // Returns an unsubscribe function.
  onAction(callback) {
    this.actionListeners.add(callback);
    return () => this.actionListeners.delete(callback);
  }

  // Called by TouchControls' action buttons (and usable for a future debug
  // panel) to feed a momentary action through the same path as keyboard/pad.
  triggerAction(type) {
    for (const cb of this.actionListeners) cb(type);
  }

  // Called by TouchControls' virtual joystick with a normalized [-1,1] vector.
  setTouchMoveVector(x, y) {
    this.touchMoveVector = { x, y };
  }

  _onKeyDown(e) {
    if (this.heldKeys.has(e.code)) return; // ignore OS key-repeat
    this.heldKeys.add(e.code);

    if (AXIS_KEY_BINDINGS[e.code]) {
      this._recomputeKeyboardAxes();
      return;
    }
    const action = ACTION_KEY_BINDINGS[e.code];
    if (action) this.triggerAction(action);
  }

  _onKeyUp(e) {
    this.heldKeys.delete(e.code);
    if (AXIS_KEY_BINDINGS[e.code]) this._recomputeKeyboardAxes();
  }

  _recomputeKeyboardAxes() {
    let x = 0;
    let y = 0;
    for (const code of this.heldKeys) {
      const dir = AXIS_KEY_BINDINGS[code];
      if (dir === 'left') x -= 1;
      if (dir === 'right') x += 1;
      if (dir === 'up') y -= 1;
      if (dir === 'down') y += 1;
    }
    this.keyboardAxes = clampVector(x, y);
  }

  _onGamepadConnected(e) {
    this.gamepadIndex = e.gamepad.index;
  }

  _onGamepadDisconnected(e) {
    if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
  }

  // Polls the Gamepad API for both axes and button edges. Architecturally
  // wired per the plan, but not tuned/tested this phase (no gamepad
  // hardware available) — keyboard and touch are the tested input paths.
  _pollGamepad() {
    if (this.gamepadIndex === null || typeof navigator === 'undefined' || !navigator.getGamepads) {
      return null;
    }
    const pad = navigator.getGamepads()[this.gamepadIndex];
    if (!pad) return null;

    for (const [indexStr, action] of Object.entries(GAMEPAD_BUTTON_ACTIONS)) {
      const pressed = !!pad.buttons[Number(indexStr)]?.pressed;
      const wasPressed = this.gamepadPrevButtons.has(indexStr);
      if (pressed && !wasPressed) this.triggerAction(action);
      if (pressed) this.gamepadPrevButtons.add(indexStr);
      else this.gamepadPrevButtons.delete(indexStr);
    }

    const ax = Math.abs(pad.axes[0]) > GAMEPAD_DEADZONE ? pad.axes[0] : 0;
    const ay = Math.abs(pad.axes[1]) > GAMEPAD_DEADZONE ? pad.axes[1] : 0;
    return { x: ax, y: ay };
  }

  // Returns the current move axes, merging whichever source is active.
  // Touch wins over keyboard (a touch drag shouldn't fight a stale WASD
  // key), gamepad is checked last. Polls the gamepad every call so its
  // button-edge detection keeps running regardless of which source wins.
  getMoveVector() {
    const gamepadAxes = this._pollGamepad();

    if (this.touchMoveVector.x !== 0 || this.touchMoveVector.y !== 0) {
      return clampVector(this.touchMoveVector.x, this.touchMoveVector.y);
    }
    if (this.keyboardAxes.x !== 0 || this.keyboardAxes.y !== 0) {
      return this.keyboardAxes;
    }
    if (gamepadAxes && (gamepadAxes.x !== 0 || gamepadAxes.y !== 0)) {
      return clampVector(gamepadAxes.x, gamepadAxes.y);
    }
    return { x: 0, y: 0 };
  }
}
