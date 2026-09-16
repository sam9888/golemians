// NFT Tier System - Badges & Rewards based on NFT holdings

export const NFT_TIERS = [
  {
    minNfts: 10,
    maxNfts: 14,
    tier: 'initiate',
    name: 'Initiate',
    badge: '⚔️',
    emoji: '⚔️ Initiate',
    dailyBonus: 500,
    battleWinBonus: 1.0,  // 1x multiplier
    description: 'Entry level Golemian holder. Recognized in the ring.'
  },
  {
    minNfts: 15,
    maxNfts: 24,
    tier: 'warrior',
    name: 'Warrior',
    badge: '🗡️',
    emoji: '🗡️ Warrior',
    dailyBonus: 1000,
    battleWinBonus: 1.25,  // 25% better odds
    description: 'Seasoned fighter. Enhanced rewards and battle prowess.'
  },
  {
    minNfts: 25,
    maxNfts: 49,
    tier: 'guardian',
    name: 'Guardian',
    badge: '🛡️',
    emoji: '🛡️ Guardian',
    dailyBonus: 2500,
    battleWinBonus: 1.5,  // 50% better odds
    description: 'Protector of the realm. Significant influence in battles.'
  },
  {
    minNfts: 50,
    maxNfts: 99,
    tier: 'lord',
    name: 'Lord',
    badge: '👑',
    emoji: '👑 Lord',
    dailyBonus: 5000,
    battleWinBonus: 2.0,  // 100% better odds
    description: 'Master of armies. Commands respect and power.'
  },
  {
    minNfts: 100,
    maxNfts: Infinity,
    tier: 'titan',
    name: 'Titan',
    badge: '⚡',
    emoji: '⚡ Titan',
    dailyBonus: 10000,
    battleWinBonus: 3.0,  // 300% better odds
    description: 'Legendary force. Dominates every battlefield.'
  }
];

export function getTierByNftCount(nftCount) {
  return NFT_TIERS.find(tier => nftCount >= tier.minNfts && nftCount <= tier.maxNfts) || NFT_TIERS[0];
}

export function getDailyBonusForTier(nftCount) {
  const tier = getTierByNftCount(nftCount);
  return tier.dailyBonus;
}

export function getBattleWinMultiplier(nftCount) {
  const tier = getTierByNftCount(nftCount);
  return tier.battleWinBonus;
}

export function calculateBattleWinOdds(attackerNfts, defenderNfts) {
  const attackerMultiplier = getBattleWinMultiplier(attackerNfts);
  const defenderMultiplier = getBattleWinMultiplier(defenderNfts);

  const attackerStrength = attackerNfts * attackerMultiplier;
  const defenderStrength = defenderNfts * defenderMultiplier;

  const totalStrength = attackerStrength + defenderStrength;
  return attackerStrength / totalStrength;
}

// Daily task types
export const DAILY_TASKS = [
  {
    id: 'build_structure',
    name: 'Build Structure',
    description: 'Build any structure in your city',
    reward: 100,
    icon: '🏗️'
  },
  {
    id: 'collect_resources',
    name: 'Claim Daily Rewards',
    description: 'Claim your daily reward generation',
    reward: 200,
    icon: '💰'
  },
  {
    id: 'complete_raid',
    name: 'Launch Raid',
    description: 'Attack another player\'s city',
    reward: 150,
    icon: '⚔️'
  },
  {
    id: 'defend_raid',
    name: 'Defend City',
    description: 'Successfully defend against a raid',
    reward: 250,
    icon: '🛡️'
  }
];

export function getTaskById(taskId) {
  return DAILY_TASKS.find(task => task.id === taskId);
}
