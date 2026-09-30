'use client';
import { useEffect, useRef, useState } from 'react';
import { connectWallet, getConnectedWallet, signMessage, verifyNftOwnership } from '@/lib/web3Connect';

// Real MetaMask connect + signature proof-of-ownership + server session.
//
// Security note: this component only ever calls `eth_requestAccounts`
// (read the connected address) and `personal_sign` (sign a plain,
// human-readable message). It never requests `eth_sendTransaction`,
// `approve`, or any token/NFT transfer — connecting a wallet here cannot
// move funds.
export default function WalletConnect({ onVerified }) {
  const [wallet, setWallet] = useState(null);
  const [verified, setVerified] = useState(false);
  const [nftBalance, setNftBalance] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | signing | verifying | error
  const [error, setError] = useState('');
  const onVerifiedRef = useRef(onVerified);
  // Bumped on every connect / account switch / disconnect so stale async
  // results from an older attempt can't overwrite the current state.
  const authAttemptRef = useRef(0);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    let cancelled = false;
    const provider = window.ethereum;
    const attempt = ++authAttemptRef.current;
    const isCurrent = () => !cancelled && attempt === authAttemptRef.current;

    // Restore the signed session only when the selected wallet account matches
    // it. A connected browser account alone is not proof of ownership.
    const hydrateSession = async () => {
      const addr = await getConnectedWallet();
      if (!isCurrent() || !addr) return;
      setWallet(addr);
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const session = await res.json();
        if (isCurrent() && session.authenticated && session.wallet?.toLowerCase() === addr) {
          setVerified(true);
          onVerifiedRef.current?.(addr);
          verifyNftOwnership(addr)
            .then((balance) => { if (isCurrent()) setNftBalance(balance); })
            .catch(() => {});
        }
      } catch {
        // Non-fatal; the user can sign in again.
      }
    };

    // The session belongs to the old account, so drop it on switch.
    const handleAccountsChanged = (accounts) => {
      authAttemptRef.current += 1;
      setWallet(accounts?.[0] ? accounts[0].toLowerCase() : null);
      setVerified(false);
      setNftBalance(null);
      setError('');
      setStatus('idle');
      onVerifiedRef.current?.(null);
      void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    };

    provider?.on?.('accountsChanged', handleAccountsChanged);
    hydrateSession();

    return () => {
      cancelled = true;
      provider?.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, []);

  const handleConnect = async () => {
    const attempt = ++authAttemptRef.current;
    setError('');
    setStatus('connecting');
    try {
      const address = await connectWallet();
      if (attempt !== authAttemptRef.current) return;
      setWallet(address);
      await handleVerify(address, attempt);
    } catch (err) {
      if (attempt !== authAttemptRef.current) return;
      setError(err.message || 'Failed to connect wallet');
      setStatus('error');
    }
  };

  const handleVerify = async (address, existingAttempt) => {
    const attempt = existingAttempt ?? ++authAttemptRef.current;
    const isCurrent = () => attempt === authAttemptRef.current;
    try {
      // 1. Ask the server for a one-time nonce + human-readable message.
      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(address)}`);
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error || 'Failed to start sign-in');
      if (!isCurrent()) return;

      // 2. Ask the wallet to sign it (a plain readable message — never a
      //    blind-sign blob, and never a transaction).
      setStatus('signing');
      const signature = await signMessage(address, nonceData.message);
      if (!isCurrent()) return;

      // 3. Server verifies the signature recovers to this address, then
      //    sets an httpOnly session cookie. No chain interaction here.
      setStatus('verifying');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, signature })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Signature verification failed');
      if (!isCurrent()) return;

      setVerified(true);
      setStatus('idle');
      onVerifiedRef.current?.(address);

      // Informational NFT balance display (read-only balanceOf call).
      // Final gating for game actions is always re-checked server-side.
      try {
        const balance = await verifyNftOwnership(address);
        if (isCurrent()) setNftBalance(balance);
      } catch {
        // Non-fatal — server routes independently re-verify NFT balance.
      }
    } catch (err) {
      if (!isCurrent()) return;
      setVerified(false);
      onVerifiedRef.current?.(null);
      setError(err.message || 'Sign-in failed');
      setStatus('error');
    }
  };

  const handleDisconnect = async () => {
    authAttemptRef.current += 1;
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setWallet(null);
    setVerified(false);
    setNftBalance(null);
    setError('');
    setStatus('idle');
    onVerifiedRef.current?.(null);
  };

  // Deliberately not named anything containing "wallet-connect" / "connect-wallet":
  // several ad blocker and privacy-extension filter lists (e.g. crypto-scam /
  // "badware" lists) match that exact string pattern and strip the element
  // entirely, silently hiding this button for a meaningful slice of visitors.
  if (verified && wallet) {
    return (
      <div className="site-auth-panel site-auth-panel--verified">
        <span>✅ Connected: {wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
        {nftBalance !== null && <span> · {nftBalance} Golemians NFTs</span>}
        <button className="btn-outline" onClick={handleDisconnect} style={{ marginLeft: 12 }}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="site-auth-panel">
      <button
        className="btn-cta"
        onClick={handleConnect}
        disabled={status === 'connecting' || status === 'signing' || status === 'verifying'}
      >
        {status === 'connecting' && 'Connecting...'}
        {status === 'signing' && 'Check your wallet to sign...'}
        {status === 'verifying' && 'Verifying...'}
        {status === 'idle' || status === 'error' ? 'Connect Wallet' : null}
      </button>
      {wallet && !verified && status === 'error' && (
        <button className="btn-outline" onClick={() => handleVerify(wallet)} style={{ marginLeft: 12 }}>
          Retry sign-in
        </button>
      )}
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: 8 }}>
        We only ask you to sign a message to prove wallet ownership — this never moves funds,
        approves spending, or triggers a transaction.
      </p>
    </div>
  );
}
