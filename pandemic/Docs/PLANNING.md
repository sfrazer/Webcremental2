# Outbreak Protocol — Design & Planning

## Context

A solo rogue-lite browser game inspired by the Pandemic board game. Pure HTML/CSS/JS — open `pandemic/index.html` directly in a browser, no build step or server required. Lives in the `pandemic/` subdirectory of the Webcremental2 repo.

Runs are short and punchy (24 cities instead of 48). The rogue-lite loop: pick a role, attempt a run, earn Research Points, spend RP on starting bonuses and deck customizations, attempt the next run at higher difficulty.

---

## File Structure

```
pandemic/
├── index.html          — game shell
├── style.css           — dark thriller theme (dark bg, red/green accents)
├── Docs/
│   └── PLANNING.md     — this file
├── test/
│   ├── test.html       — browser test runner (open directly, no framework)
│   └── tests.js        — assertion suite for pure-logic functions (69 tests)
└── js/
    ├── cities.js       — 24-city graph: ids, names, colors, connections, SVG coords
    ├── roles.js        — role definitions, unlock conditions, abilities
    ├── cards.js        — deck construction, shuffle, epidemic distribution, seeding
    ├── state.js        — gameState shape, save/load (localStorage + file export/import)
    ├── engine.js       — all game rules: actions, outbreak chains, epidemic, win/lose
    └── game.js         — UI controller: SVG map, event listeners, modals, footer stats
```

**Script load order** in `index.html`: `cities.js` → `roles.js` → `cards.js` → `state.js` → `engine.js` → `game.js`

**Script load order** in `test/test.html`: same through `engine.js` (no `game.js` — DOM-bound, untested).

### Testability rule
Every function in `cities.js` through `engine.js` must be DOM-free. `game.js` is the only file allowed to call `document.*`.

---

## Core Mechanics

### Turn structure
1. **Action Phase** — player takes 4 actions (5 with Bonus Action upgrade)
2. **Draw Phase** — draw 2 player cards; epidemic cards resolve immediately
3. **Infection Phase** — infect N cities per current infection rate

### Actions (1 each)
| Action | Requirement |
|---|---|
| Drive / Ferry | Move to adjacent city |
| Direct Flight | Discard city card matching destination |
| Charter Flight | Discard city card matching current city → fly anywhere |
| Shuttle Flight | Move between any two research station cities |
| Build Research Station | Discard current city card (Operations Expert: no card needed) |
| Treat Disease | Remove 1 cube; all cubes if disease cured; Medic removes all regardless |
| Discover Cure | At research station: discard 5 same-color cards (Scientist: 4) |

### Epidemic resolution
1. Advance infection rate index (`[2,2,2,3,3,4,4]`)
2. Draw bottom card of infection deck → place 3 cubes (may trigger outbreak)
3. Shuffle infection discard pile (including just-drawn card) → place on top of deck

### Outbreak chain
When a city would receive a 4th cube it outbreaks: +1 outbreak counter, spread 1 cube to each neighbor. Neighbors may chain-outbreak but not back to already-outbreaking cities this round.

### Win conditions (scale with difficulty)
| Difficulty | Epidemics | Cures required | Bonus win |
|---|---|---|---|
| Introductory | 4 | 2 of 4 | — |
| Standard | 5 | 3 of 4 | — |
| Heroic | 6 | 4 of 4 | OR eradicate any 2 diseases |
| Legendary | 7 | 4 of 4 | AND Priority City must not outbreak |

**Eradication**: disease cured + 0 cubes of that color remaining on board → eradicated cities skip future infections.

**Priority City** (Legendary): randomly chosen at run start; shown with gold border. Outbreaking it is an instant loss regardless of outbreak counter.

### Lose conditions
- Player deck exhausted during draw phase
- Any disease cube supply reaches 0
- 8 outbreaks reached
- (Legendary) Priority City outbreaks

---

## Persistence

### Auto-save
`SAVE_KEY = 'outbreak_protocol_save'`. `saveGame()` called after every action and at end of each phase. `loadGame()` called once on page load with `deepMerge` for forward-compatible defaults.

### File export / import
Options modal (⚙ gear in footer) provides:
- **Export Save** — downloads full `gameState` as timestamped `.json` via Blob URL
- **Import Save** — file picker reads JSON, validates `version` field, merges with defaults, reloads UI
- **Reset All Progress** — wipes localStorage + in-memory state after confirmation

---

## State Shape

