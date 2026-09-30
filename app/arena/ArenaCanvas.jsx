'use client';

import { useEffect, useRef } from 'react';
import { ARENA_RADIUS, TILE_SIZE } from '@/shared/mapConfig/greatCollapse';
import { PLAYER_RADIUS } from '@/shared/arenaConfig';

const MOVE_SEND_INTERVAL_MS = 50; // matches the server's tick rate

const TILE_COLORS = {
  intact: { fill: 'rgba(204,255,0,0.08)', stroke: 'rgba(204,255,0,0.25)' },
  collapsed: null, // drawn as nothing — the void background shows through
};

// Server-authoritative rendering: reads room.state directly every animation
// frame rather than subscribing to schema callbacks (see arenaClient.js) and
// draws positions as-is with no client-side prediction/interpolation
// [MY CALL] — the simplest correct thing for a Phase 1 vertical slice at the
// cost of some visible 20Hz choppiness; smoothing can be layered in later
// without touching the network layer or schema.
export default function ArenaCanvas({ client, inputManager }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let rafId;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const state = client?.state;
      if (!state || !width || !height) return;

      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width, height) / (ARENA_RADIUS * 2.2);
      const toX = (wx) => width / 2 + wx * scale;
      const toY = (wy) => height / 2 + wy * scale;
      const now = Date.now();

      const tileSize = TILE_SIZE * scale;
      for (const [, tile] of state.tiles) {
        if (tile.status === 'collapsed') continue;
        const cx = toX(tile.x);
        const cy = toY(tile.y);
        let colors = TILE_COLORS[tile.status];
        if (!colors) {
          const pulse = 0.15 + 0.15 * Math.sin(now / 140);
          colors = { fill: `rgba(255,90,90,${pulse.toFixed(2)})`, stroke: 'rgba(255,120,120,0.6)' };
        }
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;
        ctx.fillRect(cx - tileSize / 2, cy - tileSize / 2, tileSize, tileSize);
        ctx.strokeRect(cx - tileSize / 2, cy - tileSize / 2, tileSize, tileSize);
      }

      const localSessionId = client?.sessionId;
      const playerRadius = Math.max(3, PLAYER_RADIUS * scale);
      for (const [sessionId, player] of state.players) {
        if (player.isEliminated) continue;
        const cx = toX(player.x);
        const cy = toY(player.y);
        const isLocal = sessionId === localSessionId;

        if (player.isAirborne) {
          ctx.beginPath();
          ctx.arc(cx, cy, playerRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, playerRadius, 0, Math.PI * 2);
        ctx.fillStyle = isLocal ? '#ccff00' : '#FF9A3C';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();

        const label = player.characterName || `GOLEM #${player.tokenId}`;
        ctx.font = '10px var(--font-body), sans-serif';
        ctx.fillStyle = isLocal ? '#ccff00' : 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy - playerRadius - 6);
      }
    };
    rafId = requestAnimationFrame(draw);

    const moveInterval = setInterval(() => {
      if (!inputManager || !client) return;
      const { x, y } = inputManager.getMoveVector();
      client.sendMove(x, y);
    }, MOVE_SEND_INTERVAL_MS);

    const unsubscribeActions = inputManager?.onAction((type) => {
      client?.sendAction(type);
    });

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
      clearInterval(moveInterval);
      unsubscribeActions?.();
    };
  }, [client, inputManager]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} className="arena-canvas" />
    </div>
  );
}
