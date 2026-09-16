// City Builder Game Logic - $GOLE Token System

export const STRUCTURE_TYPES = {
  generator: {
    label: 'Token Generator',
    productionRatePerDay: 1000,  // $GOLE per day per level
    defensiveValue: 0,
    buildCost: 50000,  // Cost in $GOLE
    description: 'Generates $GOLE tokens daily'
  },
  wall: {
    label: 'City Wall',
    productionRatePerDay: 0,
    defensiveValue: 50,
    buildCost: 100000,
    description: 'Adds defensive strength'
  },
  tower: {
    label: 'Defense Tower',
    productionRatePerDay: 0,
    defensiveValue: 100,
    buildCost: 150000,
    description: 'Strong defense structure'
  }
};

export const GOLE_CONFIG = {
  totalSupply: 1000000000, // 1 billion
  dailyEmissionRate: 0.05, // 5% per day
  maxDailyClaimInterval: 24 * 60 * 60 * 1000 // 24 hours in ms
};

// Calculate total $GOLE production per day
export function calculateDailyProduction(structures) {
  return structures
    .filter(s => s.structure_type === 'generator')
    .reduce((total, s) => total + (STRUCTURE_TYPES[s.structure_type].productionRatePerDay * s.level), 0);
}

// Calculate daily yield reward
export function calculateDailyYield(goleBalance) {
  return Math.floor(goleBalance * GOLE_CONFIG.dailyEmissionRate);
}

// Calculate total defensive value
export function calculateDefense(structures) {
  return structures
    .filter(s => ['wall', 'tower'].includes(s.structure_type))
    .reduce((total, s) => total + (STRUCTURE_TYPES[s.structure_type].defensiveValue * s.level), 0);
}

// Generate random map coordinates (avoid duplicates)
export function generateCityCoordinates() {
  // Map is 100x100 grid
  return {
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100)
  };
}

// Calculate raid outcome
export function calculateRaidOutcome(attackerStrength, defenderStrength) {
  const totalStrength = attackerStrength + defenderStrength;
  const attackerChance = attackerStrength / totalStrength;

  return Math.random() < attackerChance;
}

// Calculate $GOLE stolen in a raid
export function calculateStolenGole(defenderBalance, attackerStrength) {
  // Steal 10-30% based on attacker strength advantage
  const stealPercent = Math.min(0.3, 0.1 + (attackerStrength / 1000) * 0.01);
  return Math.floor(defenderBalance * stealPercent);
}

// Calculate distance between two cities
export function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Check if player can claim daily rewards
export function canClaimDailyRewards(lastClaimedAt) {
  if (!lastClaimedAt) return true;
  const timeSinceLastClaim = Date.now() - new Date(lastClaimedAt).getTime();
  return timeSinceLastClaim >= GOLE_CONFIG.maxDailyClaimInterval;
}
