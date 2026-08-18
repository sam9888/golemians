'use client';
import { useState } from 'react';

const FAQ_ITEMS = [
  [
    'What is Golemians?',
    'Golemians is a community-built NFT collection of 4444 total items. Each Golemian is a character with a glowing tiled golem head, and holding a minimum of 5 NFTs unlocks weight in the monthly prize pool and governance.'
  ],
  [
    'What is the total supply and mint price?',
    'The total collection supply is 4444 NFTs. The minting price is TBA (To Be Announced) on our official X account.'
  ],
  [
    'How do I join the allowlist?',
    'Head to the Climb the Ladder section, complete the 3 tasks to earn plays, then start climbing. Bank a spot at any rung, or push higher and risk losing it all. Winning any tier lets you submit your X handle and wallet to claim it - use the wallet checker any time to confirm your GTD status.'
  ],
  [
    'How does the ladder game work?',
    'Complete the follow, retweet, and quote-tweet tasks to earn plays - no wallet needed for this part. Each play starts a climb: reach the Public rung, then choose to cash out or push further to FCFS, then GTD. Busting at any point loses the whole climb, including tiers already banked. Once a session wins any tier, that session can\'t play again - enter your X handle and wallet afterward to lock in the win.'
  ],
  [
    'What\'s the difference between GTD, FCFS, and Public?',
    'Out of the 4,444 total supply: 1,500 spots are GTD (guaranteed, reserved for early supporters who complete the steps first), 1,444 are FCFS (first come first serve once GTD is full), and the final 1,500 open to the general Public once FCFS is gone.'
  ],
  [
    'What wallets are supported?',
    'Only EVM-compatible wallets are supported for the allowlist and mint. Your address must start with 0x and contain exactly 40 hexadecimal characters.'
  ],
  [
    'What does the weight system do?',
    'Holding a minimum of 5 Golemians unlocks the weight system. From there, your tier (5 to 9 = 1x, 10 to 14 = 2x, 15+ = 3x) determines how many entries you receive in monthly draws and governance votes.'
  ],
  [
    'How are the monthly 50 winners chosen and rewarded?',
    'Every month, 50 winners are drawn at random from eligible holders, weighted by tier. 20 winners receive equal shares of 80% of the OpenSea secondary royalties treasury, while 30 winners receive Whitelist spots from partner NFT projects. Rewards are automatically transferred with no claim system needed.'
  ],
  [
    'Is there a Discord?',
    'Golemians currently coordinates entirely on X. Follow the official account for task tweets, announcements, and community updates.'
  ],
  [
    'When does minting happen?',
    'Mint follows the Allowlist phase on the roadmap. Exact dates and mint price (TBA) will be announced on X once allowlist phases close.'
  ]
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="panel voidbg">
      <div className="container-sm">
        <p className="eyebrow">GOT QUESTIONS</p>
        <h2 className="title" style={{ marginBottom: '56px' }}>FAQ</h2>
        <div className="accordion">
          {FAQ_ITEMS.map(([q, a], i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`card acc-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="acc-q"
                  onClick={() => toggle(i)}
                >
                  {q}
                  <span className="acc-plus">+</span>
                </button>
                <div
                  className="acc-a"
                  style={{
                    maxHeight: isOpen ? '250px' : '0px',
                    transition: 'max-height 0.25s ease'
                  }}
                >
                  <p>{a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
