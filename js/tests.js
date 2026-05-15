'use strict';

let _passed = 0, _failed = 0;
const _tbody = document.getElementById('results');

function assert(desc, condition, detail) {
  const ok = !!condition;
  ok ? _passed++ : _failed++;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="status ${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</td>
    <td>${desc}</td>
    <td>${detail !== undefined ? String(detail) : ''}</td>
  `;
  _tbody.appendChild(row);
}

function assertClose(desc, actual, expected, epsilon) {
  epsilon = epsilon !== undefined ? epsilon : 0.0001;
  const ok = Math.abs(actual - expected) <= epsilon;
  assert(desc, ok, `got ${actual}, expected ${expected} (±${epsilon})`);
}

function freshState() {
  resetGame();
  gameState._cascadeFiredThisTick = false;
}

// ─── research.js ─────────────────────────────────────────────────────────────

freshState();
assert('22 nodes in RESEARCH_NODES', RESEARCH_NODES.length === 22, RESEARCH_NODES.length);
assert('RESEARCH_NODE_MAP has root', !!RESEARCH_NODE_MAP['root']);
assert('RESEARCH_NODE_MAP has solar_cascade_2', !!RESEARCH_NODE_MAP['solar_cascade_2']);

freshState();
assert('getNodeState(root) = locked when 0 stardust', getNodeState('root') === 'locked', getNodeState('root'));

freshState();
gameState.resources.stardust = 500;
assert('getNodeState(root) = unlockable at 500 stardust', getNodeState('root') === 'unlockable', getNodeState('root'));

freshState();
gameState.resources.stardust = 500;
gameState.research.push('root');
assert('getNodeState(root) = unlocked after pushing id', getNodeState('root') === 'unlocked', getNodeState('root'));

freshState();
gameState.research.push('root');
gameState.resources.stardust = 0;
assert('getNodeState(stardust_branch) locked when root unlocked but no stardust', getNodeState('stardust_branch') === 'locked');

freshState();
gameState.research.push('root');
gameState.resources.stardust = 2000;
assert('getNodeState(stardust_branch) = unlockable with root + enough stardust', getNodeState('stardust_branch') === 'unlockable');

freshState();
assert('canUnlockNode(sd_upg_mastery_1) false without stardust_branch', !canUnlockNode('sd_upg_mastery_1'));

freshState();
assert('getResearchEffects(multiplier) empty on fresh state', getResearchEffects('multiplier').length === 0);

freshState();
gameState.research.push('sd_upg_mastery_1');
const effects = getResearchEffects('multiplier');
assert('getResearchEffects(multiplier) returns 1 entry after unlocking sd_upg_mastery_1', effects.length === 1, effects.length);
assert('  …with correct target stardust_upgrades', effects[0].target === 'stardust_upgrades');
assert('  …with correct value 1.5', effects[0].value === 1.5, effects[0].value);

// ─── engine.js — upgrade costs ───────────────────────────────────────────────

freshState();
assert('getUpgradeCost(telescope) = 10 when 0 owned', getUpgradeCost('telescope') === 10, getUpgradeCost('telescope'));

freshState();
gameState.upgrades.stardust.telescope = 1;
assertClose('getUpgradeCost(telescope) ≈ 11.5 when 1 owned', getUpgradeCost('telescope'), 12, 1);

freshState();
gameState.research.push('sd_frugal_1');
assertClose('getUpgradeCost(telescope) ≈ 8.5 with sd_frugal_1', getUpgradeCost('telescope'), 9, 1);

freshState();
gameState.research.push('sd_frugal_1');
gameState.research.push('sd_frugal_2');
assertClose('getUpgradeCost(telescope) ≈ 5.95 with both frugal nodes', getUpgradeCost('telescope'), 6, 1);

// ─── engine.js — click amount ─────────────────────────────────────────────────

freshState();
assert('getClickAmount() = 1 on fresh state', getClickAmount() === 1, getClickAmount());

freshState();
gameState.research.push('sd_momentum_1');
assert('getClickAmount() = 4 with sd_momentum_1', getClickAmount() === 4, getClickAmount());

freshState();
gameState.research.push('sd_momentum_1');
gameState.research.push('sd_momentum_2');
assert('getClickAmount() = 12 with both momentum nodes', getClickAmount() === 12, getClickAmount());

// ─── engine.js — production rates ────────────────────────────────────────────

freshState();
const r0 = getProductionRates();
assert('all rates 0 on fresh state', r0.stardust === 0 && r0.lunarEssence === 0 && r0.solarFlare === 0,
  JSON.stringify(r0));

freshState();
gameState.upgrades.stardust.telescope = 2;
const r1 = getProductionRates();
assertClose('2 telescopes → expected stardust/s', r1.stardust, 2 * UPGRADE_BASE_RATES.telescope);

freshState();
gameState.upgrades.stardust.telescope = 2;
gameState.research.push('sd_upg_mastery_1');
const r2 = getProductionRates();
assertClose('2 telescopes + mastery I → ×1.5', r2.stardust, 2 * UPGRADE_BASE_RATES.telescope * 1.5);

freshState();
gameState.upgrades.stardust.telescope = 2;
gameState.research.push('sd_upg_mastery_1');
gameState.research.push('lunar_harmony_1');
const r3 = getProductionRates();
assertClose('+ stellar harmony I → +2 flat', r3.stardust, 2 * UPGRADE_BASE_RATES.telescope * 1.5 + 2.0);

freshState();
gameState.unlocks.lunarEssence = true;
const rLunar = getProductionRates();
assertClose('lunar essence unlocked → 1/s base', rLunar.lunarEssence, 1.0);

freshState();
gameState.unlocks.lunarEssence = true;
gameState.upgrades.lunar.well = 3;
const rLunar2 = getProductionRates();
assertClose('3 wells → 1 + expected lunarEssence/s', rLunar2.lunarEssence, 1 + 3 * UPGRADE_BASE_RATES.well);

freshState();
gameState.unlocks.lunarEssence = true;
gameState.upgrades.lunar.well = 3;
gameState.research.push('lunar_phase_1');
const rLunar3 = getProductionRates();
assertClose('phase amp I → ×1.5', rLunar3.lunarEssence, (1 + 3 * UPGRADE_BASE_RATES.well) * 1.5);

// ─── engine.js — processTick ──────────────────────────────────────────────────

freshState();
gameState.upgrades.stardust.telescope = 1;
processTick(0.1);
assertClose('1 telescope: after 1 tick stardust', gameState.resources.stardust, UPGRADE_BASE_RATES.telescope * 0.1);
assertClose('totalStardust matches', gameState.stats.totalStardust, UPGRADE_BASE_RATES.telescope * 0.1);

freshState();
gameState.resources.stardust = 998;
gameState.stats.totalStardust = 998;
gameState.upgrades.stardust.siphon = 1;
// 1 siphon at UPGRADE_BASE_RATES.siphon/s → rate*0.1 per tick
processTick(0.1);
assert('unlock not triggered before 1000', !gameState.unlocks.lunarEssence);
// tick until we cross 1000
while (gameState.resources.stardust < 1000) processTick(0.1);
assert('unlock signal set after crossing 1000', !!(gameState._pendingUnlockShow && gameState._pendingUnlockShow.lunarEssence));

// ─── state.js ─────────────────────────────────────────────────────────────────

freshState();
const canSpend = spendResource('stardust', 100);
assert('spendResource returns false when balance < amount', canSpend === false, canSpend);

freshState();
gameState.resources.stardust = 500;
const spent = spendResource('stardust', 100);
assert('spendResource returns true when sufficient', spent === true, spent);
assert('spendResource deducts correctly', gameState.resources.stardust === 400, gameState.resources.stardust);
assert('spentStardust stat increments', gameState.stats.spentStardust === 100, gameState.stats.spentStardust);

freshState();
gameState.resources.stardust = 999;
gameState.upgrades.stardust.telescope = 5;
gameState.research.push('root');
gameState.achievements.push('first_stardust');
saveGame();
// Simulate page reload: clear in-memory state without removing the localStorage save
gameState.resources.stardust = 0;
gameState.upgrades.stardust.telescope = 0;
gameState.research = [];
gameState.achievements = [];
assert('before loadGame, stardust is 0', gameState.resources.stardust === 0);
loadGame();
assert('loadGame restores stardust', gameState.resources.stardust === 999, gameState.resources.stardust);
assert('loadGame restores upgrades', gameState.upgrades.stardust.telescope === 5, gameState.upgrades.stardust.telescope);
assert('loadGame restores research', gameState.research.includes('root'), gameState.research);
assert('loadGame restores achievements', gameState.achievements.includes('first_stardust'));

// ─── Summary ─────────────────────────────────────────────────────────────────

document.getElementById('summary').innerHTML =
  `<span class="${_failed === 0 ? 'pass' : 'fail'}">` +
  `${_passed} passed, ${_failed} failed` +
  `</span>`;
