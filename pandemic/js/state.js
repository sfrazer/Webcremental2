const SAVE_KEY = 'outbreak_protocol_save';

const DEFAULT_RUN = {
  active: false,
  role: null,
  difficulty: 4,
  phase: 'setup',       // 'setup' | 'action' | 'draw' | 'infect' | 'won' | 'lost'
  actionsLeft: 4,
  hand: [],
  playerDeck: [],
  playerDiscard: [],
  infectionDeck: [],
  infectionDiscard: [],
  infectionRateIdx: 0,
  outbreaks: 0,
  cures: { blue: false, yellow: false, black: false, red: false },
  eradicated: { blue: false, yellow: false, black: false, red: false },
  curesRequired: 2,
  priorityCity: null,
  cities: {},           // { cityId: { cubes: {blue,yellow,black,red}, station: bool } }
  playerCity: null,
  cubeSupply: { blue: 24, yellow: 24, black: 24, red: 24 },
  loseReason: null,
  log: [],
  turn: 1,
  skipNextInfect: false,   // One Quiet Night effect
  flightBannedTurns: 0,    // Travel Ban effect
  quarantineSealCity: null, // city ID sealed this round
  dispatcherUsedFreeMove: false,
  contingencyCard: null,   // stored event card for Contingency Planner
};

const DEFAULT_META = {
  runs: 0,
  wins: 0,
  bestDifficultyWon: 0,
  researchPoints: 0,
  unlockedRoles: ['medic', 'scientist', 'dispatcher'],
  purchasedUpgrades: [],
  playerDeckAdditions: {},
  infectionDeckAdditions: {},
};

const DEFAULT_STATE = {
  version: '1.0.0',
  run: null,   // null when no active run; populated by startRun()
  meta: null,  // populated on first load
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, source) {
  if (typeof source !== 'object' || source === null) return source;
  if (typeof target !== 'object' || target === null) return deepClone(source);
  const result = deepClone(target);
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = deepClone(source[key]);
    }
  }
  return result;
}

// Initialize city grid from CITIES definition.
function buildCityGrid() {
  const grid = {};
  for (const city of CITIES) {
    grid[city.id] = {
      cubes: { blue: 0, yellow: 0, black: 0, red: 0 },
      station: false,
    };
  }
  return grid;
}

let gameState = {
  version: '1.0.0',
  run: null,
  meta: deepClone(DEFAULT_META),
};

function saveGame() {
  try {
    const toSave = {
      version: gameState.version,
      run: gameState.run,
      meta: gameState.meta,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
  } catch (e) {
    // storage quota or private mode — fail silently
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed.version) return false;
    gameState.version = parsed.version;
    gameState.meta = deepMerge(deepClone(DEFAULT_META), parsed.meta || {});
    gameState.run = parsed.run || null;
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  gameState.run = null;
  gameState.meta = deepClone(DEFAULT_META);
  gameState.version = DEFAULT_STATE.version;
}

// Initialise a fresh run and store it on gameState.
function startRun(roleId, difficulty, meta) {
  const run = deepClone(DEFAULT_RUN);
  run.active = true;
  run.role = roleId;
  run.difficulty = difficulty;
  run.cities = buildCityGrid();

  // Win condition scaled by difficulty
  run.curesRequired = difficulty <= 4 ? 2 : difficulty === 5 ? 3 : 4;

  // Place starting research station in Atlanta
  run.playerCity = 'atlanta';
  run.cities['atlanta'].station = true;

  // Decks
  const skipCount = meta.purchasedUpgrades.includes('light_infections') ? 2 : 0;
  run.playerDeck = buildPlayerDeck(difficulty, meta.playerDeckAdditions);
  run.infectionDeck = buildInfectionDeck(meta.infectionDeckAdditions);

  // Seed initial infections
  const { infectionDeck, infectionDiscard, seedings } = seedInfections(run.infectionDeck, skipCount);
  run.infectionDeck = infectionDeck;
  run.infectionDiscard = infectionDiscard;
  for (const { cityId, count } of seedings) {
    const color = CITY_MAP[cityId].color;
    run.cities[cityId].cubes[color] = Math.min(3, count);
    run.cubeSupply[color] = Math.max(0, run.cubeSupply[color] - count);
  }

  // Starting research station bonus
  if (meta.purchasedUpgrades.includes('starting_station')) {
    run.cities['atlanta'].station = true; // already set — no-op, but included for clarity
  }

  // Deal starting hand
  let handSize = 4;
  if (meta.purchasedUpgrades.includes('extra_card')) {
    const copies = meta.purchasedUpgrades.filter(id => id === 'extra_card').length;
    handSize += copies;
  }
  if (roleId === 'researcher') handSize += 1;

  for (let i = 0; i < handSize; i++) {
    const card = run.playerDeck.shift();
    if (card) run.hand.push(card);
  }

  // Researcher bonus: add Vaccine Cache to player deck
  if (roleId === 'researcher') {
    const vc = { type: CARD_TYPE.SPECIAL, id: 'vaccine_cache', name: 'Vaccine Cache',
      description: 'Treat ALL cubes of 1 color in your current city for free.' };
    run.playerDeck.splice(Math.floor(Math.random() * run.playerDeck.length), 0, vc);
  }

  // Dispatcher free move resets per turn
  run.dispatcherUsedFreeMove = false;

  // Legendary: pick a random priority city
  if (difficulty >= 7) {
    const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];
    run.priorityCity = randomCity.id;
  }

  run.phase = 'action';
  run.log.push('Run started. Good luck!');
  if (run.priorityCity) run.log.push(`Priority City: ${CITY_MAP[run.priorityCity].name} — do not let it outbreak!`);

  gameState.run = run;
}

