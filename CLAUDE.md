# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Celestial Alchemist** — a web-based incremental game. Pure JavaScript, no backend, no build step. Browser `localStorage` for persistence (key: `celestial_alchemist_save`). Open `index.html` directly in a browser to run.

## File Structure

```
index.html       — UI shell: resource displays, Gather button, shop, reset button
style.css        — Celestial theme: deep-space gradients, gold/silver/blue accents
js/research.js   — RESEARCH_NODES data + helper functions (getNodeState, canUnlockNode, getResearchEffects)
js/state.js      — gameState object + save()/load()/reset() via localStorage
js/engine.js     — game logic: production loop (setInterval ~100ms), cost formulas, resource logic
js/game.js       — main controller: DOM event listeners, UI updates, game loop trigger
test/test.html   — unit test runner (open in browser; no framework)
test/tests.js    — assertion suite for pure-logic functions (research.js, state.js, engine.js)
test/run-tests.mjs — headless Node.js test runner (uses jsdom; run with `node test/run-tests.mjs`)
```

Script load order in `index.html`: `research.js` → `state.js` → `engine.js` → `game.js` (global scope, no ES modules).

## Naming Conventions

- `get*` — pure read, no side effects (e.g. `getUpgradeCost`, `getProductionRates`, `getNodeState`)
- `try*` — mutation that can fail; returns `true` on success, `false` on failure (e.g. `tryBuyUpgrade`, `tryUnlockResearchNode`, `tryBuyPrestigeUpgrade`)
- `*Reset` — wipes a significant chunk of state (e.g. `prestigeReset`, `resetGame`)
- `add*` / `spend*` — unconditional resource mutations; `spend*` also updates stat tracking
- `update*` — DOM/UI refresh functions in `game.js`; no return value, side-effects only
- `render*` — builds/rebuilds a UI section from scratch (e.g. `renderPrestigeOverlay`, `renderResearchTree`)
- `_*` — internal/private to a file; not intended to be called from other files (e.g. `_showUnlockButton`)

## Data Placement

Static data arrays live in the file that primarily interacts with them:
- `RESEARCH_NODES` / `RESEARCH_NODE_MAP` in `research.js` — consumed entirely by research helpers
- `PRESTIGE_UPGRADES`, `UPGRADE_BASE_RATES`, `UPGRADE_BASE_COSTS`, `UPGRADE_RESOURCE`, `UPGRADE_GROUP` in `engine.js` — consumed by cost/production logic

When adding new content (new upgrade tiers, new prestige upgrades, new research nodes), add the data to the same file as the functions that read it — not to a separate data file. This keeps the schema and logic together and avoids cross-file implicit coupling.

## Architecture

**Research** (`js/research.js`) defines the static `RESEARCH_NODES` array and `RESEARCH_NODE_MAP` lookup. Must load first — engine and game both depend on it.

**State** (`js/state.js`) owns the single `gameState` object. All mutations go through here. Persisted as JSON with version `"1.0.0"`.

**Engine** (`js/engine.js`) is stateless logic — it reads from `gameState` and writes back via state functions. The production loop runs every 100ms. Upgrade cost formula: `baseCost × 1.15^amountOwned × costReductionMultiplier`.

**Game** (`js/game.js`) is the controller — it wires engine and state to the DOM. It owns all `addEventListener` calls and the UI visibility toggling for locked resources.

## Core Mechanics

- **Resources**: Stardust (click to gather) → Lunar Essence (unlocked at 1,000 Stardust) → Solar Flare (unlocked at 1,000 Lunar Essence). Lunar and Solar auto-generate at 1/s base once unlocked.
- **Upgrades**: 3 tiers per resource (Stardust: Telescope/Collector/Siphon; Lunar: Well/Condenser/Alchemist; Solar: Scoop/Forge/Reactor). Base rates: 1/s, 5/s, 10/s per unit owned. Base costs: 10, 100, 1,000.
- **Research Tree**: Full-screen overlay, node-and-line graph on a 1200×800 logical canvas. 22 nodes total: root → 3 branch gates → 9 sub-branches (3 per resource, each 2 nodes deep). Each sub-branch has a distinct effect type. See Research Tree section below.
- **Bouncing Orb**: Periodic clickable orb; awards 10–50 of the highest unlocked resource on click. Respawns after 1–10 minutes. Does not spawn until 60s after game load.
- **Achievements**: Tracked via stats (`totalStardust`, `totalLunarEssence`, `totalSolarFlare`, `spentStardust`, `spentLunarEssence`, `spentSolarFlare`, `totalClicks`). Toast notifications on unlock; dedicated modal gallery showing all achievements.
- **Prestige / Cosmic Rebirth**: After accumulating significant resources, the player can Rebirth to earn permanent **Cosmic Shards**. Shards multiply all production by `1 + shards × 0.10` and can be spent on 6 one-time permanent upgrades. Resources, upgrades, unlocks, research, and stats reset on rebirth; achievements and shards persist. "Reset Universe" wipes everything including shards.

