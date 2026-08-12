'use client';
import { useState } from 'react';

export default function Hero() {
  const [bannerFailed, setBannerFailed] = useState(false);

  return (
    <section id="home" className="hero-banner">
      {!bannerFailed ? (
        <img
          className="hero-banner-img"
          src="/banner.jpg"
          alt="Golemians Banner"
          onError={() => setBannerFailed(true)}
        />
      ) : (
        <div className="hero-banner-fallback">
          <span className="hero-banner-fallback-text">GOLEMIANS</span>
        </div>
      )}
      <div className="hero-banner-fade"></div>
    </section>
  );
}
