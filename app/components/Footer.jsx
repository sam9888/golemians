'use client';
import { useEffect, useState } from 'react';
import XIcon from './XIcon';

export default function Footer() {
  const [year, setYear] = useState('');

  useEffect(() => {
    setYear(new Date().getFullYear().toString());
  }, []);

  return (
    <footer className="texture">
      <div className="divider"></div>
      <p className="footer-tag glow-text" style={{ margin: '20px 0' }}>
        BUILT BY THE COMMUNITY &bull; FOREVER EVOLVING
      </p>
      <div className="divider"></div>
      <div className="footer-links">
        <a href="#allowlist">ALLOWLIST</a>
        <a href="#guardians">GOLEMIANS</a>
        <a href="#utility">UTILITY</a>
        <a href="#roadmap">ROADMAP</a>
        <a href="#faq">FAQ</a>
        <a href="https://x.com/golemians" target="_blank" rel="noopener noreferrer" aria-label="Golemians on X">
          <XIcon size={16} style={{ width: '16px', height: '16px' }} />
        </a>
      </div>
      <p className="footer-copy">&copy; <span>{year}</span> Golemians. All rights reserved.</p>
    </footer>
  );
}
