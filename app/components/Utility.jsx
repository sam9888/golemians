'use client';

export default function Utility() {
  return (
    <section id="utility" className="panel charcoal texture">
      <div className="container">
        <p className="eyebrow">WHAT YOU GET</p>
        <h2 className="title">Utility &amp; <span className="glow-text">Holder Benefits</span></h2>
        <p className="lede">Holding Golemians is not passive. Every token grants direct access to rewards, secondary sales treasury distributions, and partner whitelist spots.</p>

        <div className="util-grid">
          <div className="card util-card">
            <div className="util-icon">⚡</div>
            <p className="util-name">The Weight System</p>
            <p className="util-desc">Must hold minimum 5 NFTs to qualify. 5 to 9 NFTs gets 1x weight, 10 to 14 NFTs gets 2x weight, and 15+ NFTs gets 3x weight in monthly raffles.</p>
          </div>
          <div className="card util-card">
            <div className="util-icon">🏆</div>
            <p className="util-name">Living Prize Pool</p>
            <p className="util-desc">Each month, 50 winners are selected from eligible holders (weighted by holding count) and paid from secondary sales treasury. Rewards are automatically transferred with no claim system needed.</p>
          </div>
          <div className="card util-card">
            <div className="util-icon">💰</div>
            <p className="util-name">OpenSea Treasury (80%)</p>
            <p className="util-desc">Funded by secondary royalties from OpenSea. 80% of the treasury is distributed equally among 20 cash reward winners every month.</p>
          </div>
          <div className="card util-card">
            <div className="util-icon">🛡️</div>
            <p className="util-name">Partner Whitelists</p>
            <p className="util-desc">30 winners every month automatically receive Whitelist spots from early partner NFT projects discovered across X and ecosystem domains.</p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="card stat-card"><p className="stat-val">5 NFT</p><p className="stat-label">ENTRY FLOOR</p></div>
          <div className="card stat-card"><p className="stat-val">80%</p><p className="stat-label">ROYALTY TREASURY</p></div>
          <div className="card stat-card"><p className="stat-val">50</p><p className="stat-label">MONTHLY WINNERS</p></div>
          <div className="card stat-card"><p className="stat-val">1200</p><p className="stat-label">GTD SPOTS</p></div>
        </div>
      </div>
    </section>
  );
}
