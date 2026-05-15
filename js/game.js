'use strict';

// ─── Achievements ─────────────────────────────────────────────────────────────

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_stardust',    icon: '✦', name: 'Starseeker',       desc: 'Gather your first Stardust.',              check: s => s.totalStardust >= 1 },
  { id: 'stardust_100',      icon: '✦', name: 'Dust Collector',   desc: 'Accumulate 100 total Stardust.',           check: s => s.totalStardust >= 100 },
  { id: 'stardust_1k',       icon: '✦', name: 'Star Hoarder',     desc: 'Accumulate 1,000 total Stardust.',         check: s => s.totalStardust >= 1000 },
  { id: 'stardust_100k',     icon: '✦', name: 'Cosmic Dust',      desc: 'Accumulate 100,000 total Stardust.',       check: s => s.totalStardust >= 100000 },
  { id: 'lunar_unlocked',    icon: '☽', name: 'Moonrise',         desc: 'Unlock Lunar Essence.',                    check: (s, u) => u.lunarEssence },
  { id: 'solar_unlocked',    icon: '☀', name: 'Solar Dawn',       desc: 'Unlock Solar Flare.',                      check: (s, u) => u.solarFlare },
  { id: 'clicks_10',         icon: '👆', name: 'Eager Hands',      desc: 'Click 10 times.',                          check: s => s.totalClicks >= 10 },
  { id: 'clicks_100',        icon: '👆', name: 'Tireless',         desc: 'Click 100 times.',                         check: s => s.totalClicks >= 100 },
  { id: 'clicks_1000',       icon: '👆', name: 'Clicker Supreme',  desc: 'Click 1,000 times.',                       check: s => s.totalClicks >= 1000 },
  { id: 'research_first',    icon: '🔬', name: 'Inquiring Mind',   desc: 'Unlock your first research node.',         check: (s, u, r) => r.length >= 1 },
  { id: 'research_5',        icon: '🔬', name: 'Scholar',          desc: 'Unlock 5 research nodes.',                 check: (s, u, r) => r.length >= 5 },
  { id: 'research_all',      icon: '🔬', name: 'Omniscient',       desc: 'Unlock all research nodes.',               check: (s, u, r) => r.length >= RESEARCH_NODES.length },
  { id: 'spend_stardust_1k', icon: '💸', name: 'Investor',         desc: 'Spend 1,000 Stardust on upgrades.',        check: s => s.spentStardust >= 1000 },
  { id: 'orb_clicked',       icon: '🔮', name: 'Orb Touched',      desc: 'Click the bouncing celestial orb.',        check: s => s.totalOrbClicks >= 1 },
  { id: 'first_prestige',    icon: '⭐', name: 'Reborn',           desc: 'Perform your first Cosmic Rebirth.',       check: (s,u,r,p) => p.count >= 1 },
  { id: 'prestige_10shards', icon: '⭐', name: 'Shard Seeker',     desc: 'Accumulate 10 Cosmic Shards.',             check: (s,u,r,p) => p.shards >= 10 }
];

// ─── Formatting ──────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return Math.floor(n).toString();
}

function fmtRate(n) {
  if (n === 0) return '';
  return '+' + n.toFixed(1) + '/s';
}

function fmtCost(amount, resource) {
  const labels = { stardust: 'Stardust', lunarEssence: 'Lunar Essence', solarFlare: 'Solar Flare' };
  return fmt(amount) + ' ' + labels[resource];
}

// ─── Floating Text ────────────────────────────────────────────────────────────

function spawnFloat(text, x, y, color) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  if (color) el.style.color = color;
  document.getElementById('float-container').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function spawnFloatNearEl(text, el, color) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2 - 20 + (Math.random() - 0.5) * 40;
  const y = r.top  - 10 + (Math.random() - 0.5) * 20;
  spawnFloat(text, x, y, color);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(title, body) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body}</div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function checkAchievements() {
  const s = gameState.stats;
  const u = gameState.unlocks;
  const r = gameState.research;
  const p = gameState.prestige;
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (!gameState.achievements.includes(def.id) && def.check(s, u, r, p)) {
      gameState.achievements.push(def.id);
      showToast(def.icon + ' ' + def.name, def.desc);
    }
  }
}

