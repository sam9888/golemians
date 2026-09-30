'use client';

import { useRef, useState } from 'react';
import { INPUT_ACTIONS } from '@/shared/inputActions';

const ACTION_BUTTONS = [
  { type: INPUT_ACTIONS.JUMP, label: 'JUMP' },
  { type: INPUT_ACTIONS.DASH, label: 'DASH' },
  { type: INPUT_ACTIONS.PUSH, label: 'PUSH' },
  { type: INPUT_ACTIONS.GRAB, label: 'GRAB' },
  { type: INPUT_ACTIONS.GROUND_SLAM, label: 'SLAM' },
];

const JOYSTICK_RADIUS = 55; // must match .arena-joystick-base half-width in arena.css

// DOM/JSX half of input handling — a virtual joystick needs elements to
// hit-test, which doesn't belong inside the framework-agnostic InputManager.
// Feeds normalized values into it via setTouchMoveVector/triggerAction so
// gameplay code downstream never has to know touch was involved.
export default function TouchControls({ inputManager }) {
  const baseRef = useRef(null);
  const draggingRef = useRef(false);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const updateFromPointer = (e) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > JOYSTICK_RADIUS) {
      dx = (dx / mag) * JOYSTICK_RADIUS;
      dy = (dy / mag) * JOYSTICK_RADIUS;
    }
    setKnobOffset({ x: dx, y: dy });
    inputManager?.setTouchMoveVector(dx / JOYSTICK_RADIUS, dy / JOYSTICK_RADIUS);
  };

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    baseRef.current?.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    updateFromPointer(e);
  };

  const endDrag = () => {
    draggingRef.current = false;
    setKnobOffset({ x: 0, y: 0 });
    inputManager?.setTouchMoveVector(0, 0);
  };

  return (
    <div className="arena-touch-controls">
      <div
        ref={baseRef}
        className="arena-joystick-base"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="arena-joystick-knob"
          style={{ transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))` }}
        />
      </div>

      <div className="arena-action-buttons">
        {ACTION_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            type="button"
            className="arena-action-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              inputManager?.triggerAction(btn.type);
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
