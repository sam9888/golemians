'use client';
import { useEffect, useState, useCallback } from 'react';

const ALERT_COLORS = {
  safe: '#4ade80',
  caution: '#facc15',
  warning: '#fb923c',
  danger: '#f87171'
};

function threatColor(city) {
  if (!city.can_raid) return 'rgba(255,255,255,.25)'; // out of range
  if (city.damage_multiplier >= 1.5) return '#4ade80'; // close, bonus range
  if (city.damage_multiplier >= 1.25) return '#facc15'; // medium range
  return '#9ca3af'; // in range, no bonus
}

// Visual hex-grid map: shows the player's city centered, nearby enemy
// cities plotted by relative hex offset, a proximity-alert banner, and
// territory-control stats. Backed by GET /api/pvp/realtime-map.
export default function GameMap({ wallet }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // enemy city being targeted
  const [raiding, setRaiding] = useState(false);
  const [raidResult, setRaidResult] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');

  const fetchMap = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pvp/realtime-map?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (res.ok) {
        setMapData(data);
      } else {
        setError(data.error || 'Failed to load map');
      }
    } catch (err) {
      setError('Network error loading map');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  const runRaid = async (targetId) => {
    setRaiding(true);
    setError('');
    setRaidResult(null);
    setClaimMessage('');
    try {
      const res = await fetch('/api/city/raid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attacker_wallet: wallet, defender_city_id: targetId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setRaidResult({ ...data.raid, defender_city_id: targetId });
        await fetchMap();
      }
    } catch (err) {
      setError('Network error during raid');
    } finally {
      setRaiding(false);
    }
  };

  const claimTerritory = async () => {
    if (!raidResult) return;
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/pvp/claim-territory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attacker_wallet: wallet,
          defender_city_id: raidResult.defender_city_id,
          raid_id: raidResult.id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setClaimMessage(data.message);
        setRaidResult(null);
        await fetchMap();
      }
    } catch (err) {
      setError('Network error claiming territory');
    } finally {
      setClaiming(false);
    }
  };

  if (!wallet) return null;
  if (loading && !mapData) return <p>Loading map...</p>;
  if (error && !mapData) return <p className="field-error">{error}</p>;
  if (!mapData) return null;

  const { player, nearby_enemies, proximity_alert, territories, map_stats } = mapData;

  // Simple radial layout: player at center, enemies placed around it at a
  // distance proportional to their hex distance (capped for readability).
  const size = 420;
  const center = size / 2;
  const maxRadius = center - 40;
  const maxDistance = Math.max(1, ...nearby_enemies.map(e => parseFloat(e.distance)));

  return (
    <div>
      <div
        style={{
          padding: '10px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          background: `${ALERT_COLORS[proximity_alert] || '#9ca3af'}22`,
          border: `1px solid ${ALERT_COLORS[proximity_alert] || '#9ca3af'}`,
          color: ALERT_COLORS[proximity_alert] || '#fff',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          fontSize: '.85rem'
        }}
      >
        Threat level: {proximity_alert} · {map_stats.nearby_count} nearby · {map_stats.total_players} total players
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          style={{ background: 'rgba(255,255,255,.02)', borderRadius: '8px', border: '1px solid rgba(204,255,0,.15)' }}
        >
          {/* range rings */}
          {[0.33, 0.66, 1].map((f) => (
            <circle key={f} cx={center} cy={center} r={maxRadius * f} fill="none" stroke="rgba(255,255,255,.08)" />
          ))}

          {/* player city */}
          <circle cx={center} cy={center} r={10} fill="var(--yellow)" />
          <text x={center} y={center - 16} textAnchor="middle" fill="var(--yellow)" fontSize="11">
            {player.name}
          </text>

          {/* enemy cities, spread evenly around the player by angle */}
          {nearby_enemies.map((enemy, idx) => {
            const angle = (idx / Math.max(nearby_enemies.length, 1)) * Math.PI * 2;
            const r = (parseFloat(enemy.distance) / maxDistance) * maxRadius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            const color = threatColor(enemy);
            const isSelected = selected?.id === enemy.id;
            return (
              <g
                key={enemy.id}
                style={{ cursor: enemy.can_raid ? 'pointer' : 'default' }}
                onClick={() => enemy.can_raid && setSelected(enemy)}
              >
                <circle cx={x} cy={y} r={isSelected ? 9 : 7} fill={color} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={x} y={y - 12} textAnchor="middle" fill="#fff" fontSize="9">
                  {enemy.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div>
          <div className="card allow-card" style={{ marginBottom: '12px' }}>
            <h4 style={{ color: 'var(--yellow)', fontSize: '.85rem' }}>TERRITORY CONTROL</h4>
            <p style={{ fontSize: '.8rem', marginTop: '8px' }}>
              {territories.count} territories · +{territories.bonus_percent}% bonus
            </p>
            <p style={{ fontSize: '.8rem', color: 'var(--yellow)' }}>
              +{Math.floor(territories.daily_bonus_gole).toLocaleString()} $GOLE/day
            </p>
          </div>

          {selected && (
            <div className="card allow-card">
              <h4 style={{ fontSize: '.85rem' }}>{selected.name}</h4>
              <p style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', marginTop: '4px' }}>
                Distance: {selected.distance} hex · Damage x{selected.damage_multiplier}
              </p>
              <p style={{ fontSize: '.75rem', marginTop: '4px' }}>
                🛡️ {selected.strength} · 💎 {selected.nft_balance}
              </p>
              <button
                type="button"
                className="btn-cta full-btn"
                style={{ marginTop: '10px' }}
                disabled={raiding}
                onClick={() => runRaid(selected.id)}
              >
                {raiding ? 'RAIDING...' : '⚔️ RAID'}
              </button>
            </div>
          )}

          {raidResult && (
            <div className="check-result wagmi" style={{ marginTop: '12px' }}>
              {raidResult.status === 'success' ? 'RAID SUCCESS!' : 'RAID DEFENDED!'}
              <span className="wagmi-sub">
                $GOLE stolen: {Math.floor(raidResult.gole_stolen || 0).toLocaleString()}
              </span>
              {raidResult.status === 'success' && (
                <button
                  type="button"
                  className="btn-outline full-btn"
                  style={{ marginTop: '8px' }}
                  disabled={claiming}
                  onClick={claimTerritory}
                >
                  {claiming ? 'CLAIMING...' : 'CLAIM TERRITORY'}
                </button>
              )}
            </div>
          )}

          {claimMessage && <p style={{ fontSize: '.8rem', color: 'var(--yellow)', marginTop: '8px' }}>{claimMessage}</p>}
          {error && <p className="field-error" style={{ marginTop: '8px' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
