'use client';
import { useState } from 'react';
import XIcon from './XIcon';

const NAV_ITEMS = [
  { href: '#home', label: 'HOME' },
  { href: '#allowlist', label: 'ALLOWLIST' },
  { href: '#ladder', label: 'CLIMB THE LADDER' },
  { href: '#guardians', label: 'GOLEMIANS' },
  { href: '#utility', label: 'UTILITY' },
  { href: '#roadmap', label: 'ROADMAP' },
  { href: '#faq', label: 'FAQ' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <nav>
        <a href="#home" className="logo">
          <span className="logo-dot"></span>GOLEMIANS
        </a>
        <ul className="nav-links">
          {NAV_ITEMS.map(({ href, label }) => (
            <li key={href}>
              <a href={href} className="navlink">{label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-right">
          <a href="https://x.com/golemians" target="_blank" rel="noopener noreferrer" aria-label="Golemians on X">
            <XIcon />
          </a>
          <a href="#allowlist" className="btn-cta">JOIN ALLOWLIST</a>
        </div>
        <button
          className="hamburger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span><span></span><span></span>
        </button>
      </nav>
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {NAV_ITEMS.map(({ href, label }) => (
          <a key={href} href={href} className="navlink" onClick={() => setMenuOpen(false)}>
            {label}
          </a>
        ))}
        <div className="mobile-bottom">
          <a href="https://x.com/golemians" target="_blank" rel="noopener noreferrer" aria-label="Golemians on X">
            <XIcon />
          </a>
          <a href="#allowlist" className="btn-cta">JOIN ALLOWLIST</a>
        </div>
      </div>
    </header>
  );
}