## Research Tree

### Node structure
```js
{
  id, name, description,
  branch,     // 'stardust' | 'lunar' | 'solar' | null
  subBranch,  // string slug | null
  position,   // 0 or 1 within sub-branch
  requires,   // string[] of prerequisite node IDs
  cost: { resource, amount },
  effect: { type, target, value },
  layout: { x, y }  // pixel coords in 1200×800 canvas
}
```

### Effect types
- `multiplier` — multiplicative to a resource or upgrade-group production rate (stacked multiplicatively)
- `costReduction` — multiplier applied to upgrade purchase cost at buy-time (stacked multiplicatively)
- `clickBonus` — flat additive to per-click gather amount
- `flat` — additive to per-second production (applied after multipliers)
- `crossResource` — probability-based burst per tick (Radiant Cascade only)

### Sub-branches

**Stardust branch** (gate cost: 2,000 stardust):
| Sub-branch | Node I | Node II |
|---|---|---|
| Upgrade Mastery | ×1.5 stardust upgrade production (5k SD) | ×2.5 stardust upgrade production (25k SD) |
| Frugal Harvesting | ×0.85 stardust upgrade costs (4k SD) | ×0.70 stardust upgrade costs (20k SD) |
| Manual Momentum | +3 stardust/click (3k SD) | +8 stardust/click (15k SD) |

**Lunar branch** (gate cost: 500 lunarEssence):
| Sub-branch | Node I | Node II |
|---|---|---|
| Phase Amplification | ×1.5 lunar production (1.5k LE) | ×2.5 lunar production (8k LE) |
| Lunar Economy | ×0.85 lunar upgrade costs (1.2k LE) | ×0.70 lunar upgrade costs (6k LE) |
| Stellar Harmony | +2/s flat stardust (2k LE) | +6/s flat stardust (10k LE) |

**Solar branch** (gate cost: 200 solarFlare):
| Sub-branch | Node I | Node II |
|---|---|---|
| Solar Intensification | ×1.5 solar production (500 SF) | ×2.5 solar production (2.5k SF) |
| Fusion Frugality | ×0.85 solar upgrade costs (400 SF) | ×0.70 solar upgrade costs (2k SF) |
| Radiant Cascade | 5%/tick chance → pulse `solarRate×0.1` stardust (600 SF) | 12%/tick chance → pulse `solarRate×0.1` stardust (3k SF) |

### Engine tick order (dt = 0.1s)
1. Raw upgrade production (count × base rate)
2. Apply `multiplier` research (multiplicative stack per group)
3. Add `flat` research bonuses (additive)
4. Scale by dt
5. Roll Radiant Cascade (`crossResource` nodes)
6. Apply prestige multiplier (`getPrestigeMultiplier()`) to all three resource rates
7. Apply deltas via `addResource()`
8. Check unlock thresholds
9. Check achievements

Cost reduction stacks multiplicatively at buy-time: both Frugal Harvesting nodes → ×0.85 × ×0.70 = ×0.595.

## gameState Shape

```json
{
  "version": "1.0.0",
  "resources": { "stardust": 0, "lunarEssence": 0, "solarFlare": 0 },
  "upgrades": {
    "stardust": { "telescope": 0, "collector": 0, "siphon": 0 },
    "lunar": { "well": 0, "condenser": 0, "alchemist": 0 },
    "solar": { "scoop": 0, "forge": 0, "reactor": 0 }
  },
  "unlocks": { "lunarEssence": false, "solarFlare": false },
  "stats": {
    "totalStardust": 0, "totalLunarEssence": 0, "totalSolarFlare": 0,
    "spentStardust": 0, "spentLunarEssence": 0, "spentSolarFlare": 0,
    "totalClicks": 0
  },
  "achievements": [],
  "research": [],
  "prestige": { "shards": 0, "count": 0, "upgrades": [] }
}
```

