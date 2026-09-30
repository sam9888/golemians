'use client';

import WalletConnect from './WalletConnect';

export default function GameComingSoon() {
  return (
    <section id="play" className="panel voidbg texture">
      <div className="container-sm arena-cta-panel">
        <p className="eyebrow">THE ARENA</p>
        <h2 className="title">Golemians: <span className="glow-text">Last One Standing</span></h2>
        <p className="roadmap-desc">
          The real-time multiplayer battle arena is live. Connect your wallet,
          verify your Golemians, and enter the collapsing arena.
        </p>
        <div className="arena-cta-actions">
          <a href="/arena" className="btn-cta">ENTER THE ARENA</a>
          <WalletConnect />
        </div>
      </div>
    </section>
  );
}
