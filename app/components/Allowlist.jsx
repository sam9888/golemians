'use client';
import { useState, useEffect } from 'react';

export default function Allowlist() {
  const [gtdClaimed, setGtdClaimed] = useState(0);
  const [gtdTotal, setGtdTotal] = useState(1500);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Checker form state
  const [checkWallet, setCheckWallet] = useState('');
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // { isWl, status, message }

  const isValidEvm = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      const data = await res.json();
      if (typeof data.claimed_count === 'number') setGtdClaimed(data.claimed_count);
      if (typeof data.total_spots === 'number') setGtdTotal(data.total_spots);
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setStatsLoaded(true);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    setCheckError('');
    setCheckResult(null);

    if (!isValidEvm(checkWallet)) {
      setCheckError('Enter a valid EVM address (0x + 40 hex characters).');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/check-wl?wallet=${encodeURIComponent(checkWallet.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || 'Something went wrong checking your status.');
      } else {
        setCheckResult({ isWl: data.isWl, status: data.status, message: data.message });
      }
    } catch (err) {
      setCheckError('Network error — please try again.');
    } finally {
      setChecking(false);
    }
  };

  const remaining = Math.max(gtdTotal - gtdClaimed, 0);
  const pct = statsLoaded ? Math.min((gtdClaimed / gtdTotal) * 100, 100) : 0;

  return (
    <section id="allowlist" className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '96px' }}>
        <p className="eyebrow">SECURE YOUR SPOT</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>THE ALLOWLIST</h2>
        <p className="lede">GTD is complete. FCFS is now open — win a spot by climbing the ladder below, then check your GTD status here any time.</p>

        <div className="allow-grid allow-grid-3">
          {/* GTD CARD - COMPLETED */}
          <div className="card allow-card center" style={{ opacity: 0.85 }}>
            <h3 style={{ color: 'rgba(255,255,255,.6)' }}>GTD PHASE &mdash; COMPLETED</h3>
            <p className="allow-sub">Guaranteed spots for early supporters</p>

            <div style={{ marginTop: '24px' }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }}></div>
              </div>
              <div className="progress-labels">
                <span><b>{gtdClaimed}</b> claimed</span>
                <span>{remaining} remaining</span>
              </div>
            </div>

            <form onSubmit={handleCheck} noValidate>
              <div className="field" style={{ marginTop: '22px' }}>
                <label>CHECK GTD STATUS</label>
                <input
                  type="text"
                  value={checkWallet}
                  onChange={(e) => setCheckWallet(e.target.value)}
                  placeholder="0x..."
                  style={{ fontFamily: 'monospace' }}
                />
                {checkError && <p className="field-error">{checkError}</p>}
              </div>
              <button type="submit" className="btn-cta full-btn" disabled={checking}>
                {checking ? 'CHECKING...' : 'CHECK GTD STATUS'}
              </button>
            </form>

            {checkResult && (
              <div className={`check-result ${checkResult.isWl ? 'wagmi' : 'notfound'}`}>
                {checkResult.isWl ? (
                  <>
                    WAGMI
                    <span className="wagmi-sub">{checkResult.message || 'This wallet is on the GTD WL.'}</span>
                  </>
                ) : (
                  <>
                    NOT WL YET
                    <span className="wagmi-sub">{checkResult.message || 'GTD is closed - try the ladder below for FCFS instead.'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FCFS CARD - NOW OPEN */}
          <div className="card allow-card center" style={{ border: '1px solid var(--yellow)', boxShadow: '0 0 24px rgba(204,255,0,.15)' }}>
            <h3 style={{ color: 'var(--yellow)' }}>FCFS PHASE &mdash; OPEN NOW</h3>
            <p className="allow-sub">First Come First Serve &middot; 1,444 spots</p>
            <div className="fcfs-note" style={{ marginTop: '20px' }}>
              GTD is complete, so FCFS is live right now. Climb the ladder below for a chance to lock in your spot &mdash;
              no waiting, no signal to watch for.
            </div>
          </div>

          {/* PUBLIC CARD */}
          <div className="card allow-card">
            <h3>PUBLIC PHASE</h3>
            <p className="allow-sub">Open Mint &middot; 1,500 spots</p>
            <div className="fcfs-note" style={{ marginTop: '20px' }}>
              Once FCFS spots are gone, the remaining 1,500 open up to the public.
              No allowlist or wallet checks needed &mdash; anyone can mint until the collection sells out.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