```js
{
  version: "1.0.0",
  run: {
    active: false,
    role: null,            // role ID string
    difficulty: 4,         // number of epidemic cards (4–7)
    phase: 'setup',        // 'setup' | 'action' | 'draw' | 'infect' | 'won' | 'lost'
    actionsLeft: 4,
    hand: [],              // array of card objects
    playerDeck: [],
    playerDiscard: [],
    infectionDeck: [],
    infectionDiscard: [],
    infectionRateIdx: 0,
    outbreaks: 0,
    cures: { blue: false, yellow: false, black: false, red: false },
    eradicated: { blue: false, yellow: false, black: false, red: false },
    curesRequired: 2,      // 2 / 3 / 4 by difficulty
    priorityCity: null,    // city ID for Legendary; null otherwise
    cities: {},            // { cityId: { cubes: {blue,yellow,black,red}, station: bool } }
    playerCity: null,
    cubeSupply: { blue: 24, yellow: 24, black: 24, red: 24 },
    loseReason: null,
    log: [],               // last 100 event strings
    turn: 1,
    skipNextInfect: false,
    flightBannedTurns: 0,
    quarantineSealCity: null,
    dispatcherUsedFreeMove: false,
    contingencyCard: null,
  },
  meta: {
    runs: 0,
    wins: 0,
    bestDifficultyWon: 0,
    researchPoints: 0,
    unlockedRoles: ['medic', 'scientist', 'dispatcher'],
    purchasedUpgrades: [],       // starting bonus IDs, stackable
    playerDeckAdditions: {},     // { cardId: count } — up to 2 copies each
    infectionDeckAdditions: {},  // { cardId: count } — challenge modifiers
  }
}
```

---

## Roles

### Starting (always unlocked)
| Role | Color | Ability |
|---|---|---|
| Medic | Green | Remove ALL cubes of 1 color per Treat; auto-treats cured diseases on arrival |
| Scientist | Blue | Discover Cure with only 4 cards (not 5) |
| Dispatcher | Purple | Once per turn: free move to any Research Station city |

### Locked (earn by winning)
| Role | Unlock condition | Ability |
|---|---|---|
| Quarantine Specialist | Win at difficulty 4 | Prevent cube placement in current + adjacent cities each turn |
| Operations Expert | Win at difficulty 5 | Build Research Station without discarding a card |
| Researcher | Win at difficulty 5 | Start with +1 card and a free Vaccine Cache in deck |
| Contingency Planner | Win at difficulty 6 | Retrieve 1 event card from player discard (once per run) |

---

## Cards

### Player deck (base 28 + epidemics)
- 24 city cards (1 per city)
- 4 event cards: One Quiet Night, Government Grant, Airlift, Resilient Population
- N epidemic cards evenly distributed through shuffled city+event cards

### Infection deck (base 24)
- 24 city infection cards, shuffled

### Initial seeding
Draw 9 infection cards: top 3 get 3 cubes each, next 3 get 2, last 3 get 1.

---

## Deck Customization (rogue-lite meta-layer)

Players spend Research Points between runs to add cards permanently to their decks.

### Player deck additions (buffs)
| Card | Cost | Effect |
|---|---|---|
| Vaccine Cache | 3 RP | Treat all cubes of 1 color in current city |
| Field Hospital | 4 RP | Build a Research Station anywhere |
| Emergency Protocol | 5 RP | +2 actions this turn |
| Quarantine Seal | 4 RP | Prevent all infections in 1 city for 1 round |
| Supply Drop | 3 RP | Restore 3 cubes to any depleted disease supply |

Max 2 copies of each. Cards shuffle into player deck at run start.

### Infection deck additions (challenge modifiers — free, earn bonus RP/run)
| Card | Bonus RP | Effect when drawn |
|---|---|---|
| Hotspot | +1 | Infect a random city with 2 cubes |
| Cascade Event | +2 | Infect top 2 infection cards instead of 1 |
| Virulent Strain | +3 | Next epidemic infects 3 cities |
| Travel Ban | +1 | Flight actions disabled for 1 turn |

---

## Meta-Progression

### Research Points earned per run
- +1 for attempting any run
- +2 per disease cured
- +3 for winning
- +1 per difficulty tier above Introductory (Standard +1, Heroic +2, Legendary +3)
- + bonus RP for each infection deck challenge card in play

### Starting bonuses (spend RP)
| Upgrade | Cost | Effect |
|---|---|---|
| Extra Starting Card | 3 RP | +1 card in opening hand (stack up to 3×) |
| Starting Station | 5 RP | Atlanta station pre-placed at run start |
| Light Infections | 8 RP | Skip first 2 infection seedings |
| Remove Epidemic | 10 RP | Remove 1 epidemic card from deck each run |
| Bonus Action | 12 RP | 5 actions per turn instead of 4 |

---

## Cities (24 total — 6 per disease)

