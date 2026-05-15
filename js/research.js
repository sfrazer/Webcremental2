'use strict';

// Layout constants: 1200×800 canvas, nodes are 60px wide (30px radius offset for centering)
const RESEARCH_NODES = [
  // ── Root ─────────────────────────────────────────────────────────────────
  {
    id: 'root', name: 'Cosmic Insight',
    description: 'Open the gates of celestial knowledge.',
    branch: null, subBranch: null, position: 0, requires: [],
    cost: { resource: 'stardust', amount: 500 },
    effect: { type: 'unlock', target: 'tree', value: null },
    layout: { x: 565, y: 25 }
  },

  // ── Branch Gates ─────────────────────────────────────────────────────────
  {
    id: 'stardust_branch', name: 'Stardust Mastery',
    description: 'Unlock the Stardust research paths.',
    branch: 'stardust', subBranch: null, position: 0, requires: ['root'],
    cost: { resource: 'stardust', amount: 2000 },
    effect: { type: 'unlock', target: 'stardust_tree', value: null },
    layout: { x: 165, y: 150 }
  },
  {
    id: 'lunar_branch', name: 'Lunar Mastery',
    description: 'Unlock the Lunar Essence research paths.',
    branch: 'lunar', subBranch: null, position: 0, requires: ['root'],
    cost: { resource: 'lunarEssence', amount: 500 },
    effect: { type: 'unlock', target: 'lunar_tree', value: null },
    layout: { x: 565, y: 150 }
  },
  {
    id: 'solar_branch', name: 'Solar Mastery',
    description: 'Unlock the Solar Flare research paths.',
    branch: 'solar', subBranch: null, position: 0, requires: ['root'],
    cost: { resource: 'solarFlare', amount: 200 },
    effect: { type: 'unlock', target: 'solar_tree', value: null },
    layout: { x: 965, y: 150 }
  },

  // ── Stardust Sub-branch: Upgrade Mastery ─────────────────────────────────
  {
    id: 'sd_upg_mastery_1', name: 'Upgrade Mastery I',
    description: 'Stardust upgrades produce 50% more per second.',
    branch: 'stardust', subBranch: 'upgrade_mastery', position: 0,
    requires: ['stardust_branch'],
    cost: { resource: 'stardust', amount: 5000 },
    effect: { type: 'multiplier', target: 'stardust_upgrades', value: 1.5 },
    layout: { x: 45, y: 310 }
  },
  {
    id: 'sd_upg_mastery_2', name: 'Upgrade Mastery II',
    description: 'Stardust upgrades produce 2.5× their base rate.',
    branch: 'stardust', subBranch: 'upgrade_mastery', position: 1,
    requires: ['sd_upg_mastery_1'],
    cost: { resource: 'stardust', amount: 25000 },
    effect: { type: 'multiplier', target: 'stardust_upgrades', value: 2.5 },
    layout: { x: 45, y: 440 }
  },

  // ── Stardust Sub-branch: Frugal Harvesting ────────────────────────────────
  {
    id: 'sd_frugal_1', name: 'Frugal Harvesting I',
    description: 'Stardust upgrades cost 15% less.',
    branch: 'stardust', subBranch: 'frugal_harvesting', position: 0,
    requires: ['stardust_branch'],
    cost: { resource: 'stardust', amount: 4000 },
    effect: { type: 'costReduction', target: 'stardust_upgrades', value: 0.85 },
    layout: { x: 165, y: 310 }
  },
  {
    id: 'sd_frugal_2', name: 'Frugal Harvesting II',
    description: 'Stardust upgrades cost 30% less (stacks with I).',
    branch: 'stardust', subBranch: 'frugal_harvesting', position: 1,
    requires: ['sd_frugal_1'],
    cost: { resource: 'stardust', amount: 20000 },
    effect: { type: 'costReduction', target: 'stardust_upgrades', value: 0.70 },
    layout: { x: 165, y: 440 }
  },

  // ── Stardust Sub-branch: Manual Momentum ─────────────────────────────────
  {
    id: 'sd_momentum_1', name: 'Manual Momentum I',
    description: 'Each Gather click yields +3 extra Stardust.',
    branch: 'stardust', subBranch: 'manual_momentum', position: 0,
    requires: ['stardust_branch'],
    cost: { resource: 'stardust', amount: 3000 },
    effect: { type: 'clickBonus', target: 'stardust', value: 3 },
    layout: { x: 285, y: 310 }
  },
  {
    id: 'sd_momentum_2', name: 'Manual Momentum II',
    description: 'Each Gather click yields +8 extra Stardust.',
    branch: 'stardust', subBranch: 'manual_momentum', position: 1,
    requires: ['sd_momentum_1'],
    cost: { resource: 'stardust', amount: 15000 },
    effect: { type: 'clickBonus', target: 'stardust', value: 8 },
    layout: { x: 285, y: 440 }
  },

  // ── Lunar Sub-branch: Phase Amplification ─────────────────────────────────
  {
    id: 'lunar_phase_1', name: 'Phase Amplification I',
    description: 'Lunar Essence production is 50% faster.',
    branch: 'lunar', subBranch: 'phase_amplification', position: 0,
    requires: ['lunar_branch'],
    cost: { resource: 'lunarEssence', amount: 1500 },
    effect: { type: 'multiplier', target: 'lunarEssence', value: 1.5 },
    layout: { x: 445, y: 310 }
  },
  {
    id: 'lunar_phase_2', name: 'Phase Amplification II',
    description: 'Lunar Essence production is 2.5× its base rate.',
    branch: 'lunar', subBranch: 'phase_amplification', position: 1,
    requires: ['lunar_phase_1'],
    cost: { resource: 'lunarEssence', amount: 8000 },
    effect: { type: 'multiplier', target: 'lunarEssence', value: 2.5 },
    layout: { x: 445, y: 440 }
  },

  // ── Lunar Sub-branch: Lunar Economy ───────────────────────────────────────
  {
    id: 'lunar_economy_1', name: 'Lunar Economy I',
    description: 'Lunar upgrades cost 15% less.',
    branch: 'lunar', subBranch: 'lunar_economy', position: 0,
    requires: ['lunar_branch'],
    cost: { resource: 'lunarEssence', amount: 1200 },
    effect: { type: 'costReduction', target: 'lunar_upgrades', value: 0.85 },
    layout: { x: 565, y: 310 }
  },
  {
    id: 'lunar_economy_2', name: 'Lunar Economy II',
    description: 'Lunar upgrades cost 30% less (stacks with I).',
    branch: 'lunar', subBranch: 'lunar_economy', position: 1,
    requires: ['lunar_economy_1'],
    cost: { resource: 'lunarEssence', amount: 6000 },
    effect: { type: 'costReduction', target: 'lunar_upgrades', value: 0.70 },
    layout: { x: 565, y: 440 }
  },

  // ── Lunar Sub-branch: Stellar Harmony ────────────────────────────────────
  {
    id: 'lunar_harmony_1', name: 'Stellar Harmony I',
    description: 'Lunar resonance generates +2 Stardust per second.',
    branch: 'lunar', subBranch: 'stellar_harmony', position: 0,
    requires: ['lunar_branch'],
    cost: { resource: 'lunarEssence', amount: 2000 },
    effect: { type: 'flat', target: 'stardust', value: 2.0 },
    layout: { x: 685, y: 310 }
  },
  {
    id: 'lunar_harmony_2', name: 'Stellar Harmony II',
    description: 'Lunar resonance generates +6 Stardust per second.',
    branch: 'lunar', subBranch: 'stellar_harmony', position: 1,
    requires: ['lunar_harmony_1'],
    cost: { resource: 'lunarEssence', amount: 10000 },
    effect: { type: 'flat', target: 'stardust', value: 6.0 },
    layout: { x: 685, y: 440 }
  },

  // ── Solar Sub-branch: Solar Intensification ───────────────────────────────
  {
    id: 'solar_intensify_1', name: 'Solar Intensification I',
    description: 'Solar Flare production is 50% faster.',
    branch: 'solar', subBranch: 'solar_intensification', position: 0,
    requires: ['solar_branch'],
    cost: { resource: 'solarFlare', amount: 500 },
    effect: { type: 'multiplier', target: 'solarFlare', value: 1.5 },
    layout: { x: 845, y: 310 }
  },
  {
    id: 'solar_intensify_2', name: 'Solar Intensification II',
    description: 'Solar Flare production is 2.5× its base rate.',
    branch: 'solar', subBranch: 'solar_intensification', position: 1,
    requires: ['solar_intensify_1'],
    cost: { resource: 'solarFlare', amount: 2500 },
    effect: { type: 'multiplier', target: 'solarFlare', value: 2.5 },
    layout: { x: 845, y: 440 }
  },

  // ── Solar Sub-branch: Fusion Frugality ────────────────────────────────────
  {
    id: 'solar_frugal_1', name: 'Fusion Frugality I',
    description: 'Solar upgrades cost 15% less.',
    branch: 'solar', subBranch: 'fusion_frugality', position: 0,
    requires: ['solar_branch'],
    cost: { resource: 'solarFlare', amount: 400 },
    effect: { type: 'costReduction', target: 'solar_upgrades', value: 0.85 },
    layout: { x: 965, y: 310 }
  },
  {
    id: 'solar_frugal_2', name: 'Fusion Frugality II',
    description: 'Solar upgrades cost 30% less (stacks with I).',
    branch: 'solar', subBranch: 'fusion_frugality', position: 1,
    requires: ['solar_frugal_1'],
    cost: { resource: 'solarFlare', amount: 2000 },
    effect: { type: 'costReduction', target: 'solar_upgrades', value: 0.70 },
    layout: { x: 965, y: 440 }
  },

  // ── Solar Sub-branch: Radiant Cascade ────────────────────────────────────
  {
    id: 'solar_cascade_1', name: 'Radiant Cascade I',
    description: '5% chance each tick: solar energy pulses into Stardust.',
    branch: 'solar', subBranch: 'radiant_cascade', position: 0,
    requires: ['solar_branch'],
    cost: { resource: 'solarFlare', amount: 600 },
    effect: { type: 'crossResource', target: 'stardust', value: 0.05 },
    layout: { x: 1085, y: 310 }
  },
  {
    id: 'solar_cascade_2', name: 'Radiant Cascade II',
    description: '12% chance each tick: solar energy pulses into Stardust.',
    branch: 'solar', subBranch: 'radiant_cascade', position: 1,
    requires: ['solar_cascade_1'],
    cost: { resource: 'solarFlare', amount: 3000 },
    effect: { type: 'crossResource', target: 'stardust', value: 0.12 },
    layout: { x: 1085, y: 440 }
  }
];

const RESEARCH_NODE_MAP = Object.fromEntries(RESEARCH_NODES.map(n => [n.id, n]));

function getNodeState(nodeId) {
  const node = RESEARCH_NODE_MAP[nodeId];
  if (!node) return 'locked';
  if (gameState.research.includes(nodeId)) return 'unlocked';
  const reqsMet = node.requires.every(r => gameState.research.includes(r));
  if (!reqsMet) return 'locked';
  const { resource, amount } = node.cost;
  return gameState.resources[resource] >= amount ? 'unlockable' : 'locked';
}

function canUnlockNode(nodeId) {
  return getNodeState(nodeId) === 'unlockable';
}

function getResearchEffects(type) {
  return RESEARCH_NODES
    .filter(n => gameState.research.includes(n.id) && n.effect.type === type)
    .map(n => ({ target: n.effect.target, value: n.effect.value }));
}
