// Canonical input action names. Both the client InputManager and any code
// that reasons about player intent (client prediction, server reconciliation)
// import from here instead of inventing string literals ad hoc.
export const INPUT_ACTIONS = Object.freeze({
  MOVE_X: 'MOVE_X',
  MOVE_Y: 'MOVE_Y',
  JUMP: 'JUMP',
  DASH: 'DASH',
  PUSH: 'PUSH',
  GRAB: 'GRAB',
  GROUND_SLAM: 'GROUND_SLAM',
});

// Actions that are momentary (edge-triggered) rather than held/continuous.
// MOVE_X and MOVE_Y are axis values sent on change; everything else here is
// sent once per press as a discrete event.
export const MOMENTARY_ACTIONS = Object.freeze([
  INPUT_ACTIONS.JUMP,
  INPUT_ACTIONS.DASH,
  INPUT_ACTIONS.PUSH,
  INPUT_ACTIONS.GRAB,
  INPUT_ACTIONS.GROUND_SLAM,
]);
