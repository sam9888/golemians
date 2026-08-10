'use client';

export default function GuardiansSystem() {
  return (
    <>
      <section id="guardian-system" className="panel voidbg texture" style={{ position: 'relative' }}>
        <div className="container">
          <p className="eyebrow">THE GOLEMIAN SYSTEM</p>
          <h2 className="title">Hold <span className="glow-text">Minimum 5 NFTs</span> to Enter the Weight System</h2>
          <p className="lede">Every Golemian you hold adds weight to your standing in the community, from allowlist priority to prize pool share. Five is the floor. From there, the tiers multiply your influence.</p>
          <div className="tier-grid">
            <div className="card tier-card">
              <p className="tier-weight">1x</p>
              <p className="tier-name">Initiate</p>
              <p className="tier-desc">Hold 5 to 9 NFTs. You are recognized by the ring and weight begins to accrue.</p>
            </div>
            <div className="card tier-card">
              <p className="tier-weight">2x</p>
              <p className="tier-name">Keeper</p>
              <p className="tier-desc">Hold 10 to 14 NFTs. Your voice and rewards carry double weight in every draw.</p>
            </div>
            <div className="card tier-card">
              <p className="tier-weight">3x</p>
              <p className="tier-name">Elder</p>
              <p className="tier-desc">Hold 15+ NFTs. Triple weight in every raffle draw, vote, and pool distribution.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="guardians" className="page-hero">
        <p className="eyebrow">WHO ARE THE GOLEMIANS</p>
        <h2 className="title glow-text" style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>THE GOLEMIAN SYSTEM</h2>
        <p className="lede">Every Golemian is a permanent record of how much of the collection you hold, and how much weight you carry in the community.</p>
      </section>
    </>
  );
}
