import Matter from 'matter-js';
import { PLAYER_RADIUS, PLAYER_MOVE_SPEED } from '../../../shared/arenaConfig.js';

const { Bodies, Body } = Matter;

export function createPlayerBody(x, y) {
  return Bodies.circle(x, y, PLAYER_RADIUS, {
    frictionAir: 0.25,
    friction: 0,
    restitution: 0.6,
    inertia: Infinity, // top-down arcade arena — spin isn't part of the feel
  });
}

// tickSeconds = the fixed simulation tick duration in seconds. Velocity is
// set directly (arcade-style) rather than force-accumulated, so movement
// feels crisp and immediately responsive instead of accelerating/drifting.
export function applyMovement(body, moveX, moveY, tickSeconds, speedMultiplier = 1) {
  const mag = Math.hypot(moveX, moveY);
  if (mag < 0.05) {
    Body.setVelocity(body, { x: 0, y: 0 });
    return;
  }
  const clampedMag = Math.min(mag, 1);
  const nx = (moveX / mag) * clampedMag;
  const ny = (moveY / mag) * clampedMag;
  const speed = PLAYER_MOVE_SPEED * speedMultiplier * tickSeconds;
  Body.setVelocity(body, { x: nx * speed, y: ny * speed });
}

// Adds an instantaneous velocity impulse to `body`, directed away from
// (mode 'push') or toward (mode 'pull') `sourcePoint`. Backs PUSH,
// GROUND_SLAM (push) and GRAB (pull).
export function applyImpulse(body, sourcePoint, strength, mode) {
  const dx = body.position.x - sourcePoint.x;
  const dy = body.position.y - sourcePoint.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const direction = mode === 'pull' ? -1 : 1;
  Body.setVelocity(body, {
    x: body.velocity.x + nx * strength * direction,
    y: body.velocity.y + ny * strength * direction,
  });
}