function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = '';
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const unlocked = gameState.achievements.includes(def.id);
    const card = document.createElement('div');
    card.className = 'achievement-card ' + (unlocked ? 'unlocked' : 'locked');
    card.innerHTML = `
      <div class="ach-icon">${def.icon}</div>
      <div class="ach-name">${def.name}</div>
      <div class="ach-desc">${unlocked ? def.desc : '???'}</div>
    `;
    grid.appendChild(card);
  }
}

function renderPrestigeOverlay() {
  const shards   = gameState.prestige.shards;
  const gain     = getPrestigeShardGain();
  const newTotal = shards + gain;
  document.getElementById('prestige-current-shards').textContent = shards;
  document.getElementById('prestige-gain').textContent = '+' + gain;
  document.getElementById('prestige-new-total').textContent = newTotal;
  document.getElementById('prestige-new-mult').textContent = '×' + (1 + newTotal * 0.10).toFixed(2);
  document.getElementById('btn-confirm-prestige').disabled = gain < 1;

  const grid = document.getElementById('prestige-upgrades-grid');
  grid.innerHTML = '';
  for (const upg of PRESTIGE_UPGRADES) {
    const owned  = gameState.prestige.upgrades.includes(upg.id);
    const canBuy = !owned && shards >= upg.cost;
    const card   = document.createElement('div');
    card.className = 'prestige-upgrade-card' + (owned ? ' owned' : '');
    card.innerHTML = `
      <div class="pu-name">${upg.name}</div>
      <div class="pu-desc">${upg.desc}</div>
      <button class="pu-buy" data-upg="${upg.id}" ${owned || !canBuy ? 'disabled' : ''}>
        ${owned ? 'Owned' : upg.cost + ' ✦'}
      </button>
    `;
    grid.appendChild(card);
  }
}

// ─── Research Tree ────────────────────────────────────────────────────────────

let researchRendered = false;
let _tooltip = null;

function renderResearchTree() {
  const canvas  = document.getElementById('research-canvas');
  const svgEl   = document.getElementById('research-lines');
  svgEl.innerHTML = '';

  // Draw edges first (behind nodes)
  for (const node of RESEARCH_NODES) {
    for (const reqId of node.requires) {
      const parent = RESEARCH_NODE_MAP[reqId];
      if (!parent) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const px = parent.layout.x + 30;
      const py = parent.layout.y + 30;
      const cx = node.layout.x + 30;
      const cy = node.layout.y + 30;
      line.setAttribute('x1', px); line.setAttribute('y1', py);
      line.setAttribute('x2', cx); line.setAttribute('y2', cy);
      line.setAttribute('data-edge', reqId + '-' + node.id);
      svgEl.appendChild(line);
    }
  }

  // Remove old nodes
  canvas.querySelectorAll('.research-node').forEach(el => el.remove());

  // Create node elements
  for (const node of RESEARCH_NODES) {
    const el = document.createElement('div');
    el.className = 'research-node';
    el.dataset.id = node.id;
    el.style.left = node.layout.x + 'px';
    el.style.top  = node.layout.y + 'px';

    const branchClass = node.branch ? 'branch-' + node.branch : 'branch-root';
    el.classList.add(branchClass);

    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = node.name;
    el.appendChild(label);

    canvas.appendChild(el);
  }

  researchRendered = true;
  refreshResearchNodeStates();
}

function refreshResearchNodeStates() {
  if (!researchRendered) return;
  const canvas = document.getElementById('research-canvas');
  const svgEl  = document.getElementById('research-lines');

  for (const node of RESEARCH_NODES) {
    const el = canvas.querySelector('[data-id="' + node.id + '"]');
    if (!el) continue;
    const state = getNodeState(node.id);
    el.classList.remove('locked', 'unlockable', 'unlocked');
    el.classList.add(state);
  }

  // Update edge colors
  for (const node of RESEARCH_NODES) {
    for (const reqId of node.requires) {
      const edge = svgEl.querySelector('[data-edge="' + reqId + '-' + node.id + '"]');
      if (!edge) continue;
      const bothUnlocked = gameState.research.includes(reqId) && gameState.research.includes(node.id);
      edge.style.stroke = bothUnlocked ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.15)';
      edge.style.strokeWidth = '2';
    }
  }
}

