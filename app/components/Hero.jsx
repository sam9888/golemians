'use client';
import Image from 'next/image';

export default function Hero() {
  return (
    <section id="home" className="hero-banner">
      <img className="hero-banner-img" src="/banner.png" alt="Golemians Banner" />
      <div className="hero-banner-fade"></div>
    </section>
  );
}
