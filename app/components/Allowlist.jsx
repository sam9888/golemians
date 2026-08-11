'use client';
import { useState } from 'react';
import XIcon from './XIcon';

const GTD_TOTAL = 1200;

export default function Allowlist() {
  const [gtdClaimed, setGtdClaimed] = useState(0);
  const [submittedWallets, setSubmittedWallets] = useState(new Set());

  // Checker form state
  const [checkWallet, setCheckWallet] = useState('');
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // { isWl: boolean }

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

  const handleCheck = async (e) => {
    e.preventDefault();
    setCheckError('');
    setCheckResult(null);

    if (!isValidEvm(checkWallet)) {
      setCheckError('Enter a valid EVM address (0x + 40 hex characters).');
      return;
    }

    setChecking(true);
    await new Promise((r) => setTimeout(r, 500));
    setChecking(false);

    const isWl = submittedWallets.has(checkWallet.trim().toLowerCase());
    setCheckResult({ isWl });
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
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);

    const normalized = subWallet.trim().toLowerCase();

    if (submittedWallets.has(normalized)) {
      setSubResult({ success: false, message: 'This wallet address has already been submitted.' });
      return;
    }

    if (gtdClaimed >= GTD_TOTAL) {
      setSubResult({ success: false, message: 'GTD Phase is full. Keep an eye out for FCFS announcement.' });
      return;
    }

    setSubmittedWallets((prev) => new Set(prev).add(normalized));
    setGtdClaimed((prev) => prev + 1);
    setSubResult({ success: true, message: 'SPOT LOCKED IN! Your details have been recorded for GTD WL.' });

    // Reset inputs
    setHandle('');
    setQuoteLink('');
    setSubWallet('');
  };

  const remaining = Math.max(GTD_TOTAL - gtdClaimed, 0);
  const pct = Math.min((gtdClaimed / GTD_TOTAL) * 100, 100);

  return (
    <section id="allowlist" className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '96px' }}>
        <p className="eyebrow">SECURE YOUR SPOT</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>JOIN THE ALLOWLIST</h2>
        <p className="lede">First, GTD WL. Once every guaranteed spot is claimed, FCFS opens for everyone else.</p>

        <div className="allow-grid allow-grid-2">
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
                    <span className="wagmi-sub">This wallet is on the GTD WL.</span>
                  </>
                ) : (
                  <>
                    NOT WL YET
                    <span className="wagmi-sub">Complete the tasks below and submit to lock in your spot.</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FCFS CARD */}
          <div className="card allow-card">
            <h3>FCFS PHASE</h3>
            <p className="allow-sub">First Come First Serve</p>
            <div className="fcfs-note" style={{ marginTop: '20px' }}>
              FCFS opens automatically once every GTD spot above has been claimed.
              No wallet checks or spot counts here &mdash; just be ready and watch <a href="https://x.com/golemians" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'underline' }}>@golemians</a> on X for the signal.
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

            <button type="submit" className="btn-cta full-btn" disabled={submitting || remaining <= 0}>
              {submitting ? 'SUBMITTING...' : remaining <= 0 ? 'GTD FULL' : 'SUBMIT'}
            </button>
            <p className="field-note">Make sure both steps above are done before submitting.</p>
          </form>

          {subResult && (
            <div className={`check-result ${subResult.success ? 'wagmi' : 'notfound'}`}>
              {subResult.success ? 'SPOT LOCKED IN!' : 'SUBMISSION FAILED'}
              <span className="wagmi-sub">{subResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
