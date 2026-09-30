'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // If the wallet is already connected from a prior session, offer to
    // re-verify rather than silently trusting it.
    getConnectedWallet().then((addr) => {
      if (addr) setWallet(addr);
    });
  }, []);

  const handleConnect = async () => {
    setError('');
    setStatus('connecting');
    try {
      const address = await connectWallet();
      setWallet(address);
      await handleVerify(address);
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      setStatus('error');
    }
  };

  const handleVerify = async (address) => {
    try {
      // 1. Ask the server for a one-time nonce + human-readable message.
      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(address)}`);
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error || 'Failed to start sign-in');

      // 2. Ask the wallet to sign it (a plain readable message — never a
      //    blind-sign blob, and never a transaction).
      setStatus('signing');
      const signature = await signMessage(address, nonceData.message);

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

      setVerified(true);
      setStatus('idle');
      onVerified?.(address);

      // Informational NFT balance display (read-only balanceOf call).
      // Final gating for game actions is always re-checked server-side.
      try {
        const balance = await verifyNftOwnership(address);
        setNftBalance(balance);
      } catch {
        // Non-fatal — server routes independently re-verify NFT balance.
      }
    } catch (err) {
      setVerified(false);
      onVerified?.(null);
      setError(err.message || 'Sign-in failed');
      setStatus('error');
    }
  };

  const handleDisconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setWallet(null);
    setVerified(false);
    setNftBalance(null);
    onVerified?.(null);
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
