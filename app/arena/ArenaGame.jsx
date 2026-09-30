'use client';

import { useCallback, useEffect, useState } from 'react';
import WalletConnect from '../components/WalletConnect';
import ArenaCanvas from './ArenaCanvas';
import TouchControls from './TouchControls';
import { ArenaClient } from '@/lib/arena/arenaClient';
import { InputManager } from '@/lib/arena/inputManager';
import './arena.css';

function formatWallet(w) {
  if (!w) return '';
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ArenaGame() {
  const [wallet, setWallet] = useState('');
  const [verified, setVerified] = useState(false);

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [tokenIdInput, setTokenIdInput] = useState('');
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimMessage, setClaimMessage] = useState('');

  // 'lobby' | 'connecting' | 'match' | 'disconnected'
  const [phase, setPhase] = useState('lobby');
  const [connectError, setConnectError] = useState('');
  const [hud, setHud] = useState(null);

  // The live match session ({ client, inputManager }). Held in state rather
  // than a ref because render reads it (ArenaCanvas/TouchControls need both),
  // and refs must not be read during render.
  const [session, setSession] = useState(null);

  const fetchStatus = useCallback(async (walletAddr) => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const res = await fetch(`/api/arena/status?wallet=${encodeURIComponent(walletAddr)}`);
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'Failed to load arena status');
      } else {
        setStatus(data);
      }
    } catch (err) {
      setStatusError('Network error - please try again');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const handleWalletVerified = (walletAddr) => {
    if (!walletAddr) {
      setWallet('');
      setVerified(false);
      setStatus(null);
      return;
    }
    setWallet(walletAddr);
    setVerified(true);
    fetchStatus(walletAddr);
  };

  const handleClaimDaily = async () => {
    setClaiming(true);
    setClaimError('');
    setClaimMessage('');
    try {
      const res = await fetch('/api/arena/claim-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: wallet }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Failed to claim daily reward');
      } else {
        setClaimMessage(`Claimed ${data.claimed} GLM!`);
        fetchStatus(wallet);
      }
    } catch (err) {
      setClaimError('Network error - please try again');
    } finally {
      setClaiming(false);
    }
  };

  // Owns the whole lifecycle of a live session: poll room state into the HUD
  // while it lasts, and tear the session down when it ends (back to lobby,
  // or this component unmounting mid-match).
  useEffect(() => {
    if (!session) return undefined;
    const { client, inputManager } = session;

    const syncHud = () => {
      const state = client.state;
      if (!state) return;
      const me = state.players.get(client.sessionId);
      const now = Date.now();
      setHud({
        matchPhase: state.matchPhase,
        survivorCount: state.survivorCount,
        // Clock values are resolved here, on the polling tick, so render
        // stays a pure function of state.
        countdownMs: state.countdownEndsAt ? state.countdownEndsAt - now : 0,
        elapsedMs: state.matchStartedAt ? now - state.matchStartedAt : 0,
        winnerWallet: state.winnerWallet,
        winnerTokenId: state.winnerTokenId,
        winnerCharacterName: state.winnerCharacterName,
        myPlacement: me?.placement ?? 0,
      });
    };

    const intervalId = setInterval(syncHud, 250);
    return () => {
      clearInterval(intervalId);
      inputManager.destroy();
      client.leave();
    };
  }, [session]);

  const backToLobby = () => {
    setSession(null);
    setPhase('lobby');
    setHud(null);
    setConnectError('');
    fetchStatus(wallet);
  };

  const handleEnter = async () => {
    setEntering(true);
    setEnterError('');
    setConnectError('');
    try {
      const body = { wallet_address: wallet };
      if (tokenIdInput.trim() !== '') body.token_id = Number(tokenIdInput);

      const res = await fetch('/api/arena/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnterError(data.error || 'Failed to enter match');
        setEntering(false);
        return;
      }

      setStatus((prev) => (prev ? { ...prev, glm_balance: data.glm_balance } : prev));
      setPhase('connecting');

      const client = new ArenaClient();
      try {
        await client.join(data.joinToken);
      } catch (joinErr) {
        console.error('Arena join failed:', joinErr);
        // Distinct from leaving a lobby, which the match server refunds
        // automatically: here the connection never reached the match server,
        // so nothing on that side knows this entry exists to refund it.
        setConnectError(
          `Your ${data.entry_amount} GLM entry fee was charged but joining the match server failed ` +
          `(${joinErr.message || 'unknown error'}). This particular failure isn't auto-refunded — ` +
          `please try again in a moment, and contact the team if the GLM doesn't come back.`
        );
        setPhase('lobby');
        setEntering(false);
        fetchStatus(wallet);
        return;
      }

      const inputManager = new InputManager();
      inputManager.attach();

      client.onLeave(() => {
        setPhase((p) => (p === 'match' ? 'disconnected' : p));
      });
      client.onError((code, message) => {
        console.error('Arena room error:', code, message);
        setConnectError(message || 'Connection error');
        setPhase('disconnected');
      });

      setSession({ client, inputManager });
      setPhase('match');
      setEntering(false);
    } catch (err) {
      console.error('Enter match error:', err);
      setEnterError('Network error - please try again');
      setEntering(false);
    }
  };

  if (!verified) {
    return (
      <section className="allow-hero grid-bg arena-page" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container">
          <p className="eyebrow">THE ARENA</p>
          <h2 className="title glow-text">LAST ONE STANDING</h2>
          <p className="lede">Connect your wallet, verify your Golemians, and drop into the collapsing arena.</p>

          <div className="card allow-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
            <h3 style={{ color: 'var(--yellow)' }}>CONNECT WALLET</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <WalletConnect onVerified={handleWalletVerified} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'connecting') {
    return (
      <section className="allow-hero grid-bg arena-page" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p className="eyebrow">THE ARENA</p>
          <h2 className="title glow-text">CONNECTING...</h2>
        </div>
      </section>
    );
  }

  if (phase === 'match' || phase === 'disconnected') {
    const showWinner = phase === 'match' && hud?.matchPhase === 'ended';

    return (
      <section className="allow-hero grid-bg arena-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div className="container">
          <div className="arena-stage-wrap">
            {phase === 'match' && session && (
              <ArenaCanvas client={session.client} inputManager={session.inputManager} />
            )}

            {phase === 'match' && hud && (
              <div className="arena-hud">
                <span className={`arena-hud-pill ${hud.matchPhase === 'countdown' ? 'warn' : ''}`}>
                  {hud.matchPhase === 'waiting' && 'WAITING FOR PLAYERS'}
                  {hud.matchPhase === 'countdown' && `STARTING IN ${formatCountdown(hud.countdownMs)}`}
                  {hud.matchPhase === 'playing' && `T+ ${formatCountdown(hud.elapsedMs)}`}
                  {hud.matchPhase === 'ended' && 'MATCH OVER'}
                </span>
                <span className="arena-hud-pill">{hud.survivorCount} ALIVE</span>
              </div>
            )}

            {phase === 'match' && session && <TouchControls inputManager={session.inputManager} />}

            {showWinner && (
              <div className="arena-winner-overlay">
                <p className="eyebrow">{hud.myPlacement === 1 ? 'VICTORY' : 'ELIMINATED'}</p>
                <h2 className="title glow-text" style={{ margin: 0 }}>
                  {hud.myPlacement === 1 ? 'YOU WON!' : 'YOU LOST'}
                </h2>
                {hud.myPlacement !== 1 && (
                  <p style={{ color: 'rgba(255,255,255,.7)', fontSize: '.9rem' }}>
                    Winner: {hud.winnerCharacterName || `GOLEM #${hud.winnerTokenId}`} ({formatWallet(hud.winnerWallet)})
                  </p>
                )}
                <button type="button" className="btn-cta" style={{ marginTop: '12px' }} onClick={backToLobby}>
                  BACK TO LOBBY
                </button>
              </div>
            )}

            {phase === 'disconnected' && (
              <div className="arena-disconnect-banner">
                <p className="eyebrow">CONNECTION LOST</p>
                {connectError && <p className="field-error">{connectError}</p>}
                <button type="button" className="btn-cta" onClick={backToLobby}>
                  BACK TO LOBBY
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // phase === 'lobby'
  const canEnter = status?.eligible_to_play && (status?.glm_balance ?? 0) >= (status?.match_entry_glm ?? Infinity) && !entering;
  const canClaim = status?.eligible_for_daily_claim && status?.daily_claim_ready && !claiming;

  return (
    <section className="allow-hero grid-bg arena-page" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
      <div className="container">
        <p className="eyebrow">THE ARENA</p>
        <h2 className="title glow-text">LAST ONE STANDING</h2>
        <p className="lede">{status?.min_golemians_to_play}+ Golemians to enter. Last Golem standing takes the pot.</p>

        <div className="arena-lobby-grid">
          <div className="card allow-card">
            <h3 style={{ color: 'var(--yellow)' }}>YOUR STATUS</h3>
            {statusLoading && !status && <p style={{ marginTop: '12px' }}>Loading...</p>}
            {statusError && <p className="field-error">{statusError}</p>}
            {status && (
              <div style={{ marginTop: '12px' }}>
                <div className="arena-stat-row"><span>GLM Balance</span><span>{status.glm_balance}</span></div>
                <div className="arena-stat-row"><span>Verified Golemians</span><span>{status.verified_golem_count}</span></div>
                <div className="arena-stat-row">
                  <span>Eligible to Play</span>
                  <span style={{ color: status.eligible_to_play ? 'var(--yellow)' : '#ff7a7a' }}>
                    {status.eligible_to_play ? 'YES' : 'NO'}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn-outline full-btn"
                  style={{ marginTop: '20px' }}
                  disabled={!canClaim}
                  onClick={handleClaimDaily}
                >
                  {claiming
                    ? 'CLAIMING...'
                    : status.daily_claim_ready
                      ? `CLAIM DAILY (${status.daily_claim_amount_glm} GLM)`
                      : 'DAILY CLAIM NOT READY'}
                </button>
                {!status.eligible_for_daily_claim && (
                  <p className="field-note">Need more Golemians to qualify for the daily claim.</p>
                )}
                {claimError && <p className="field-error">{claimError}</p>}
                {claimMessage && <p className="check-result wagmi" style={{ marginTop: '12px' }}>{claimMessage}</p>}
              </div>
            )}
          </div>

          <div className="card allow-card">
            <h3 style={{ color: '#fff' }}>ENTER THE ARENA</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div className="field">
                <label>YOUR GOLEM # (OPTIONAL)</label>
                <input
                  type="number"
                  value={tokenIdInput}
                  onChange={(e) => setTokenIdInput(e.target.value)}
                  placeholder="e.g. 1234"
                  min="0"
                />
              </div>
              {enterError && <p className="field-error">{enterError}</p>}
              {connectError && <p className="field-error">{connectError}</p>}
              <button type="button" className="btn-cta full-btn" disabled={!canEnter} onClick={handleEnter}>
                {entering ? 'ENTERING...' : `ENTER MATCH (${status?.match_entry_glm ?? '...'} GLM)`}
              </button>
              {status && !status.eligible_to_play && (
                <p className="field-note">Need {status.min_golemians_to_play}+ Golemians to play.</p>
              )}
              {status && status.eligible_to_play && (status.glm_balance ?? 0) < (status.match_entry_glm ?? 0) && (
                <p className="field-note">Not enough GLM — claim your daily reward or wait for more.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
