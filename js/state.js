'use strict';

const SAVE_KEY = 'celestial_alchemist_save';

const DEFAULT_STATE = {
  version: '1.0.0',
  resources: { stardust: 0, lunarEssence: 0, solarFlare: 0 },
  upgrades: {
    stardust: { telescope: 0, collector: 0, siphon: 0 },
    lunar:    { well: 0, condenser: 0, alchemist: 0 },
    solar:    { scoop: 0, forge: 0, reactor: 0 }
  },
  unlocks: { lunarEssence: false, solarFlare: false },
  stats: {
    totalStardust: 0, totalLunarEssence: 0, totalSolarFlare: 0,
    spentStardust: 0, spentLunarEssence: 0, spentSolarFlare: 0,
    totalClicks: 0
  },
  achievements: [],
  research: [],
  prestige: { shards: 0, count: 0, upgrades: [] }
};

let gameState = deepClone(DEFAULT_STATE);

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function saveGame() {
  const data = {
    version:      gameState.version,
    resources:    gameState.resources,
    upgrades:     gameState.upgrades,
    unlocks:      gameState.unlocks,
    stats:        gameState.stats,
    achievements: gameState.achievements,
    research:     gameState.research,
    prestige:     gameState.prestige
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    gameState = deepMerge(deepClone(DEFAULT_STATE), saved);
    gameState._cascadeFiredThisTick = false;
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  gameState = deepClone(DEFAULT_STATE);
  gameState._cascadeFiredThisTick = false;
}

function addResource(resource, amount) {
  if (amount <= 0) return;
  gameState.resources[resource] += amount;
  const statKey = 'total' + resource.charAt(0).toUpperCase() + resource.slice(1);
  if (gameState.stats[statKey] !== undefined) {
    gameState.stats[statKey] += amount;
  }
}

function spendResource(resource, amount) {
  if (gameState.resources[resource] < amount) return false;
  gameState.resources[resource] -= amount;
  const statKey = 'spent' + resource.charAt(0).toUpperCase() + resource.slice(1);
  if (gameState.stats[statKey] !== undefined) {
    gameState.stats[statKey] += amount;
  }
  return true;
}

function unlockResearch(nodeId) {
  if (!gameState.research.includes(nodeId)) {
    gameState.research.push(nodeId);
  }
}

function getPrestigeShardGain() {
  const s = gameState.stats;
  return Math.floor(
    Math.sqrt(s.totalStardust / 5000) +
    s.totalLunarEssence / 1000 +
    s.totalSolarFlare / 500
  );
}

function getPrestigeMultiplier() {
  return 1 + gameState.prestige.shards * 0.10;
}

function applyPrestigeStartingBonuses() {
  const pu = gameState.prestige.upgrades;
  if (pu.includes('starter_stardust') && gameState.resources.stardust < 500)
    gameState.resources.stardust = 500;
  if (pu.includes('ancient_memory') && !gameState.research.includes('root'))
    gameState.research.push('root');
}

function prestigeReset() {
  const gain = getPrestigeShardGain();
  if (gain < 1) return false;
  gameState.prestige.shards += gain;
  gameState.prestige.count++;
  const fresh = deepClone(DEFAULT_STATE);
  gameState.resources = fresh.resources;
  gameState.upgrades  = fresh.upgrades;
  gameState.unlocks   = fresh.unlocks;
  gameState.stats     = fresh.stats;
  gameState.research  = fresh.research;
  gameState._cascadeFiredThisTick = false;
  gameState._pendingUnlockShow    = {};
  applyPrestigeStartingBonuses();
  saveGame();
  return true;
}