function showResearchTooltip(node, e) {
  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.id = 'research-tooltip';
    document.body.appendChild(_tooltip);
  }
  const state = getNodeState(node.id);
  const reqNames = node.requires.map(r => RESEARCH_NODE_MAP[r]?.name || r).join(', ');
  const locked = state === 'locked' && node.requires.length > 0 && !node.requires.every(r => gameState.research.includes(r));

  _tooltip.innerHTML = `
    <div class="tt-name">${node.name}</div>
    <div class="tt-desc">${node.description}</div>
    <div class="tt-cost">Cost: ${fmtCost(node.cost.amount, node.cost.resource)}</div>
    ${locked ? `<div class="tt-req">Requires: ${reqNames}</div>` : ''}
  `;
  _tooltip.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  if (!_tooltip) return;
  _tooltip.style.left = (e.clientX + 14) + 'px';
  _tooltip.style.top  = (e.clientY - 10) + 'px';
}

function hideTooltip() {
  if (_tooltip) _tooltip.style.display = 'none';
}

// ─── HUD + Shop ───────────────────────────────────────────────────────────────

function updateHUD() {
  const r = gameState.resources;
  document.getElementById('hud-stardust-amount').textContent = fmt(r.stardust);
  document.getElementById('hud-lunar-amount').textContent    = fmt(r.lunarEssence);
  document.getElementById('hud-solar-amount').textContent    = fmt(r.solarFlare);

  const rates = getProductionRates();
  document.getElementById('hud-stardust-rate').textContent = fmtRate(rates.stardust);
  document.getElementById('hud-lunar-rate').textContent    = fmtRate(rates.lunarEssence);
  document.getElementById('hud-solar-rate').textContent    = fmtRate(rates.solarFlare);

  document.getElementById('shop-stardust-rate').textContent = fmtRate(rates.stardust);
  document.getElementById('shop-lunar-rate').textContent    = fmtRate(rates.lunarEssence);
  document.getElementById('shop-solar-rate').textContent    = fmtRate(rates.solarFlare);

  document.getElementById('gather-amount').textContent = '+' + getClickAmount();

  const hasAffordable = RESEARCH_NODES.some(n => getNodeState(n.id) === 'unlockable');
  document.getElementById('btn-research').classList.toggle('has-affordable', hasAffordable);

  const shards = gameState.prestige.shards;
  if (shards > 0) {
    document.getElementById('hud-prestige').classList.remove('hidden');
    document.getElementById('hud-prestige-shards').textContent = shards;
    document.getElementById('hud-prestige-mult').textContent = '×' + getPrestigeMultiplier().toFixed(2);
  }
  const btnPrestige = document.getElementById('btn-prestige');
  if (getPrestigeShardGain() >= 1) {
    btnPrestige.classList.remove('hidden');
    btnPrestige.classList.add('can-prestige');
  }
}

const UPGRADE_LABELS = {
  telescope: 'stardust', collector: 'stardust', siphon: 'stardust',
  well: 'lunarEssence', condenser: 'lunarEssence', alchemist: 'lunarEssence',
  scoop: 'solarFlare', forge: 'solarFlare', reactor: 'solarFlare'
};
const RESOURCE_NAMES = { stardust: 'Stardust', lunarEssence: 'Lunar Essence', solarFlare: 'Solar Flare' };

