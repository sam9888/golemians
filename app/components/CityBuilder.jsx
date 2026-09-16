'use client';
import { useState, useEffect } from 'react';
import { STRUCTURE_TYPES } from '@/lib/cityLogic';

export default function CityBuilder() {
  const [wallet, setWallet] = useState('');
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('city'); // city, map

  const [cityName, setCityName] = useState('My City');
  const [creating, setCreating] = useState(false);

  const [cities, setCities] = useState([]);
  const [loadingMap, setLoadingMap] = useState(false);

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [raiding, setRaiding] = useState(false);

  const [claimingRewards, setClaimingRewards] = useState(false);

  const createCity = async () => {
    if (!wallet.trim()) {
      setError('Enter wallet address');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/city/create-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: wallet.trim(),
          city_name: cityName
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setCity(data.city);
        await fetchCity(wallet.trim());
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setCreating(false);
    }
  };

  const fetchCity = async (walletAddr) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/city/get-city?wallet=${encodeURIComponent(walletAddr)}`);
      const data = await res.json();
      if (res.ok) {
        setCity(data.city);
      } else if (res.status === 404) {
        setCity(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch city');
    } finally {
      setLoading(false);
    }
  };

  const fetchMap = async () => {
    setLoadingMap(true);
    try {
      const res = await fetch('/api/city/map?limit=50');
      const data = await res.json();
      if (res.ok) {
        setCities(data.cities || []);
      }
    } catch (err) {
      console.error('Failed to fetch map:', err);
    } finally {
      setLoadingMap(false);
    }
  };

  const buildStructure = async (type) => {
    if (!city) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/city/build-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: wallet.trim(),
          structure_type: type
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        await fetchCity(wallet.trim());
      }
    } catch (err) {
      setError('Network error building structure');
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async () => {
    if (!city) return;
    setClaimingRewards(true);
    setError('');
    try {
      const res = await fetch('/api/city/claim-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: wallet.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        await fetchCity(wallet.trim());
      }
    } catch (err) {
      setError('Network error claiming rewards');
    } finally {
      setClaimingRewards(false);
    }
  };

  const raid = async (targetId) => {
    if (!city) return;
    setRaiding(true);
    setError('');
    try {
      const res = await fetch('/api/city/raid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attacker_wallet: wallet.trim(),
          defender_city_id: targetId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSelectedTarget(data.raid);
        await fetchCity(wallet.trim());
        await fetchMap();
      }
    } catch (err) {
      setError('Network error during raid');
    } finally {
      setRaiding(false);
    }
  };

  useEffect(() => {
    if (tab === 'map') {
      fetchMap();
    }
  }, [tab]);

  if (!city && !loading) {
    return (
      <section className="allow-hero grid-bg" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container">
          <p className="eyebrow">CITY BUILDER</p>
          <h2 className="title glow-text">BUILD YOUR KINGDOM</h2>
          <p className="lede">Command your Golemians, build with $GOLE, and raid other cities.</p>

          <div className="card allow-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
            <h3 style={{ color: 'var(--yellow)' }}>CREATE YOUR CITY</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div className="field">
                <label>WALLET ADDRESS</label>
                <input
                  type="text"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="0x..."
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="field">
                <label>CITY NAME</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="My City"
                />
              </div>
              {error && <p className="field-error">{error}</p>}
              <button
                type="button"
                className="btn-cta full-btn"
                disabled={creating}
                onClick={createCity}
              >
                {creating ? 'CREATING...' : 'CREATE CITY'}
              </button>
              <p style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', marginTop: '8px', textAlign: 'center' }}>
                Starting balance: 100,000 $GOLE
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '80px' }}>
        <p className="eyebrow">CITY BUILDER</p>
        <h2 className="title glow-text">BUILD YOUR KINGDOM</h2>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '30px', justifyContent: 'center' }}>
          <button
            type="button"
            className={tab === 'city' ? 'btn-cta' : 'btn-outline'}
            style={{ padding: '10px 20px' }}
            onClick={() => setTab('city')}
          >
            MY CITY
          </button>
          <button
            type="button"
            className={tab === 'map' ? 'btn-cta' : 'btn-outline'}
            style={{ padding: '10px 20px' }}
            onClick={() => setTab('map')}
          >
            MAP & RAIDS
          </button>
        </div>

        {/* MY CITY TAB */}
        {tab === 'city' && city && (
          <div className="allow-grid allow-grid-2">
            {/* CITY INFO */}
            <div className="card allow-card">
              <h3 style={{ color: 'var(--yellow)' }}>{city.name}</h3>
              <div style={{ marginTop: '16px', fontSize: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.85rem' }}>$GOLE BALANCE</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--yellow)' }}>
                    {Math.floor(city.gole_balance).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.85rem' }}>DAILY REWARDS</p>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80' }}>
                    +{Math.floor(city.total_daily_reward).toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(204,255,0,.2)', paddingTop: '12px', fontSize: '.85rem' }}>
                <p><strong>Structure Production:</strong> +{Math.floor(city.daily_production).toLocaleString()} $GOLE/day</p>
                <p><strong>Daily Yield (5%):</strong> +{Math.floor(city.daily_yield).toLocaleString()} $GOLE/day</p>
                <p><strong>Defense Strength:</strong> {city.defensive_strength}</p>
                <p><strong>Location:</strong> ({city.x}, {city.y})</p>
              </div>

              <button
                type="button"
                className={city.can_claim_rewards ? 'btn-cta full-btn' : 'btn-outline full-btn'}
                style={{ marginTop: '16px' }}
                disabled={claimingRewards || !city.can_claim_rewards}
                onClick={claimRewards}
              >
                {claimingRewards ? 'CLAIMING...' : city.can_claim_rewards ? 'CLAIM DAILY REWARDS' : 'REWARDS CLAIMED TODAY'}
              </button>
            </div>

            {/* BUILD MENU */}
            <div className="card allow-card">
              <h3 style={{ color: '#fff' }}>BUILD STRUCTURE</h3>
              {error && <p className="field-error" style={{ marginTop: '12px' }}>{error}</p>}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(STRUCTURE_TYPES).map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    className={city.gole_balance >= config.buildCost ? 'btn-cta' : 'btn-outline'}
                    style={{
                      fontSize: '.8rem',
                      padding: '12px',
                      textAlign: 'left',
                      opacity: city.gole_balance >= config.buildCost ? 1 : 0.6
                    }}
                    disabled={loading || city.gole_balance < config.buildCost}
                    onClick={() => buildStructure(type)}
                    title={`Costs: ${config.buildCost.toLocaleString()} $GOLE`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{config.label}</strong></span>
                      <span style={{ fontSize: '.75rem' }}>{config.buildCost.toLocaleString()} $GOLE</span>
                    </div>
                    <p style={{ fontSize: '.7rem', marginTop: '4px', opacity: 0.7 }}>{config.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {tab === 'map' && (
          <div className="card allow-card">
            <h3 style={{ color: 'var(--yellow)', marginBottom: '16px' }}>⚔️ WORLD MAP & RAIDS</h3>
            {loadingMap ? (
              <p>Loading map...</p>
            ) : cities.length === 0 ? (
              <p>No cities found</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {cities.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px',
                      border: city?.id === c.id ? '2px solid var(--yellow)' : '1px solid rgba(204,255,0,.2)',
                      borderRadius: '6px',
                      background: city?.id === c.id ? 'rgba(204,255,0,.1)' : 'rgba(255,255,255,.02)'
                    }}
                  >
                    <p style={{ fontWeight: 'bold', color: city?.id === c.id ? 'var(--yellow)' : '#fff' }}>
                      {city?.id === c.id ? '📍 ' : ''}{c.name}
                    </p>
                    <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.6)', marginTop: '4px' }}>
                      ({c.x}, {c.y})
                    </p>
                    <p style={{ fontSize: '.75rem', marginTop: '6px' }}>
                      💎 {c.nft_balance} | 🛡️ {c.strength}
                    </p>
                    <p style={{ fontSize: '.75rem', marginTop: '4px', color: 'var(--yellow)' }}>
                      💰 {Math.floor(c.resources.gole || c.resources || 0).toLocaleString()} $GOLE
                    </p>
                    {city?.id !== c.id && (
                      <button
                        type="button"
                        className="btn-cta"
                        style={{ width: '100%', marginTop: '8px', fontSize: '.75rem', padding: '6px' }}
                        disabled={raiding}
                        onClick={() => raid(c.id)}
                      >
                        {raiding ? '⚔️ ...' : '⚔️ RAID'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedTarget && (
              <div className="check-result wagmi" style={{ marginTop: '20px' }}>
                {selectedTarget.status === 'success' ? 'RAID SUCCESS!' : 'RAID DEFENDED!'}
                <span className="wagmi-sub">
                  Status: {selectedTarget.status} | $GOLE Stolen: {Math.floor(selectedTarget.gole_stolen).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
