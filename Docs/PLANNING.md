# Incremental Game Implementation Plan: Celestial Alchemist

## Context
The goal is to create "Celestial Alchemist", a web-based incremental game. The game is a greenfield implementation using pure JavaScript (no backend) and browser local storage for persistence. Players progress by gathering "Stardust", unlocking "Lunar Essence", and eventually "Solar Flare".

## Proposed Approach

### 1. Project Structure
I will use a clean separation of concerns to ensure the game is easy to maintain and expand:
- `index.html`: The UI shell, containing the resource displays, the main "Gather" button, the upgrade shop, and a reset button.
- `style.css`: Implements the "Celestial" theme (deep space gradients, gold/silver/blue accents).
- `js/state.js`: Manages the `gameState` object, including `save()`, `load()`, and `reset()` functions using `localStorage` (key: `celestial_alchemist_save`).
- `js/engine.js`: Contains the game logic:
    - **Production Loop**: A `setInterval` (e.g., every 100ms) to calculate passive resource growth.
    - **Cost Calculations**: Implements the exponential cost formula: $\text{Current Cost} = \text{Base Cost} \times 1.15^{\text{Amount Owned}}$.
    - **Resource Logic**: Handles gathering and unlock requirements.
- `js/game.js`: The main controller that ties the engine and state to the DOM. It handles event listeners, UI updates (toggling visibility of locked resources), and the game loop trigger.

### 2. Core Game Mechanics
- **Resources & Progression**:
    - **Stardust**: Available at start. Gathered via clicking.
    - **Lunar Essence**: Unlocked by spending 1,000 Stardust. Auto-generates at 1/s once unlocked.
    - **Solar Flare**: Unlocked by spending 1,000 Lunar Essence. Auto-generates at 1/s once unlocked.
- **Upgrades**:
    - **Tiers**: Each resource has 3 associated upgrades (e.g., Telescope $\rightarrow$ Collector $\rightarrow$ Siphon for Stardust).
    - **Impact**: Upgrades increase the passive production rate (per second) of their respective resource.
- **Research Tree**:
    - **Structure**: A center root node branching into three distinct paths (Stardust, Lunar, Solar).
    - **Progression**: Linear dependencies within each branch (Node 1 $\rightarrow$ Node 2).
    - **Effects**: Research provides both "Flat" bonuses (additive) and "Multiplier" bonuses (multiplicative) to resource production.
    - **UI**: A full-screen overlay with a graphic node-and-line representation.
- **Special Events**:
    - **Bouncing Orb**: A fast-moving celestial orb periodically appears. Clicking it awards a random amount (10-50) of the highest unlocked resource and triggers a floating text reward. It respawns after a random interval (1-10 minutes).
- **Achievements System**:
    - **Stats Tracking**: Track cumulative resources earned (`totalStardust`, `totalLunarEssence`, `totalSolarFlare`) and lifetime spent (`spentStardust`, `spentLunarEssence`, `spentSolarFlare`) for each resource, as well as total manual clicks (`totalClicks`).
    - **Achievement Logic**: Implement a checker that monitors stats and unlocks based on threshold, milestone, and progression requirements.
    - **UI/UX**: 
        - **Toast Notifications**: Temporary on-screen alerts when an achievement is earned.
        - **Achievements Modal**: A dedicated gallery view showing all possible achievements and their current state (locked/unlocked).
- **UI Design**:
    - **Header**: Real-time resource counters.
    - **Main Area**: Glowing "Gather Stardust" button.
    - **Shop**: Three sections (Stardust Lab, Lunar Sanctum, Solar Forge). Sections are hidden until the resource is unlocked. Headers display real-time passive production rates.
    - **Buttons**: "Buy" and "Unlock" buttons use a two-line format: "Label\n(Cost Resource)".
    - **Footer**: Contains a "Reset Universe" button to clear game state after confirmation.

### 3. State Structure
The `gameState` object will be persisted as JSON:
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
    "totalStardust": 0,
    "totalLunarEssence": 0,
    "totalSolarFlare": 0,
    "spentStardust": 0,
    "spentLunarEssence": 0,
    "spentSolarFlare": 0,
    "totalClicks": 0
  },
  "achievements": [],
  "research": []
}
```

## Verification Plan
- **Functional Path**:
    - [ ] Verify "Gather Stardust" button increases stardust count.
    - [ ] Verify "Unlock Lunar Essence" button appears at 1,000 Stardust and correctly unlocks the Lunar section.
    - [ ] Verify "Unlock Solar Flare" button appears at 1,000 Lunar Essence and unlocks the Solar section.
- **Mechanics**:
    - [ ] Verify that purchasing an upgrade increases passive production.
    - [ ] Verify that upgrade costs increase exponentially.
    - [ ] Verify base production (1/s) for Lunar/Solar resources upon unlock.
    - [ ] Verify Bouncing Orb functionality (speed, reward, respawn, reward popup).
- **Research Tree**:
    - [ ] Verify that research nodes unlock correctly based on dependencies.
    - [ ] Verify that research bonuses (flat/multiplier) are correctly applied to production.
    - [ ] Verify that the research overlay renders correctly with nodes and connectors.
- **Achievements**:
    - [ ] Verify that stats (total resources, clicks) increment correctly.
    - [ ] Verify that achievements unlock upon meeting requirements.
    - [ ] Verify that achievement notifications appear correctly.
    - [ ] Verify that the achievements modal correctly reflects unlocked/locked states.
- **Persistence**:
    - [ ] Save game $\rightarrow$ Refresh page $\rightarrow$ Verify resources, upgrades, stats, achievements and research are restored.
- **UI/UX**:
    - [ ] Check that locked resources/shops are not visible initially.
    - [ ] Ensure buttons are disabled when the player has insufficient funds.
    - [ ] Verify two-line button labels and production rate headers.
    - [ ] Verify "Reset Universe" functionality.
