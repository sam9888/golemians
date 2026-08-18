'use client';
import { useState, useEffect } from 'react';
import XIcon from './XIcon';

export default function Allowlist() {
  const [gtdClaimed, setGtdClaimed] = useState(0);
  const [gtdTotal, setGtdTotal] = useState(1500);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Checker form state
  const [checkWallet, setCheckWallet] = useState('');
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // { isWl, status, message }

  // Submission form state
  const [handle, setHandle] = useState('');
  const [quoteLink, setQuoteLink] = useState('');
  const [subWallet, setSubWallet] = useState('');
  const [handleError, setHandleError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [subWalletError, setSubWalletError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subResult, setSubResult] = useState(null);

  const isValidEvm = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
  const isValidHandle = (h) => /^[A-Za-z0-9_]{1,15}$/.test(h.trim().replace(/^@/, ''));
  const isValidTweetLink = (url) => {
    try {
      const u = new URL(url.trim());
      return (['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname)) && u.pathname.includes('/status/');
    } catch {
      return false;
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHandleError('');
    setQuoteError('');
    setSubWalletError('');
    setSubResult(null);

    let hasErr = false;

    if (!isValidHandle(handle)) {
      setHandleError('Enter a valid X handle.');
      hasErr = true;
    }
    if (!isValidTweetLink(quoteLink)) {
      setQuoteError('Enter a valid X/Twitter quote tweet link.');
      hasErr = true;
    }
    if (!isValidEvm(subWallet)) {
      setSubWalletError('Enter a valid EVM address (0x + 40 hex characters).');
      hasErr = true;
    }

    if (hasErr) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          quoteLink,
          subWallet
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setSubResult({ success: false, message: data.error || 'Submission failed. Please try again.' });
      } else {
        // NOTE: the claimed count does NOT increment here. A submission
        // only goes on the WL once the team reviews and approves it —
        // the public counter reflects real approvals only.
        setSubResult({ success: true, message: data.message || 'SUBMISSION RECEIVED — Pending Allocation.' });
        setHandle('');
        setQuoteLink('');
        setSubWallet('');
      }
    } catch (err) {
      setSubResult({ success: false, message: 'Network error — please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = Math.max(gtdTotal - gtdClaimed, 0);
  const pct = statsLoaded ? Math.min((gtdClaimed / gtdTotal) * 100, 100) : 0;

  return (
    <section id="allowlist" className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '96px' }}>
        <p className="eyebrow">SECURE YOUR SPOT</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>JOIN THE ALLOWLIST</h2>
        <p className="lede">1,500 GTD, 1,444 FCFS, and 1,500 Public — 4,444 total. First, GTD WL. Once every guaranteed spot is claimed, FCFS opens, followed by the Public phase.</p>

        <div className="allow-grid allow-grid-3">
          {/* GTD CARD */}
          <div className="card allow-card center">
            <h3 style={{ color: 'var(--yellow)' }}>GTD PHASE</h3>
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
                <label>CHECK WL STATUS</label>
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
                {checking ? 'CHECKING...' : 'CHECK WL STATUS'}
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
                    <span className="wagmi-sub">{checkResult.message || 'Complete the tasks below and submit to lock in your spot.'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FCFS CARD */}
          <div className="card allow-card">
            <h3>FCFS PHASE</h3>
            <p className="allow-sub">First Come First Serve &middot; 1,444 spots</p>
            <div className="fcfs-note" style={{ marginTop: '20px' }}>
              FCFS opens automatically once every GTD spot above has been claimed.
              No wallet checks here &mdash; just be ready and watch <a href="https://x.com/golemians" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'underline' }}>@golemians</a> on X for the signal.
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

        {/* SUBMISSION CARD */}
        <div className="card allow-card center" id="submitCard" style={{ maxWidth: '560px', margin: '24px auto 0' }}>
          <h3 style={{ color: '#fff' }}>COMPLETE &amp; SUBMIT</h3>
          <p className="allow-sub">Finish both tasks, then submit your details to lock in GTD WL.</p>

          <ol className="steps" style={{ marginTop: '20px' }}>
            <li>
              <span className="step-num">1</span>
              Quote the Tweet:{' '}
              <a
                href="https://x.com/golemians/status/2087073858809446418?s=20"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--yellow)', textDecoration: 'underline', marginLeft: '4px' }}
              >
                @golemians Tweet
              </a>
            </li>
            <li><span className="step-num">2</span>Share the Link (post it on your own timeline)</li>
          </ol>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginTop: '20px' }}>
              <label>
                <XIcon size={14} style={{ width: '14px', height: '14px' }} />
                X HANDLE
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@golemians"
              />
              {handleError && <p className="field-error">{handleError}</p>}
            </div>

            <div className="field">
              <label>QUOTE TWEET LINK</label>
              <input
                type="url"
                value={quoteLink}
                onChange={(e) => setQuoteLink(e.target.value)}
                placeholder="https://x.com/golemians/status/2087073858809446418"
              />
              {quoteError && <p className="field-error">{quoteError}</p>}
            </div>

            <div className="field">
              <label>WALLET ADDRESS (EVM ONLY)</label>
              <input
                type="text"
                value={subWallet}
                onChange={(e) => setSubWallet(e.target.value)}
                placeholder="0x..."
                style={{ fontFamily: 'monospace' }}
              />
              {subWalletError && <p className="field-error">{subWalletError}</p>}
            </div>

            <button type="submit" className="btn-cta full-btn" disabled={submitting || (statsLoaded && remaining <= 0)}>
              {submitting ? 'SUBMITTING...' : (statsLoaded && remaining <= 0) ? 'GTD FULL' : 'SUBMIT'}
            </button>
            <p className="field-note">Make sure both steps above are done before submitting.</p>
          </form>

          {subResult && (
            <div className={`check-result ${subResult.success ? 'wagmi' : 'notfound'}`}>
              {subResult.success ? 'SUBMISSION RECEIVED' : 'SUBMISSION FAILED'}
              <span className="wagmi-sub">{subResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