`prestige.upgrades` is an array of purchased upgrade IDs. Old saves without this key get `{shards:0, count:0, upgrades:[]}` via `deepMerge` — no migration needed.

## UI Conventions

- Shop sections (Stardust Lab, Lunar Sanctum, Solar Forge) are hidden until their resource is unlocked.
- Shop section headers show live passive production rates.
- Buy buttons use three-line format: label on line 1, cost on line 2, owned count on line 3 (`.btn-count`).
- Unlock buttons sit at the far right of the upgrade button row (`margin-left: auto`), same row as the buy buttons.
- "Reset Universe" button in footer requires confirmation before clearing state.
- The Research button gains `.has-affordable` class (gold border + pulse animation) when any unowned research node is affordable (`getNodeState() === 'unlockable'`). This is checked each UI frame in `updateHUD()`.
- Research and Achievements overlays open below the HUD (`overlay.style.top = hud.offsetHeight + 'px'`), keeping the HUD visible.
- Clicking Research or Achievements toggles their overlay closed if already open; clicking one while the other is open switches to the new one.
- The "Rebirth ✦" button in the footer is hidden until `getPrestigeShardGain() >= 1`; it gains `.can-prestige` (purple glow animation) when visible. Clicking opens the Prestige overlay, which closes Research/Achievements.
- Unlock button cost text is dynamic — `updateShop()` calls `getLunarUnlockThreshold()` / `getSolarUnlockThreshold()` each frame so the display reflects `moongate`/`sun_door` prestige upgrades.

## Bouncing Orb

- First spawn is deferred 60 seconds after `init()`.
- Velocity: random `0.1–0.5 px/frame` on each axis, direction randomized.
- On click: awards `10 + Math.random() * 40` of the highest unlocked resource (rounded), shows floating text.
- Respawns after 1–10 minutes via `setTimeout`.

## Prestige System

### Shard formula
```js
Math.floor(Math.sqrt(totalStardust / 5000) + totalLunarEssence / 1000 + totalSolarFlare / 500)
```
Minimum 1 shard required to allow rebirth. Button is hidden until threshold is met.

### Passive multiplier
```js
1 + gameState.prestige.shards * 0.10   // e.g. 3 shards → ×1.30
```
Applied as final step in `getProductionRates()`. When shards = 0, multiplier = 1.0 (no-op).

### Prestige upgrades (`PRESTIGE_UPGRADES` in `engine.js`)
| ID | Name | Cost | Effect |
|---|---|---|---|
| `starter_stardust` | Stardust Cache | 3 | Begin each run with 500 Stardust |
| `quick_gather` | Practiced Hands | 3 | +2 stardust per gather click |
| `ancient_memory` | Ancient Memory | 5 | Begin each run with root research node unlocked |
| `moongate` | Moongate | 5 | Lunar Essence unlocks at 750 Stardust (down from 1,000) |
| `sun_door` | Sun Door | 7 | Solar Flare unlocks at 750 Lunar Essence (down from 1,000) |
| `frugal_universe` | Frugal Universe | 8 | All upgrade costs permanently ×0.80 |

### What resets / what persists
| Field | On Prestige | On Reset Universe |
|---|---|---|
| resources, upgrades, unlocks, stats, research | wiped | wiped |
| achievements | kept | wiped |
| prestige.shards, prestige.count, prestige.upgrades | kept | wiped |

### Key functions
- `getPrestigeShardGain()` — computes shards from current run stats (in `state.js`)
- `getPrestigeMultiplier()` — returns `1 + shards * 0.10` (in `state.js`)
- `applyPrestigeStartingBonuses()` — applies `starter_stardust` / `ancient_memory` after reset or load (in `state.js`)
- `prestigeReset()` — awards shards, selectively wipes run state, calls bonuses + save (in `state.js`)
- `getLunarUnlockThreshold()` / `getSolarUnlockThreshold()` — return 750 or 1000 depending on upgrades (in `engine.js`)
- `tryBuyPrestigeUpgrade(id)` — deducts shards, pushes ID to upgrades array, saves (in `engine.js`)

## State Implementation Notes

- `deepMerge(target, source)` in `state.js`: the `source` value **always wins** for scalar keys (no `=== undefined` guard). This ensures `loadGame()` correctly overwrites DEFAULT_STATE with saved values.
- `saveGame()` explicitly lists serialized keys to exclude transient fields like `_cascadeFiredThisTick`.
- `resetGame()` removes the localStorage entry and resets in-memory state to DEFAULT_STATE.
