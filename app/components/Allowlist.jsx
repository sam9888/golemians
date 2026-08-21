'use client';
import { useState, useEffect } from 'react';

function useChecker(tier) {
  const [wallet, setWallet] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // { isWl, status, message }

  const isValidEvm = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const check = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!isValidEvm(wallet)) {
      setError('Enter a valid EVM address (0x + 40 hex characters).');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/check-wl?wallet=${encodeURIComponent(wallet.trim())}&tier=${tier}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong checking your status.');
      } else {
        setResult({ isWl: data.isWl, status: data.status, message: data.message });
      }
    } catch (err) {
      setError('Network error — please try again.');
    } finally {
      setChecking(false);
    }
  };

  return { wallet, setWallet, error, checking, result, check };
}

export default function Allowlist() {
  const [gtdClaimed, setGtdClaimed] = useState(0);
  const [gtdTotal, setGtdTotal] = useState(1500);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const gtdChecker = useChecker('gtd');
  const fcfsChecker = useChecker('fcfs');

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

  const remaining = Math.max(gtdTotal - gtdClaimed, 0);
  const pct = statsLoaded ? Math.min((gtdClaimed / gtdTotal) * 100, 100) : 0;

  return (
    <section id="allowlist" className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '96px' }}>
        <p className="eyebrow">SECURE YOUR SPOT</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>THE ALLOWLIST</h2>
        <p className="lede">GTD is complete. FCFS is now open — win a spot by climbing the ladder below, then check your status here any time.</p>

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

            <form onSubmit={gtdChecker.check} noValidate>
              <div className="field" style={{ marginTop: '22px' }}>
                <label>CHECK GTD STATUS</label>
                <input
                  type="text"
                  value={gtdChecker.wallet}
                  onChange={(e) => gtdChecker.setWallet(e.target.value)}
                  placeholder="0x..."
                  style={{ fontFamily: 'monospace' }}
                />
                {gtdChecker.error && <p className="field-error">{gtdChecker.error}</p>}
              </div>
              <button type="submit" className="btn-cta full-btn" disabled={gtdChecker.checking}>
                {gtdChecker.checking ? 'CHECKING...' : 'CHECK GTD STATUS'}
              </button>
            </form>

            {gtdChecker.result && (
              <div className={`check-result ${gtdChecker.result.isWl ? 'wagmi' : 'notfound'}`}>
                {gtdChecker.result.isWl ? (
                  <>
                    WAGMI
                    <span className="wagmi-sub">{gtdChecker.result.message || 'This wallet is on the GTD WL.'}</span>
                  </>
                ) : (
                  <>
                    NOT WL YET
                    <span className="wagmi-sub">{gtdChecker.result.message || 'GTD is closed - try the ladder below for FCFS instead.'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FCFS CARD - NOW OPEN */}
          <div className="card allow-card center" style={{ border: '1px solid var(--yellow)', boxShadow: '0 0 24px rgba(204,255,0,.15)' }}>
            <h3 style={{ color: 'var(--yellow)' }}>FCFS PHASE &mdash; OPEN NOW</h3>
            <p className="allow-sub">First Come First Serve &middot; 1,444 spots</p>
            <div className="fcfs-note" style={{ marginTop: '16px' }}>
              GTD is complete, so FCFS is live right now. Climb the ladder below for a chance to lock in your spot.
            </div>

            <form onSubmit={fcfsChecker.check} noValidate>
              <div className="field" style={{ marginTop: '18px' }}>
                <label>CHECK FCFS STATUS</label>
                <input
                  type="text"
                  value={fcfsChecker.wallet}
                  onChange={(e) => fcfsChecker.setWallet(e.target.value)}
                  placeholder="0x..."
                  style={{ fontFamily: 'monospace' }}
                />
                {fcfsChecker.error && <p className="field-error">{fcfsChecker.error}</p>}
              </div>
              <button type="submit" className="btn-cta full-btn" disabled={fcfsChecker.checking}>
                {fcfsChecker.checking ? 'CHECKING...' : 'CHECK FCFS STATUS'}
              </button>
            </form>

            {fcfsChecker.result && (
              <div className={`check-result ${fcfsChecker.result.isWl ? 'wagmi' : 'notfound'}`}>
                {fcfsChecker.result.isWl ? (
                  <>
                    WAGMI
                    <span className="wagmi-sub">{fcfsChecker.result.message || 'This wallet won an FCFS spot.'}</span>
                  </>
                ) : (
                  <>
                    NOT FCFS YET
                    <span className="wagmi-sub">{fcfsChecker.result.message || 'Climb the ladder below for a chance to win.'}</span>
                  </>
                )}
              </div>
            )}
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
