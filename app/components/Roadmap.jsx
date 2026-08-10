'use client';

export default function Roadmap() {
  return (
    <section id="roadmap" className="panel voidbg texture">
      <div className="container-sm">
        <p className="eyebrow">THE PATH</p>
        <h2 className="title">Roadmap <span className="glow-text">to Eternity</span></h2>
        <div className="roadmap-row">
          <div className="roadmap-line"></div>
          <div className="roadmap-step">
            <p className="roadmap-n">01</p>
            <p className="roadmap-title">Launch</p>
            <p className="roadmap-desc">Golemians goes live. Community formed, socials open, lore begins.</p>
          </div>
          <div className="roadmap-step">
            <p className="roadmap-n">02</p>
            <p className="roadmap-title">Allowlist</p>
            <p className="roadmap-desc">GTD and FCFS phases open. Early supporters lock in mint access.</p>
          </div>
          <div className="roadmap-step">
            <p className="roadmap-n">03</p>
            <p className="roadmap-title">Mint</p>
            <p className="roadmap-desc">The collection mints out. Golemians take their place on-chain.</p>
          </div>
          <div className="roadmap-step">
            <p className="roadmap-n">04</p>
            <p className="roadmap-title">Golemians</p>
            <p className="roadmap-desc">Weight system activates. Monthly winner draws begin.</p>
          </div>
          <div className="roadmap-step">
            <p className="roadmap-n">05</p>
            <p className="roadmap-title">Expansion</p>
            <p className="roadmap-desc">New utility, partner drops, community-voted initiatives roll out.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
