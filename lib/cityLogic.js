// City Builder Game Logic

export const STRUCTURE_TYPES = {
  goldmine: {
    label: 'Gold Mine',
    productionRate: 50,      // gold per hour per level
    defensiveValue: 0,
    buildCost: { gold: 100, wood: 50, food: 0 },
    description: 'Generates gold'
  },
  lumbermill: {
    label: 'Lumber Mill',
    productionRate: 40,      // wood per hour per level
    defensiveValue: 0,
    buildCost: { gold: 50, wood: 0, food: 50 },
    description: 'Generates wood'
  },
  farm: {
    label: 'Farm',
    productionRate: 60,      // food per hour per level
    defensiveValue: 0,
    buildCost: { gold: 30, wood: 30, food: 0 },
    description: 'Generates food'
  },
  wall: {
    label: 'City Wall',
    productionRate: 0,
    defensiveValue: 50,      // defense per level
    buildCost: { gold: 200, wood: 200, food: 0 },
    description: 'Adds defensive strength'
  },
  tower: {
    label: 'Defense Tower',
    productionRate: 0,
    defensiveValue: 100,     // defense per level
    buildCost: { gold: 300, wood: 100, food: 100 },
    description: 'Strong defense structure'
  }
};

// Calculate total production per hour
export function calculateHourlyProduction(structures) {
  const production = { gold: 0, wood: 0, food: 0 };

  structures.forEach(s => {
    const config = STRUCTURE_TYPES[s.structure_type];
    if (!config) return;

    if (s.structure_type === 'goldmine') {
      production.gold += config.productionRate * s.level;
    } else if (s.structure_type === 'lumbermill') {
      production.wood += config.productionRate * s.level;
    } else if (s.structure_type === 'farm') {
      production.food += config.productionRate * s.level;
    }
  });

  return production;
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

  // Attacker wins if random < chance
  const result = Math.random() < attackerChance;

  return {
    attackerWins: result,
    defenderWins: !result,
    isDraw: false
  };
}

// Calculate resources stolen in a raid
export function calculateStolenResources(defenderResources, attackerStrength) {
  const baseStealing = Math.min(100, attackerStrength / 10);

  return {
    gold: Math.floor(defenderResources.gold * (baseStealing / 100)),
    wood: Math.floor(defenderResources.wood * (baseStealing / 100)),
    food: Math.floor(defenderResources.food * (baseStealing / 100))
  };
}

// Calculate distance between two cities
export function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
