'use client';
import { useState, useEffect } from 'react';

const FALLBACK_TWEET_URL = 'https://x.com/golemians/status/2087073858809446418?s=20';

function buildTasks(tweetUrl) {
  return [
    { key: 'follow', label: 'Follow @golemians', href: 'https://x.com/golemians', needsLink: false },
    { key: 'retweet', label: "Retweet today's post", href: tweetUrl, needsLink: false },
    { key: 'quote', label: 'Quote tweet & share', href: tweetUrl, needsLink: true }
  ];
}

const RUNGS = [
  { step: 1, tier: 'public', label: 'PUBLIC', multiplier: '2x' },
  { step: 2, tier: 'fcfs', label: 'FCFS', multiplier: '5x' },
  { step: 3, tier: 'gtd', label: 'GTD', multiplier: '10x' }
];

function getSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.localStorage.getItem('golemians_game_session');
    if (!id) {
      id = 'sess_' + crypto.randomUUID().replace(/-/g, '');
      window.localStorage.setItem('golemians_game_session', id);
    }
    return id;
  } catch {
    return null;
  }
}

function getReferrer() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    return params.get('ref');
  } catch {
    return null;
  }
}

export default function LadderGame() {
  const [sessionId, setSessionId] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [dailyTweetUrl, setDailyTweetUrl] = useState(FALLBACK_TWEET_URL);
  const TASKS = buildTasks(dailyTweetUrl);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [playsAvailable, setPlaysAvailable] = useState(0);
  const [bonusPlays, setBonusPlays] = useState(0);
  const [won, setWon] = useState(false);
  const [wonTier, setWonTier] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [loadingTask, setLoadingTask] = useState(null);
  const [tweetUrl, setTweetUrl] = useState('');
  const [taskError, setTaskError] = useState('');
  const [copyLabel, setCopyLabel] = useState('COPY LINK');

  const [roundId, setRoundId] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busted, setBusted] = useState(false);
  const [roundMessage, setRoundMessage] = useState('');
  const [roundError, setRoundError] = useState('');

  const [handle, setHandle] = useState('');
  const [claimWallet, setClaimWallet] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(null);

  const isValidEvm = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
  const isValidHandle = (h) => /^[A-Za-z0-9_]{1,15}$/.test(h.trim().replace(/^@/, ''));

  const fetchStatus = async (sid) => {
    try {
      const res = await fetch(`/api/game/status?session_id=${encodeURIComponent(sid)}`);
      const data = await res.json();
      if (res.ok) {
        setCompletedTasks(data.completedTasks || []);
        setPlaysAvailable(data.playsAvailable || 0);
        setBonusPlays(data.bonusPlays || 0);
        setWon(data.won || false);
        setWonTier(data.wonTier || null);
        setClaimed(data.claimed || false);
        if (data.activeRound) {
          setRoundId(data.activeRound.id);
          setStep(data.activeRound.step);
        }
      }
    } catch (err) {
      console.error('Failed to load game status', err);
    } finally {
      setStatusLoaded(true);
    }
  };

  const fetchDailyTweet = async () => {
    try {
      const res = await fetch('/api/daily-tweet', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.tweetUrl) setDailyTweetUrl(data.tweetUrl);
    } catch (err) {
      console.error('Failed to load daily tweet', err);
    }
  };

  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    setReferrer(getReferrer());
    if (sid) fetchStatus(sid);
    fetchDailyTweet();
  }, []);

  const handleTask = async (taskKey) => {
    if (!sessionId) return;
    setTaskError('');

    if (taskKey === 'quote' && !tweetUrl.trim()) {
      setTaskError('Paste your quote tweet link first.');
      return;
    }

    setLoadingTask(taskKey);
    try {
      const res = await fetch('/api/game/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          task: taskKey,
          tweetUrl: taskKey === 'quote' ? tweetUrl.trim() : undefined,
          ref: referrer || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setTaskError(data.error || 'Could not record that task.');
      } else {
        setCompletedTasks(data.completedTasks || []);
        await fetchStatus(sessionId);
      }
    } catch (err) {
      setTaskError('Network error - please try again.');
    } finally {
      setLoadingTask(null);
    }
  };

  const startRound = async () => {
    setRoundError('');
    setBusted(false);
    setRoundMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/game/round/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (!res.ok) {
        setRoundError(data.error || 'Could not start a round.');
      } else {
        setRoundId(data.roundId);
        setStep(data.step);
      }
    } catch (err) {
      setRoundError('Network error - please try again.');
    } finally {
      setBusy(false);
    }
  };

  const climb = async () => {
    setRoundError('');
    setBusy(true);
    try {
      const res = await fetch('/api/game/round/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, round_id: roundId })
      });
      const data = await res.json();
      if (!res.ok) {
        setRoundError(data.error || 'Something went wrong.');
      } else if (!data.survived) {
        setBusted(true);
        setRoundMessage(data.message);
        setStep(0);
        setRoundId(null);
        await fetchStatus(sessionId);
      } else {
        setStep(data.step);
        setRoundMessage(data.message);
        if (data.topOfLadder) {
          setWon(Boolean(data.tier));
          setWonTier(data.tier);
          setRoundId(null);
        }
      }
    } catch (err) {
      setRoundError('Network error - please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cashOut = async () => {
    setRoundError('');
    setBusy(true);
    try {
      const res = await fetch('/api/game/round/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, round_id: roundId })
      });
      const data = await res.json();
      if (!res.ok) {
        setRoundError(data.error || 'Something went wrong.');
      } else {
        setWon(true);
        setWonTier(data.tier);
        setRoundMessage(data.message);
        setRoundId(null);
      }
    } catch (err) {
      setRoundError('Network error - please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (e) => {
    e.preventDefault();
    setClaimError('');
    if (!isValidHandle(handle)) {
      setClaimError('Enter a valid X handle.');
      return;
    }
    if (!isValidEvm(claimWallet)) {
      setClaimError('Enter a valid EVM address (0x + 40 hex characters).');
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch('/api/game/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, handle, wallet: claimWallet })
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Claim failed - please try again.');
      } else {
        setClaimSuccess(data.message);
        setClaimed(true);
      }
    } catch (err) {
      setClaimError('Network error - please try again.');
    } finally {
      setClaiming(false);
    }
  };

  const copyReferralLink = async () => {
    if (!sessionId || typeof window === 'undefined') return;
    const link = `${window.location.origin}${window.location.pathname}?ref=${sessionId}#ladder`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyLabel('COPIED!');
      setTimeout(() => setCopyLabel('COPY LINK'), 2000);
    } catch {
      setCopyLabel('COPY FAILED');
      setTimeout(() => setCopyLabel('COPY LINK'), 2000);
    }
  };

  const tasksComplete = completedTasks.length >= TASKS.length;
  const inRound = Boolean(roundId);

  return (
    <section id="ladder" className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '96px' }}>
        <p className="eyebrow">PUSH YOUR LUCK</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>CLIMB THE LADDER</h2>
        <p className="lede">Complete tasks to earn plays, then climb: bank a spot at any rung, or push higher and risk losing it all.</p>

        <div className="allow-grid allow-grid-2">
          {/* TASKS CARD */}
          <div className="card allow-card">
            <h3 style={{ color: 'var(--yellow)' }}>1. COMPLETE TASKS</h3>
            <p className="allow-sub">Each task earns 1 play &mdash; no wallet needed yet</p>

            <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TASKS.map((task) => {
                const done = completedTasks.includes(task.key);
                return (
                  <div key={task.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <a
                        href={task.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--yellow)', textDecoration: 'underline', flex: 1, fontSize: '.9rem' }}
                      >
                        {task.label}
                      </a>
                      {!task.needsLink && (
                        <button
                          type="button"
                          className={done ? 'btn-outline' : 'btn-cta'}
                          style={{ padding: '8px 16px', fontSize: '.75rem', opacity: done ? 0.6 : 1 }}
                          disabled={done || loadingTask === task.key}
                          onClick={() => handleTask(task.key)}
                        >
                          {done ? 'DONE' : loadingTask === task.key ? '...' : 'I DID THIS'}
                        </button>
                      )}
                    </div>
                    {task.needsLink && !done && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                          type="url"
                          value={tweetUrl}
                          onChange={(e) => setTweetUrl(e.target.value)}
                          placeholder="Paste your quote tweet link"
                          style={{ flex: 1, fontSize: '.8rem' }}
                        />
                        <button
                          type="button"
                          className="btn-cta"
                          style={{ padding: '8px 16px', fontSize: '.75rem', whiteSpace: 'nowrap' }}
                          disabled={loadingTask === task.key}
                          onClick={() => handleTask(task.key)}
                        >
                          {loadingTask === task.key ? 'VERIFYING...' : 'VERIFY'}
                        </button>
                      </div>
                    )}
                    {task.needsLink && done && (
                      <p className="field-note" style={{ marginTop: '4px' }}>Verified against your tweet link.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {taskError && <p className="field-error" style={{ marginTop: '10px' }}>{taskError}</p>}

            {statusLoaded && (
              <div className="check-result wagmi" style={{ marginTop: '18px' }}>
                {playsAvailable} PLAY{playsAvailable === 1 ? '' : 'S'} AVAILABLE
                <span className="wagmi-sub">
                  Complete more tasks above for extra plays.
                  {bonusPlays > 0 ? ` (+${bonusPlays} from referrals)` : ''}
                </span>
              </div>
            )}

            {sessionId && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(204,255,0,.1)' }}>
                <p className="allow-sub" style={{ marginBottom: '8px' }}>
                  REFER A FRIEND &mdash; earn 1 bonus play when they use your link
                </p>
                <button type="button" className="btn-outline full-btn" onClick={copyReferralLink}>
                  {copyLabel}
                </button>
              </div>
            )}
          </div>

          {/* LADDER CARD */}
          <div className="card allow-card center">
            <h3 style={{ color: '#fff' }}>2. CLIMB THE LADDER</h3>
            <p className="allow-sub">Bank it, or push higher and risk it all</p>

            {won ? (
              !claimed ? (
                <>
                  <div className="check-result wagmi" style={{ marginTop: '20px' }}>
                    YOU WON A {wonTier?.toUpperCase()} SPOT!
                    <span className="wagmi-sub">Enter your X handle and wallet to claim it.</span>
                  </div>
                  <form onSubmit={handleClaim} noValidate style={{ marginTop: '16px', textAlign: 'left' }}>
                    <div className="field">
                      <label>X HANDLE</label>
                      <input
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="@golemians"
                      />
                    </div>
                    <div className="field">
                      <label>WALLET ADDRESS (EVM ONLY)</label>
                      <input
                        type="text"
                        value={claimWallet}
                        onChange={(e) => setClaimWallet(e.target.value)}
                        placeholder="0x..."
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                    {claimError && <p className="field-error">{claimError}</p>}
                    <button type="submit" className="btn-cta full-btn" disabled={claiming}>
                      {claiming ? 'CLAIMING...' : 'CLAIM MY SPOT'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="check-result wagmi" style={{ marginTop: '20px' }}>
                  CLAIMED!
                  <span className="wagmi-sub">{claimSuccess || `You're locked in for the ${wonTier?.toUpperCase()} phase.`}</span>
                </div>
              )
            ) : (
              <>
                {/* Ladder visual, top rung first */}
                <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '8px', margin: '20px 0' }}>
                  {RUNGS.map((rung) => {
                    const reached = step >= rung.step;
                    const isCurrent = step === rung.step && inRound;
                    return (
                      <div
                        key={rung.step}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 16px', borderRadius: '8px',
                          border: `1px solid ${isCurrent ? 'var(--yellow)' : 'rgba(204,255,0,.15)'}`,
                          background: reached ? 'rgba(204,255,0,.1)' : 'rgba(255,255,255,.02)',
                          boxShadow: isCurrent ? '0 0 14px rgba(204,255,0,.35)' : 'none'
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '.85rem', fontWeight: 700, color: reached ? 'var(--yellow)' : 'rgba(255,255,255,.5)' }}>
                          {rung.label}
                        </span>
                        <span style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.4)' }}>{rung.multiplier}</span>
                      </div>
                    );
                  })}
                </div>

                {busted && (
                  <div className="check-result notfound" style={{ marginTop: '4px', marginBottom: '16px' }}>
                    BUSTED
                    <span className="wagmi-sub">{roundMessage}</span>
                  </div>
                )}

                {!busted && roundMessage && inRound && (
                  <p className="allow-sub" style={{ marginBottom: '14px', color: 'var(--yellow)' }}>{roundMessage}</p>
                )}

                {!inRound ? (
                  <button
                    type="button"
                    className="btn-cta full-btn"
                    disabled={busy || playsAvailable <= 0}
                    onClick={startRound}
                  >
                    {busy ? 'STARTING...' : playsAvailable > 0 ? `START CLIMB (${playsAvailable} LEFT)` : 'NO PLAYS LEFT'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button type="button" className="btn-cta" style={{ flex: 1 }} disabled={busy} onClick={climb}>
                      {busy ? '...' : 'PUSH FURTHER'}
                    </button>
                    <button type="button" className="btn-outline" style={{ flex: 1 }} disabled={busy || step < 1} onClick={cashOut}>
                      CASH OUT
                    </button>
                  </div>
                )}

                {!tasksComplete && playsAvailable === 0 && statusLoaded && (
                  <p className="field-note" style={{ marginTop: '10px' }}>Complete the tasks to the left to unlock your first climb.</p>
                )}

                {roundError && <p className="field-error" style={{ marginTop: '12px' }}>{roundError}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
