# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Celestial Alchemist** — a web-based incremental game. Pure JavaScript, no backend, no build step. Browser `localStorage` for persistence (key: `celestial_alchemist_save`). Open `index.html` directly in a browser to run.

## Planned File Structure

```
index.html       — UI shell: resource displays, Gather button, shop, reset button
style.css        — Celestial theme: deep-space gradients, gold/silver/blue accents
js/state.js      — gameState object + save()/load()/reset() via localStorage
js/engine.js     — game logic: production loop (setInterval ~100ms), cost formulas, resource logic
js/game.js       — main controller: DOM event listeners, UI updates, game loop trigger
```

## Architecture

**State** (`js/state.js`) owns the single `gameState` object. All mutations go through here. Persisted as JSON with version `"1.0.0"`.

**Engine** (`js/engine.js`) is stateless logic — it reads from `gameState` and writes back via state functions. The production loop runs every 100ms. Upgrade cost formula: `baseCost × 1.15^amountOwned`.

**Game** (`js/game.js`) is the controller — it wires engine and state to the DOM. It owns all `addEventListener` calls and the UI visibility toggling for locked resources.

## Core Mechanics

- **Resources**: Stardust (click to gather) → Lunar Essence (unlocked at 1,000 Stardust) → Solar Flare (unlocked at 1,000 Lunar Essence). Lunar and Solar auto-generate at 1/s base once unlocked.
- **Upgrades**: 3 tiers per resource (Stardust: Telescope/Collector/Siphon; Lunar: Well/Condenser/Alchemist; Solar: Scoop/Forge/Reactor). Each increases passive production rate.
- **Research Tree**: Full-screen overlay, node-and-line graph. Center root → 3 paths (one per resource). Linear dependencies within each path. Bonuses are flat (additive) or multiplier (multiplicative) to production.
- **Bouncing Orb**: Periodic clickable orb; awards 10–50 of the highest unlocked resource on click. Respawns after 1–10 minutes.
- **Achievements**: Tracked via stats (`totalStardust`, `totalLunarEssence`, `totalSolarFlare`, `spentStardust`, `spentLunarEssence`, `spentSolarFlare`, `totalClicks`). Toast notifications on unlock; dedicated modal gallery showing all achievements.

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
  "research": []
}
```

## UI Conventions

- Shop sections (Stardust Lab, Lunar Sanctum, Solar Forge) are hidden until their resource is unlocked.
- Shop section headers show live passive production rates.
- Buy/Unlock buttons use two-line format: label on line 1, cost on line 2.
- "Reset Universe" button in footer requires confirmation before clearing state.
