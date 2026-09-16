'use client';
import { useState, useEffect, useRef } from 'react';

const RUNGS = [
  { step: 1, tier: 'public', label: 'PUBLIC', multiplier: '2x' },
  { step: 2, tier: 'fcfs', label: 'FCFS', multiplier: '5x' }
];

export default function PvPGame() {
  const [wallet, setWallet] = useState('');
  const [verified, setVerified] = useState(false);
  const [playerStats, setPlayerStats] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Match state
  const [opponent, setOpponent] = useState('');
  const [stake, setStake] = useState('5');
  const [matchId, setMatchId] = useState(null);
  const [matchCreating, setMatchCreating] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchStatus, setMatchStatus] = useState('idle'); // idle, active, finished
  const [matchResult, setMatchResult] = useState(null);

  // Climb state
  const [p1Step, setP1Step] = useState(0);
  const [p2Step, setP2Step] = useState(0);
  const [climbing, setClimbing] = useState(false);
  const climbRef = useRef(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [tab, setTab] = useState('play'); // play, leaderboard, stats

  const verifyNft = async () => {
    if (!wallet.trim()) {
      setVerifyError('Enter your wallet address');
      return;
    }
    setVerifyError('');
    setVerifying(true);
    try {
      const res = await fetch('/api/pvp/verify-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: wallet.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error);
      } else {
        setVerified(true);
        await fetchPlayerStats(wallet.trim());
      }
    } catch (err) {
      setVerifyError('Network error - please try again');
    } finally {
      setVerifying(false);
    }
  };

  const fetchPlayerStats = async (walletAddr) => {
    try {
      const res = await fetch(`/api/pvp/player-stats?wallet=${encodeURIComponent(walletAddr)}`);
      const data = await res.json();
      if (res.ok) {
        setPlayerStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/pvp/leaderboard?limit=50');
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.players || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (tab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [tab]);

  const createMatch = async () => {
    if (!opponent.trim()) {
      setMatchError('Enter opponent wallet address');
      return;
    }
    setMatchError('');
    setMatchCreating(true);
    try {
      const res = await fetch('/api/pvp/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_wallet: wallet.trim(),
          player2_wallet: opponent.trim(),
          stake_amount: parseInt(stake) || 5
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error);
      } else {
        setMatchId(data.match_id);
        setMatchStatus('active');
        setP1Step(0);
        setP2Step(0);
      }
    } catch (err) {
      setMatchError('Network error creating match');
    } finally {
      setMatchCreating(false);
    }
  };

  const climb = async () => {
    if (climbRef.current || !matchId) return;
    climbRef.current = true;
    setClimbing(true);
    try {
      const res = await fetch('/api/pvp/play-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, action: 'climb' })
      });
      const data = await res.json();
      if (res.ok) {
        setP1Step(data.player1_step);
        setP2Step(data.player2_step);
        if (data.at_top) {
          // Option to cash out at top
          setMatchStatus('at_top');
        }
      } else {
        setMatchError(data.error);
      }
    } catch (err) {
      setMatchError('Network error - please try again');
    } finally {
      setClimbing(false);
      climbRef.current = false;
    }
  };

  const finishMatch = async () => {
    if (!matchId) return;
    setClimbing(true);
    try {
      const res = await fetch('/api/pvp/play-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, action: 'finish' })
      });
      const data = await res.json();
      if (res.ok) {
        setMatchStatus('finished');
        setMatchResult({
          result: data.result,
          winner: data.winner,
          tokens_transferred: data.tokens_transferred,
          p1_step: data.player1_final_step,
          p2_step: data.player2_final_step
        });
        await fetchPlayerStats(wallet);
      } else {
        setMatchError(data.error);
      }
    } catch (err) {
      setMatchError('Network error finishing match');
    } finally {
      setClimbing(false);
    }
  };

  const resetMatch = () => {
    setMatchId(null);
    setMatchStatus('idle');
    setP1Step(0);
    setP2Step(0);
    setMatchResult(null);
    setOpponent('');
  };

  if (!verified) {
    return (
      <section className="allow-hero grid-bg" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="container">
          <p className="eyebrow">PVP DUELS</p>
          <h2 className="title glow-text">BATTLE FOR TOKENS</h2>
          <p className="lede">Connect your wallet, verify 10+ NFTs, and challenge opponents.</p>

          <div className="card allow-card" style={{ maxWidth: '400px', margin: '40px auto' }}>
            <h3 style={{ color: 'var(--yellow)' }}>CONNECT WALLET</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div className="field">
                <label>EVM WALLET ADDRESS</label>
                <input
                  type="text"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="0x..."
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              {verifyError && <p className="field-error">{verifyError}</p>}
              <button
                type="button"
                className="btn-cta full-btn"
                disabled={verifying}
                onClick={verifyNft}
              >
                {verifying ? 'VERIFYING...' : 'VERIFY NFT'}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="allow-hero grid-bg">
      <div className="container" style={{ paddingBottom: '80px' }}>
        <p className="eyebrow">PVP DUELS</p>
        <h2 className="title glow-text">BATTLE FOR TOKENS</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '30px', justifyContent: 'center' }}>
          <button
            type="button"
            className={tab === 'play' ? 'btn-cta' : 'btn-outline'}
            style={{ padding: '10px 20px' }}
            onClick={() => setTab('play')}
          >
            PLAY
          </button>
          <button
            type="button"
            className={tab === 'stats' ? 'btn-cta' : 'btn-outline'}
            style={{ padding: '10px 20px' }}
            onClick={() => setTab('stats')}
          >
            MY STATS
          </button>
          <button
            type="button"
            className={tab === 'leaderboard' ? 'btn-cta' : 'btn-outline'}
            style={{ padding: '10px 20px' }}
            onClick={() => setTab('leaderboard')}
          >
            LEADERBOARD
          </button>
        </div>

        {/* PLAY TAB */}
        {tab === 'play' && (
          <div className="allow-grid allow-grid-2">
            <div className="card allow-card">
              <h3 style={{ color: 'var(--yellow)' }}>YOUR STATS</h3>
              {playerStats && (
                <div style={{ marginTop: '12px', fontSize: '.9rem' }}>
                  <p>NFTs: <strong>{playerStats.nft_balance}</strong></p>
                  <p>Tokens: <strong>{playerStats.tokens_held}</strong></p>
                  <p>Wins: <strong>{playerStats.total_wins}</strong></p>
                  <p>Losses: <strong>{playerStats.total_losses}</strong></p>
                  {playerStats.total_wins + playerStats.total_losses > 0 && (
                    <p>Win Rate: <strong>{playerStats.win_rate}%</strong></p>
                  )}
                </div>
              )}
            </div>

            <div className="card allow-card">
              <h3 style={{ color: '#fff' }}>CREATE CHALLENGE</h3>
              {matchStatus === 'idle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <div className="field">
                    <label>OPPONENT WALLET</label>
                    <input
                      type="text"
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value)}
                      placeholder="0x..."
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div className="field">
                    <label>STAKE (TOKENS)</label>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      min="1"
                      max={playerStats?.tokens_held || 100}
                    />
                  </div>
                  {matchError && <p className="field-error">{matchError}</p>}
                  <button
                    type="button"
                    className="btn-cta full-btn"
                    disabled={matchCreating}
                    onClick={createMatch}
                  >
                    {matchCreating ? 'CREATING...' : 'CHALLENGE'}
                  </button>
                </div>
              ) : matchStatus === 'finished' ? (
                <div>
                  <div className="check-result wagmi" style={{ marginTop: '16px' }}>
                    {matchResult?.result === 'draw' ? 'DRAW' : matchResult?.winner === 'player1' ? 'YOU WIN!' : 'YOU LOST'}
                    {matchResult?.result !== 'draw' && (
                      <span className="wagmi-sub">
                        {matchResult?.tokens_transferred || 0} tokens {matchResult?.winner === 'player1' ? 'won' : 'lost'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-cta full-btn"
                    style={{ marginTop: '12px' }}
                    onClick={resetMatch}
                  >
                    PLAY AGAIN
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '16px' }}>
                  {/* MATCH IN PROGRESS */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.6)', marginBottom: '8px' }}>LADDER CLIMB</p>
                    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '8px' }}>
                      {RUNGS.map((rung) => (
                        <div
                          key={rung.step}
                          style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: '6px',
                            border: `1px solid rgba(204,255,0,.2)`,
                            background: 'rgba(255,255,255,.02)',
                            fontSize: '.8rem'
                          }}
                        >
                          <span>{rung.label}</span>
                          <span>
                            {p1Step >= rung.step ? '✓ P1' : '-'} &nbsp;
                            {p2Step >= rung.step ? '✓ P2' : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-cta"
                      style={{ flex: 1 }}
                      disabled={climbing}
                      onClick={climb}
                    >
                      {climbing ? '...' : 'CLIMB'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1 }}
                      disabled={climbing}
                      onClick={finishMatch}
                    >
                      CASH OUT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && playerStats && (
          <div className="card allow-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ color: 'var(--yellow)' }}>DETAILED STATS</h3>
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '.9rem' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>NFT Balance</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{playerStats.nft_balance}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>Tokens Held</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{playerStats.tokens_held}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>Total Wins</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{playerStats.total_wins}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>Total Losses</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{playerStats.total_losses}</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>Win Rate</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{playerStats.win_rate}%</p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,.6)' }}>Tokens Won</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--yellow)' }}>{playerStats.total_tokens_won}</p>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === 'leaderboard' && (
          <div className="card allow-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 style={{ color: 'var(--yellow)', marginBottom: '16px' }}>TOP PLAYERS</h3>
            {loadingLeaderboard ? (
              <p>Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p>No players yet</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(204,255,0,.2)' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Rank</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Wallet</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Wins</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Losses</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Tokens Won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player) => (
                      <tr key={player.wallet} style={{ borderBottom: '1px solid rgba(204,255,0,.1)' }}>
                        <td style={{ padding: '8px', color: player.rank <= 3 ? 'var(--yellow)' : 'inherit', fontWeight: player.rank <= 3 ? 'bold' : 'normal' }}>
                          #{player.rank}
                        </td>
                        <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '.75rem' }}>
                          {player.wallet.slice(0, 8)}...{player.wallet.slice(-6)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>{player.wins}</td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>{player.losses}</td>
                        <td style={{ textAlign: 'right', padding: '8px', color: 'var(--yellow)' }}>
                          {player.tokens_won}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
