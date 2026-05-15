'use strict';

const PRESTIGE_UPGRADES = [
  { id: 'starter_stardust', name: 'Stardust Cache',  cost: 3, desc: 'Begin each run with 500 Stardust.' },
  { id: 'quick_gather',     name: 'Practiced Hands', cost: 3, desc: '+2 stardust per click, permanently.' },
  { id: 'ancient_memory',   name: 'Ancient Memory',  cost: 5, desc: 'Begin each run with Cosmic Insight already researched.' },
  { id: 'moongate',         name: 'Moongate',        cost: 5, desc: 'Lunar Essence unlocks at 750 Stardust instead of 1,000.' },
  { id: 'sun_door',         name: 'Sun Door',        cost: 7, desc: 'Solar Flare unlocks at 750 Lunar Essence instead of 1,000.' },
  { id: 'frugal_universe',  name: 'Frugal Universe', cost: 8, desc: 'All upgrade costs permanently ×0.80.' },
];

const UPGRADE_BASE_RATES = {
  telescope: 1, collector: 5, siphon: 10,
  well:      1, condenser: 5, alchemist: 10,
  scoop:     1, forge:     5, reactor:   10
};

const UPGRADE_BASE_COSTS = {
  telescope: 10,   collector: 100,   siphon: 1000,
  well:      10,   condenser: 100,   alchemist: 1000,
  scoop:     10,   forge:     100,   reactor:   1000
};

const UPGRADE_RESOURCE = {
  telescope: 'stardust', collector: 'stardust', siphon: 'stardust',
  well: 'lunarEssence', condenser: 'lunarEssence', alchemist: 'lunarEssence',
  scoop: 'solarFlare', forge: 'solarFlare', reactor: 'solarFlare'
};

const UPGRADE_GROUP = {
  telescope: 'stardust_upgrades', collector: 'stardust_upgrades', siphon: 'stardust_upgrades',
  well: 'lunar_upgrades', condenser: 'lunar_upgrades', alchemist: 'lunar_upgrades',
  scoop: 'solar_upgrades', forge: 'solar_upgrades', reactor: 'solar_upgrades'
};

let _loopId = null;

function getLunarUnlockThreshold() {
  return gameState.prestige.upgrades.includes('moongate') ? 750 : 1000;
}

function getSolarUnlockThreshold() {
  return gameState.prestige.upgrades.includes('sun_door') ? 750 : 1000;
}

function getCostReductionMultiplier(group) {
  const effects = getResearchEffects('costReduction').filter(e => e.target === group);
  return effects.reduce((acc, e) => acc * e.value, 1.0);
}

function getUpgradeCost(upgradeName) {
  const base = UPGRADE_BASE_COSTS[upgradeName];
  const owned = (() => {
    const res = UPGRADE_RESOURCE[upgradeName];
    const group = res === 'stardust' ? 'stardust' : res === 'lunarEssence' ? 'lunar' : 'solar';
    return gameState.upgrades[group][upgradeName];
  })();
  const reduction = getCostReductionMultiplier(UPGRADE_GROUP[upgradeName]);
  const prestigeDiscount = gameState.prestige.upgrades.includes('frugal_universe') ? 0.8 : 1.0;
  return Math.ceil(base * Math.pow(1.15, owned) * reduction * prestigeDiscount);
}

function getClickAmount() {
  const bonuses = getResearchEffects('clickBonus').reduce((sum, e) => sum + e.value, 0);
  const prestigeBonus = gameState.prestige.upgrades.includes('quick_gather') ? 2 : 0;
  return 1 + bonuses + prestigeBonus;
}