function updateShop() {
  // Show/hide unlock buttons based on threshold
  const btnLunar = document.getElementById('btn-unlock-lunar');
  const btnSolar = document.getElementById('btn-unlock-solar');

  const lunarThreshold = getLunarUnlockThreshold();
  const solarThreshold = getSolarUnlockThreshold();

  btnLunar.querySelector('.btn-sub').textContent = fmt(lunarThreshold) + ' Stardust';
  btnSolar.querySelector('.btn-sub').textContent = fmt(solarThreshold) + ' Lunar Essence';

  if (!gameState.unlocks.lunarEssence) {
    if (gameState.resources.stardust >= lunarThreshold) btnLunar.classList.remove('hidden');
    else btnLunar.classList.add('hidden');
  } else {
    btnLunar.classList.add('hidden');
  }

  if (gameState.unlocks.lunarEssence && !gameState.unlocks.solarFlare) {
    if (gameState.resources.lunarEssence >= solarThreshold) btnSolar.classList.remove('hidden');
    else btnSolar.classList.add('hidden');
  } else {
    btnSolar.classList.add('hidden');
  }

  // Show/hide shop sections
  if (gameState.unlocks.lunarEssence) {
    document.getElementById('shop-lunar').classList.remove('hidden');
    document.getElementById('hud-lunar').classList.remove('hidden');
  }
  if (gameState.unlocks.solarFlare) {
    document.getElementById('shop-solar').classList.remove('hidden');
    document.getElementById('hud-solar').classList.remove('hidden');
  }

  // Update upgrade buy buttons
  for (const [upgradeName, resource] of Object.entries(UPGRADE_LABELS)) {
    const costEl = document.getElementById('cost-' + upgradeName);
    if (!costEl) continue;
    const cost = getUpgradeCost(upgradeName);
    costEl.textContent = fmtCost(cost, resource);
    const btn = costEl.closest('button');
    if (btn) btn.disabled = gameState.resources[resource] < cost;
    const countEl = document.getElementById('count-' + upgradeName);
    if (countEl) {
      const group = resource === 'stardust' ? 'stardust' : resource === 'lunarEssence' ? 'lunar' : 'solar';
      countEl.textContent = gameState.upgrades[group][upgradeName];
    }
  }

  // Disable unlock buttons if can't afford
  btnLunar.disabled = gameState.resources.stardust < lunarThreshold;
  btnSolar.disabled = gameState.resources.lunarEssence < solarThreshold;
}

function updateUI() {
  updateHUD();
  updateShop();

  // Cascade visual feedback
  if (gameState._cascadeFiredThisTick) {
    const el = document.getElementById('hud-stardust-amount');
    if (el) spawnFloatNearEl('⚡', el, '#4fc3f7');
    gameState._cascadeFiredThisTick = false;
  }

  checkAchievements();
  if (researchRendered) refreshResearchNodeStates();
}

// ─── Orb ─────────────────────────────────────────────────────────────────────

let _orbX = 100, _orbY = 100, _orbVX = 2.5, _orbVY = 1.8, _orbRafId = null;