function endRun(won) {
  const run = gameState.run;
  const meta = gameState.meta;

  meta.runs++;
  let rpEarned = 1; // attempt bonus

  const curesDiscovered = Object.values(run.cures).filter(Boolean).length;
  rpEarned += curesDiscovered * 2;

  if (won) {
    meta.wins++;
    rpEarned += 3;
    const diffBonus = run.difficulty - 4;
    rpEarned += diffBonus;
    if (run.difficulty > (meta.bestDifficultyWon || 0)) {
      meta.bestDifficultyWon = run.difficulty;
    }
    checkRoleUnlocks(meta);
  }

  meta.researchPoints += rpEarned;
  run.active = false;
  return rpEarned;
}

function getPrestigeShopItems() {
  return [
    { id: 'extra_card',        name: 'Extra Starting Card',    cost: 3,  description: 'Start each run with 1 extra card in hand. (Stack up to 3×)', stackable: true, maxStack: 3 },
    { id: 'starting_station',  name: 'Starting Station',       cost: 5,  description: 'Begin with a Research Station already placed.', stackable: false },
    { id: 'light_infections',  name: 'Light Infections',       cost: 8,  description: 'Skip the first 2 infection seedings at run start.', stackable: false },
    { id: 'remove_epidemic',   name: 'Remove Epidemic',        cost: 10, description: 'Remove 1 epidemic card from your deck each run.', stackable: false },
    { id: 'bonus_action',      name: 'Bonus Action',           cost: 12, description: 'Start each turn with 5 actions instead of 4.', stackable: false },
  ];
}

function tryBuyPrestigeUpgrade(upgradeId) {
  const items = getPrestigeShopItems();
  const item = items.find(i => i.id === upgradeId);
  if (!item) return false;
  const meta = gameState.meta;
  if (meta.researchPoints < item.cost) return false;
  if (!item.stackable && meta.purchasedUpgrades.includes(upgradeId)) return false;
  meta.researchPoints -= item.cost;
  meta.purchasedUpgrades.push(upgradeId);
  saveGame();
  return true;
}

function tryBuyPlayerCard(cardId) {
  const costs = { vaccine_cache: 3, field_hospital: 4, emergency_protocol: 5, quarantine_seal: 4, supply_drop: 3 };
  const cost = costs[cardId];
  if (cost === undefined) return false;
  const meta = gameState.meta;
  if (meta.researchPoints < cost) return false;
  const current = meta.playerDeckAdditions[cardId] || 0;
  if (current >= 2) return false; // max 2 copies
  meta.researchPoints -= cost;
  meta.playerDeckAdditions[cardId] = current + 1;
  saveGame();
  return true;
}

function tryBuyInfectionCard(cardId) {
  const bonuses = { hotspot: 1, cascade_event: 2, virulent_strain: 3, travel_ban: 1 };
  if (bonuses[cardId] === undefined) return false;
  const meta = gameState.meta;
  const current = meta.infectionDeckAdditions[cardId] || 0;
  if (current >= 2) return false;
  // infection cards cost 0 RP — they reward RP per run (tracked separately)
  meta.infectionDeckAdditions[cardId] = current + 1;
  saveGame();
  return true;
}

// Compute bonus RP per run from infection deck additions.
function getInfectionBonusRP() {
  const bonuses = { hotspot: 1, cascade_event: 2, virulent_strain: 3, travel_ban: 1 };
  let total = 0;
  for (const [id, count] of Object.entries(gameState.meta.infectionDeckAdditions)) {
    total += (bonuses[id] || 0) * count;
  }
  return total;
}

function appendLog(msg) {
  if (!gameState.run) return;
  gameState.run.log.push(msg);
  if (gameState.run.log.length > 100) gameState.run.log.shift();
}