function getProductionRates() {
  const u = gameState.upgrades;

  // Raw upgrade production per second
  let rawStardust = u.stardust.telescope * UPGRADE_BASE_RATES.telescope
                  + u.stardust.collector  * UPGRADE_BASE_RATES.collector
                  + u.stardust.siphon     * UPGRADE_BASE_RATES.siphon;

  let rawLunar = gameState.unlocks.lunarEssence
    ? (1 + u.lunar.well      * UPGRADE_BASE_RATES.well
         + u.lunar.condenser  * UPGRADE_BASE_RATES.condenser
         + u.lunar.alchemist  * UPGRADE_BASE_RATES.alchemist)
    : 0;

  let rawSolar = gameState.unlocks.solarFlare
    ? (1 + u.solar.scoop   * UPGRADE_BASE_RATES.scoop
         + u.solar.forge    * UPGRADE_BASE_RATES.forge
         + u.solar.reactor  * UPGRADE_BASE_RATES.reactor)
    : 0;

  // Apply multipliers
  const stardustUpgradeMult = getResearchEffects('multiplier')
    .filter(e => e.target === 'stardust_upgrades')
    .reduce((acc, e) => acc * e.value, 1.0);

  const lunarMult = getResearchEffects('multiplier')
    .filter(e => e.target === 'lunarEssence')
    .reduce((acc, e) => acc * e.value, 1.0);

  const solarMult = getResearchEffects('multiplier')
    .filter(e => e.target === 'solarFlare')
    .reduce((acc, e) => acc * e.value, 1.0);

  rawStardust *= stardustUpgradeMult;
  rawLunar    *= lunarMult;
  rawSolar    *= solarMult;

  // Apply flat bonuses (additive, after multipliers)
  const stardustFlat = getResearchEffects('flat')
    .filter(e => e.target === 'stardust')
    .reduce((sum, e) => sum + e.value, 0);

  const m = getPrestigeMultiplier();
  return {
    stardust:     (rawStardust + stardustFlat) * m,
    lunarEssence: rawLunar * m,
    solarFlare:   rawSolar * m
  };
}

function processTick(dt) {
  const rates = getProductionRates();

  let stardustGain     = rates.stardust     * dt;
  let lunarEssenceGain = rates.lunarEssence * dt;
  let solarFlareGain   = rates.solarFlare   * dt;

  // Radiant Cascade: per-tick probability pulse
  gameState._cascadeFiredThisTick = false;
  const cascadeEffects = getResearchEffects('crossResource');
  for (const effect of cascadeEffects) {
    if (Math.random() < effect.value) {
      stardustGain += rates.solarFlare * 0.1 * dt;
      gameState._cascadeFiredThisTick = true;
    }
  }

  if (stardustGain     > 0) addResource('stardust',     stardustGain);
  if (lunarEssenceGain > 0) addResource('lunarEssence', lunarEssenceGain);
  if (solarFlareGain   > 0) addResource('solarFlare',   solarFlareGain);

  // Unlock thresholds
  if (!gameState.unlocks.lunarEssence && gameState.resources.stardust >= getLunarUnlockThreshold()) {
    _showUnlockButton('lunarEssence');
  }
  if (gameState.unlocks.lunarEssence && !gameState.unlocks.solarFlare && gameState.resources.lunarEssence >= getSolarUnlockThreshold()) {
    _showUnlockButton('solarFlare');
  }
}

function _showUnlockButton(resource) {
  // Signal to game.js — game.js polls this via updateShop()
  gameState._pendingUnlockShow = gameState._pendingUnlockShow || {};
  gameState._pendingUnlockShow[resource] = true;
}

function tryBuyUpgrade(upgradeName) {
  const resource = UPGRADE_RESOURCE[upgradeName];
  const cost = getUpgradeCost(upgradeName);
  if (!spendResource(resource, cost)) return false;

  const group = resource === 'stardust' ? 'stardust' : resource === 'lunarEssence' ? 'lunar' : 'solar';
  gameState.upgrades[group][upgradeName]++;
  return true;
}

function tryUnlockResource(resourceName) {
  const costs = { lunarEssence: getLunarUnlockThreshold(), solarFlare: getSolarUnlockThreshold() };
  const sources = { lunarEssence: 'stardust', solarFlare: 'lunarEssence' };
  const cost = costs[resourceName];
  const source = sources[resourceName];
  if (!spendResource(source, cost)) return false;
  gameState.unlocks[resourceName] = true;
  return true;
}

function tryUnlockResearchNode(nodeId) {
  if (!canUnlockNode(nodeId)) return false;
  const node = RESEARCH_NODE_MAP[nodeId];
  if (!spendResource(node.cost.resource, node.cost.amount)) return false;
  unlockResearch(nodeId);
  return true;
}

function tryBuyPrestigeUpgrade(id) {
  if (gameState.prestige.upgrades.includes(id)) return false;
  const def = PRESTIGE_UPGRADES.find(u => u.id === id);
  if (!def || gameState.prestige.shards < def.cost) return false;
  gameState.prestige.shards -= def.cost;
  gameState.prestige.upgrades.push(id);
  saveGame();
  return true;
}

function startLoop() {
  if (_loopId !== null) clearInterval(_loopId);
  _loopId = setInterval(() => processTick(0.1), 100);
  return _loopId;
}

function stopLoop() {
  if (_loopId !== null) {
    clearInterval(_loopId);
    _loopId = null;
  }
}