| Color | Cities |
|---|---|
| Blue | Atlanta, Chicago, London, Paris, New York, Madrid |
| Yellow | São Paulo, Lagos, Kinshasa, Bogotá, Lima, Johannesburg |
| Black | Cairo, Istanbul, Moscow, Delhi, Tehran, Riyadh |
| Red | Tokyo, Beijing, Hong Kong, Bangkok, Sydney, Jakarta |

All connections are bidirectional and mirror the canonical Pandemic board topology for these 24 cities. Cross-region links: New York↔London, Madrid↔São Paulo, Madrid↔Lagos, Paris↔Cairo, Paris↔Istanbul, Delhi↔Bangkok, Delhi↔Hong Kong, Tokyo↔Sydney.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  SVG Map (900×500 viewBox)                                  │
│  • Cities: colored circles + name labels                    │
│  • Cubes: small colored dots clustered above each city      │
│  • Stations: white rectangles above circle                  │
│  • Player pawn: role-colored glowing circle                 │
│  • Highlighted cities: bright border (shows valid moves)    │
├────────────────────────┬────────────────────────────────────┤
│  HAND                  │  ACTIONS                           │
│  City cards (colored   │  7 action buttons (context-aware  │
│  left border) and      │  enabled/disabled) + End Turn      │
│  event cards (purple)  │                                    │
├────────────────────────┴────────────────────────────────────┤
│  EVENT LOG — last 8 entries, auto-scrolls                   │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (always visible, fixed bottom)                      │
│  ⚙ | Cures: 0/2 | Eradicated: 0 | Cubes: 🔵24 🟡24 ⚫24 🔴24 │
│    | Deck: 28 | Outbreaks: 0/8 | Rate: 2 | Turn: 1        │
│    | Phase: Action (4 left) | RP: 0                        │
└─────────────────────────────────────────────────────────────┘
```

Red warnings on footer stats: cube supply ≤ 4, deck ≤ 5, outbreaks ≥ 6.

### Modals
- **Role Selection** — setup screen, grid of role cards (locked roles grayed)
- **Meta Shop** — three sections: Starting Bonuses, Player Deck Cards, Challenge Modifiers
- **Win / Lose** — title, reason, RP earned, Play Again + Shop buttons
- **Options** — Export Save, Import Save, Reset All Progress
- **Generic picker** — color chooser, city chooser, card list (reused across actions)

---

## Naming Conventions

Matches the conventions in `CLAUDE.md` at the repo root:

| Prefix | Meaning |
|---|---|
| `get*` | Pure read, no side effects |
| `try*` | Mutation that can fail; returns `true`/`false` |
| `resolve*` | Game event resolution with side effects (e.g. `resolveOutbreak`) |
| `check*` | Win/lose evaluator returning `'won' \| 'lost' \| null` |
| `update*` | DOM refresh (game.js only) |
| `render*` | Full section rebuild (game.js only) |
| `_*` | File-internal; not called from other files |

---

## Implementation Status

| Phase | Status | Notes |
|---|---|---|
| 1 — Skeleton (HTML + CSS + cities + state) | ✅ Done | |
| 2 — Cards + Engine | ✅ Done | |
| 3 — Roles + Meta | ✅ Done | |
| 4 — UI + Game Controller | ✅ Done | |
| 5 — Tests | ✅ Done | 69 tests, all passing |
| 6 — Polish | 🔲 Pending | Animations, color-blind mode, mobile layout |

---

## Verification

### Unit tests — open `pandemic/test/test.html` in browser
Covers all pure-logic functions across `cities.js`, `roles.js`, `cards.js`, `state.js`, `engine.js`:
- City graph: 24 cities, bidirectional connections, correct color counts
- Deck construction: city/event/epidemic card counts, even epidemic distribution, seeding 3/2/1
- State: `deepMerge` overwrites, `saveGame`/`loadGame` round-trip, `resetGame` clears storage
- Engine: all 7 actions, outbreak chaining (no re-outbreaks), epidemic resolution, win/lose conditions, eradication, Priority City instant-lose

### Manual — open `pandemic/index.html` in browser
- Start a run → seeding visible on map, 4-card hand, action buttons enabled
- Use each of the 7 actions, confirm 1 action consumed each time
- Force an outbreak chain via console: `gameState.run.cities['cairo'].cubes.black = 3`
- Call `resolveEpidemic()` in console → infection rate indicator advances
- Win at Introductory (cure 2 diseases) → RP awarded, win screen appears
- Set `gameState.run.outbreaks = 7` then infect → lose screen
- Reload mid-run → run state fully restored from localStorage
- Buy Vaccine Cache in Meta Shop → card appears in player deck next run
- Export save → download JSON → clear localStorage → import → state restored