function spawnOrb() {
  const orb = document.getElementById('orb');
  _orbX = 80 + Math.random() * (window.innerWidth - 160);
  _orbY = 80 + Math.random() * (window.innerHeight - 160);
  _orbVX = (0.1 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
  _orbVY = (0.1 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
  orb.classList.remove('hidden');
  if (_orbRafId) cancelAnimationFrame(_orbRafId);
  animateOrb();
}

function animateOrb() {
  const orb = document.getElementById('orb');
  if (orb.classList.contains('hidden')) return;

  _orbX += _orbVX;
  _orbY += _orbVY;

  const w = window.innerWidth  - 40;
  const h = window.innerHeight - 40;
  if (_orbX < 0)  { _orbX = 0;  _orbVX *= -1; }
  if (_orbX > w)  { _orbX = w;  _orbVX *= -1; }
  if (_orbY < 0)  { _orbY = 0;  _orbVY *= -1; }
  if (_orbY > h)  { _orbY = h;  _orbVY *= -1; }

  orb.style.left = _orbX + 'px';
  orb.style.top  = _orbY + 'px';
  _orbRafId = requestAnimationFrame(animateOrb);
}

function onOrbClick() {
  const orb = document.getElementById('orb');
  orb.classList.add('hidden');
  if (_orbRafId) cancelAnimationFrame(_orbRafId);

  const amount = 10 + Math.floor(Math.random() * 41);
  const resource = gameState.unlocks.solarFlare ? 'solarFlare'
                 : gameState.unlocks.lunarEssence ? 'lunarEssence'
                 : 'stardust';
  addResource(resource, amount);
  spawnFloat('+' + amount + ' ' + RESOURCE_NAMES[resource], _orbX, _orbY, '#ffd700');

  if (!gameState.stats.totalOrbClicks) gameState.stats.totalOrbClicks = 0;
  gameState.stats.totalOrbClicks++;

  const delay = (60 + Math.random() * 540) * 1000;
  setTimeout(spawnOrb, delay);
}

// ─── Event Binding ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Gather
  document.getElementById('btn-gather').addEventListener('click', () => {
    const amount = getClickAmount();
    addResource('stardust', amount);
    gameState.stats.totalClicks++;
    const btn = document.getElementById('btn-gather');
    spawnFloatNearEl('+' + amount, btn, '#ffd700');
    updateUI();
  });

  // Unlock resources
  document.getElementById('btn-unlock-lunar').addEventListener('click', () => {
    if (tryUnlockResource('lunarEssence')) updateUI();
  });
  document.getElementById('btn-unlock-solar').addEventListener('click', () => {
    if (tryUnlockResource('solarFlare')) updateUI();
  });

  // Buy upgrades (event delegation on shop)
  document.getElementById('shop').addEventListener('click', e => {
    const btn = e.target.closest('.btn-buy[data-upgrade]');
    if (!btn) return;
    const upgrade = btn.dataset.upgrade;
    if (tryBuyUpgrade(upgrade)) {
      spawnFloatNearEl('+1 ' + upgrade.charAt(0).toUpperCase() + upgrade.slice(1), btn, '#fff');
      updateUI();
    }
  });

  // Research overlay
  document.getElementById('btn-research').addEventListener('click', () => {
    const overlay = document.getElementById('research-overlay');
    const isOpen = !overlay.classList.contains('hidden');
    document.getElementById('achievements-overlay').classList.add('hidden');
    document.getElementById('prestige-overlay').classList.add('hidden');
    if (isOpen) {
      overlay.classList.add('hidden');
      hideTooltip();
    } else {
      overlay.style.top = document.getElementById('hud').offsetHeight + 'px';
      overlay.classList.remove('hidden');
      if (!researchRendered) renderResearchTree();
      else refreshResearchNodeStates();
    }
  });
  document.getElementById('btn-close-research').addEventListener('click', () => {
    document.getElementById('research-overlay').classList.add('hidden');
    hideTooltip();
  });

  // Research node clicks (delegation on canvas)
  document.getElementById('research-canvas').addEventListener('click', e => {
    const nodeEl = e.target.closest('.research-node');
    if (!nodeEl) return;
    const nodeId = nodeEl.dataset.id;
    if (tryUnlockResearchNode(nodeId)) {
      refreshResearchNodeStates();
      updateHUD();
      showToast('Research Unlocked', RESEARCH_NODE_MAP[nodeId].name);
    }
  });

  // Research tooltip
  document.getElementById('research-canvas').addEventListener('mouseover', e => {
    const nodeEl = e.target.closest('.research-node');
    if (!nodeEl) return;
    showResearchTooltip(RESEARCH_NODE_MAP[nodeEl.dataset.id], e);
  });
  document.getElementById('research-canvas').addEventListener('mousemove', e => {
    const nodeEl = e.target.closest('.research-node');
    if (nodeEl) moveTooltip(e);
    else hideTooltip();
  });
  document.getElementById('research-canvas').addEventListener('mouseout', e => {
    if (!e.target.closest('.research-node')) hideTooltip();
  });

  // Achievements
  document.getElementById('btn-achievements').addEventListener('click', () => {
    const overlay = document.getElementById('achievements-overlay');
    const isOpen = !overlay.classList.contains('hidden');
    document.getElementById('research-overlay').classList.add('hidden');
    document.getElementById('prestige-overlay').classList.add('hidden');
    hideTooltip();
    if (isOpen) {
      overlay.classList.add('hidden');
    } else {
      renderAchievements();
      overlay.style.top = document.getElementById('hud').offsetHeight + 'px';
      overlay.classList.remove('hidden');
    }
  });
  document.getElementById('btn-close-achievements').addEventListener('click', () => {
    document.getElementById('achievements-overlay').classList.add('hidden');
  });

  // Orb
  document.getElementById('orb').addEventListener('click', onOrbClick);

  // Prestige overlay
  document.getElementById('btn-prestige').addEventListener('click', () => {
    document.getElementById('research-overlay').classList.add('hidden');
    document.getElementById('achievements-overlay').classList.add('hidden');
    hideTooltip();
    const overlay = document.getElementById('prestige-overlay');
    overlay.style.top = document.getElementById('hud').offsetHeight + 'px';
    overlay.classList.remove('hidden');
    renderPrestigeOverlay();
  });
  document.getElementById('btn-close-prestige').addEventListener('click', () => {
    document.getElementById('prestige-overlay').classList.add('hidden');
  });
  document.getElementById('btn-confirm-prestige').addEventListener('click', () => {
    if (!prestigeReset()) return;
    document.getElementById('prestige-overlay').classList.add('hidden');
    researchRendered = false;
    ['research-overlay', 'achievements-overlay', 'shop-lunar', 'shop-solar',
     'hud-lunar', 'hud-solar', 'orb'].forEach(id =>
      document.getElementById(id).classList.add('hidden'));
    if (_orbRafId) cancelAnimationFrame(_orbRafId);
    stopLoop();
    startLoop();
    updateUI();
    showToast('⭐ Cosmic Rebirth', 'You have transcended! Cosmic Shards empower your new existence.');
    setTimeout(spawnOrb, 60000);
  });
  document.getElementById('prestige-upgrades-grid').addEventListener('click', e => {
    const btn = e.target.closest('.pu-buy');
    if (!btn || btn.disabled) return;
    if (tryBuyPrestigeUpgrade(btn.dataset.upg)) renderPrestigeOverlay();
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset the universe? All progress will be lost.')) {
      stopLoop();
      resetGame();
      researchRendered = false;
      document.getElementById('research-overlay').classList.add('hidden');
      document.getElementById('achievements-overlay').classList.add('hidden');
      document.getElementById('prestige-overlay').classList.add('hidden');
      document.getElementById('shop-lunar').classList.add('hidden');
      document.getElementById('shop-solar').classList.add('hidden');
      document.getElementById('hud-lunar').classList.add('hidden');
      document.getElementById('hud-solar').classList.add('hidden');
      document.getElementById('hud-prestige').classList.add('hidden');
      document.getElementById('btn-prestige').classList.add('hidden');
      document.getElementById('orb').classList.add('hidden');
      if (_orbRafId) cancelAnimationFrame(_orbRafId);
      startLoop();
      updateUI();
    }
  });
}

