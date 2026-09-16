// Real-time PvP Map & Territory Control Logic

export const MAP_CONFIG = {
  gridSize: 100,
  maxDistance: 15,  // Max raid distance (hex)
  territoryRadius: 10,  // Hex radius each city controls
  closeRaidDistance: 5,  // Bonus raid distance
  mediumRaidDistance: 10,
  raidUpdateInterval: 30000  // 30 seconds for position updates
};

// Calculate hex distance between two coordinates
export function calculateHexDistance(x1, y1, x2, y2) {
  return Math.max(
    Math.abs(x1 - x2),
    Math.abs(y1 - y2),
    Math.abs((x1 - x2) + (y1 - y2))
  ) / 2;
}

// Check if raid is allowed based on proximity
export function canRaidCity(attackerX, attackerY, defenderX, defenderY) {
  const distance = calculateHexDistance(attackerX, attackerY, defenderX, defenderY);
  return distance <= MAP_CONFIG.maxDistance;
}

// Get raid damage multiplier based on distance
export function getRaidDamageMultiplier(attackerX, attackerY, defenderX, defenderY) {
  const distance = calculateHexDistance(attackerX, attackerY, defenderX, defenderY);

  if (distance <= MAP_CONFIG.closeRaidDistance) {
    return 1.5;  // 50% bonus
  } else if (distance <= MAP_CONFIG.mediumRaidDistance) {
    return 1.25;  // 25% bonus
  } else if (distance <= MAP_CONFIG.maxDistance) {
    return 1.0;  // Normal damage
  }

  return 0;  // Cannot raid
}

// Get nearby cities within raid distance
export function getNearbyEnemies(cityX, cityY, allCities) {
  return allCities.filter(city => {
    const distance = calculateHexDistance(cityX, cityY, city.x, city.y);
    return distance > 0 && distance <= MAP_CONFIG.maxDistance;
  }).map(city => ({
    ...city,
    distance: calculateHexDistance(cityX, cityY, city.x, city.y),
    damageMultiplier: getRaidDamageMultiplier(cityX, cityY, city.x, city.y),
    canRaid: canRaidCity(cityX, cityY, city.x, city.y)
  }));
}

// Calculate territory bonus from hex count
export function getTerritoryBonus(hexCount) {
  // 1% bonus per hex, max 100%
  return Math.min(hexCount * 0.01, 1.0);
}

// Get cities within territory radius
export function getCitiesInTerritory(controllerX, controllerY, allCities) {
  return allCities.filter(city => {
    const distance = calculateHexDistance(
      controllerX, controllerY,
      city.x, city.y
    );
    return distance <= MAP_CONFIG.territoryRadius && distance > 0;
  });
}

// Calculate faction control (territory coverage)
export function calculateTerritoryControl(playerCities) {
  // Simple: count all cities within territory radius
  let totalControlled = 0;

  playerCities.forEach(city => {
    // Each city controls a radius
    totalControlled += MAP_CONFIG.territoryRadius * 2;
  });

  return Math.min(totalControlled, 100);  // Cap at 100 hexes
}

// Determine fog of war visibility
export function isPlayerVisible(playerX, playerY, viewerX, viewerY) {
  const distance = calculateHexDistance(playerX, playerY, viewerX, viewerY);
  return distance <= MAP_CONFIG.maxDistance;
}

// Get proximity alert level
export function getProximityAlert(playerX, playerY, nearbyEnemies) {
  if (nearbyEnemies.length === 0) return 'safe';

  const closestDistance = Math.min(...nearbyEnemies.map(e => e.distance));

  if (closestDistance <= 3) return 'danger';
  if (closestDistance <= 7) return 'warning';
  return 'caution';
}