// ─── RAF UI Loop ──────────────────────────────────────────────────────────────

function uiLoop() {
  updateUI();
  saveGame();
  requestAnimationFrame(uiLoop);
}

// ─── Init ────────────────────────────────────────────────────────────────────

function init() {
  loadGame();
  gameState._cascadeFiredThisTick = false;
  gameState.stats.totalOrbClicks = gameState.stats.totalOrbClicks || 0;
  applyPrestigeStartingBonuses();
  bindEvents();
  startLoop();
  updateUI();
  // Restore unlock UI for loaded saves
  if (gameState.unlocks.lunarEssence) {
    document.getElementById('shop-lunar').classList.remove('hidden');
    document.getElementById('hud-lunar').classList.remove('hidden');
  }
  if (gameState.unlocks.solarFlare) {
    document.getElementById('shop-solar').classList.remove('hidden');
    document.getElementById('hud-solar').classList.remove('hidden');
  }
  // Restore prestige UI for loaded saves
  if (gameState.prestige.shards > 0 || getPrestigeShardGain() >= 1) {
    document.getElementById('btn-prestige').classList.remove('hidden');
  }
  setTimeout(spawnOrb, 60000);
  requestAnimationFrame(uiLoop);
}

window.addEventListener('DOMContentLoaded', init);
