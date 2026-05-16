// ─── Test harness ─────────────────────────────────────────────────────────────

let _passed = 0, _failed = 0;
const _results = document.getElementById('results');

function group(name) {
  const div = document.createElement('div');
  div.className = 'group';
  div.textContent = '▸ ' + name;
  _results.appendChild(div);
}

function assert(label, condition, detail) {
  const div = document.createElement('div');
  if (condition) {
    _passed++;
    div.className = 'test pass';
    div.textContent = '✓ ' + label;
  } else {
    _failed++;
    div.className = 'test fail';
    div.textContent = '✗ ' + label;
    if (detail !== undefined) {
      const pre = document.createElement('pre');
      pre.textContent = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
      div.appendChild(pre);
    }
  }
  _results.appendChild(div);
}

function assertEqual(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(label, ok, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ─── Stub localStorage for test environment ───────────────────────────────────
if (typeof localStorage === 'undefined') {
  window.localStorage = { _store: {}, getItem(k) { return this._store[k] ?? null; }, setItem(k, v) { this._store[k] = v; }, removeItem(k) { delete this._store[k]; } };
}

// ─── Helper: set up a fresh game state for tests ─────────────────────────────
function freshRun(roleId = 'medic', difficulty = 4) {
  gameState.meta = deepClone(DEFAULT_META);
  startRun(roleId, difficulty, gameState.meta);
  return gameState.run;
}

// ─── cities.js ────────────────────────────────────────────────────────────────
group('cities.js');

assert('24 cities defined', CITIES.length === 24);
assertEqual('6 blue cities', getCitiesByColor('blue').length, 6);
assertEqual('6 yellow cities', getCitiesByColor('yellow').length, 6);
assertEqual('6 black cities', getCitiesByColor('black').length, 6);
assertEqual('6 red cities', getCitiesByColor('red').length, 6);
assert('all cities in CITY_MAP', CITIES.every(c => CITY_MAP[c.id] === c));
assert('connections are bidirectional', (() => {
  for (const city of CITIES) {
    for (const n of city.connections) {
      if (!CITY_MAP[n]) return false;
      if (!CITY_MAP[n].connections.includes(city.id)) return false;
    }
  }
  return true;
})());
assert('areCitiesAdjacent: atlanta–chicago', areCitiesAdjacent('atlanta', 'chicago'));
assert('areCitiesAdjacent: atlanta–tokyo is false', !areCitiesAdjacent('atlanta', 'tokyo'));
assert('getCityColor returns correct color', getCityColor('tokyo') === 'red');

// ─── roles.js ─────────────────────────────────────────────────────────────────
group('roles.js');

assert('7 roles defined', ROLES.length === 7);
assert('medic/scientist/dispatcher unlocked by default', (() => {
  const meta = deepClone(DEFAULT_META);
  return isRoleUnlocked('medic', meta) && isRoleUnlocked('scientist', meta) && isRoleUnlocked('dispatcher', meta);
})());
assert('quarantine_specialist not unlocked by default', !isRoleUnlocked('quarantine_specialist', deepClone(DEFAULT_META)));
assert('getUnlockedRoles returns 3 for fresh meta', getUnlockedRoles(deepClone(DEFAULT_META)).length === 3);
assert('checkRoleUnlocks unlocks quarantine_specialist after difficulty-4 win', (() => {
  const meta = deepClone(DEFAULT_META);
  meta.wins = 1;
  meta.bestDifficultyWon = 4;
  checkRoleUnlocks(meta);
  return meta.unlockedRoles.includes('quarantine_specialist');
})());

// ─── cards.js ─────────────────────────────────────────────────────────────────
group('cards.js');

assert('shuffle returns same-length array', (() => {
  const arr = [1, 2, 3, 4, 5];
  const s = shuffle(arr);
  return s.length === arr.length;
})());

assert('shuffle does not mutate original', (() => {
  const arr = [1, 2, 3, 4, 5];
  shuffle(arr);
  return arr.join(',') === '1,2,3,4,5';
})());

assert('buildPlayerDeck has epidemic cards equal to difficulty', (() => {
  for (const diff of [4, 5, 6, 7]) {
    const deck = buildPlayerDeck(diff, {});
    const epidemics = deck.filter(c => c.type === CARD_TYPE.EPIDEMIC);
    if (epidemics.length !== diff) return false;
  }
  return true;
})());

assert('buildPlayerDeck: 24 city cards + 4 event cards + epidemics', (() => {
  const diff = 4;
  const deck = buildPlayerDeck(diff, {});
  const cities = deck.filter(c => c.type === CARD_TYPE.CITY);
  const events = deck.filter(c => c.type === CARD_TYPE.EVENT || c.type === CARD_TYPE.SPECIAL);
  const epis = deck.filter(c => c.type === CARD_TYPE.EPIDEMIC);
  return cities.length === 24 && events.length === 4 && epis.length === diff;
})());

assert('buildPlayerDeck: player deck additions included', (() => {
  const deck = buildPlayerDeck(4, { vaccine_cache: 2 });
  const specials = deck.filter(c => c.id === 'vaccine_cache');
  return specials.length === 2;
})());

assert('buildInfectionDeck has 24 infection cards', (() => {
  const deck = buildInfectionDeck({});
  return deck.filter(c => c.type === CARD_TYPE.INFECTION).length === 24;
})());

assert('seedInfections draws 9 cities total', (() => {
  const deck = buildInfectionDeck({});
  const { seedings } = seedInfections(deck, 0);
  return seedings.length === 9;
})());

assert('seedInfections: first 3 get 3 cubes, next 3 get 2, last 3 get 1', (() => {
  const deck = buildInfectionDeck({});
  const { seedings } = seedInfections(deck, 0);
  return seedings.slice(0,3).every(s => s.count === 3) &&
         seedings.slice(3,6).every(s => s.count === 2) &&
         seedings.slice(6,9).every(s => s.count === 1);
})());

assert('seedInfections with skipCount=2 seeds only 7 cities', (() => {
  const deck = buildInfectionDeck({});
  const { seedings } = seedInfections(deck, 2);
  return seedings.length === 7;
})());

assert('getInfectionRate track: idx 0→2, idx 3→3, idx 5→4', (() => {
  return getInfectionRate(0) === 2 && getInfectionRate(3) === 3 && getInfectionRate(5) === 4;
})());

// ─── state.js ─────────────────────────────────────────────────────────────────
group('state.js');

assert('deepMerge: source values overwrite target', (() => {
  const target = { a: 1, b: { c: 2 } };
  const source = { a: 10, b: { c: 20, d: 30 } };
  const result = deepMerge(target, source);
  return result.a === 10 && result.b.c === 20 && result.b.d === 30;
})());

assert('deepMerge: nested default preserved when source key missing', (() => {
  const target = { a: 1, b: { c: 2, d: 99 } };
  const source = { b: { c: 5 } };
  const result = deepMerge(target, source);
  return result.b.d === 99;
})());

assert('deepClone returns independent copy', (() => {
  const obj = { a: [1, 2, 3] };
  const clone = deepClone(obj);
  clone.a.push(4);
  return obj.a.length === 3;
})());

assert('saveGame / loadGame round-trip', (() => {
  gameState.meta = deepClone(DEFAULT_META);
  gameState.meta.researchPoints = 42;
  gameState.run = null;
  saveGame();
  gameState.meta.researchPoints = 0;
  const ok = loadGame();
  return ok && gameState.meta.researchPoints === 42;
})());

assert('resetGame clears localStorage and state', (() => {
  saveGame();
  resetGame();
  return localStorage.getItem(SAVE_KEY) === null && gameState.meta.researchPoints === 0;
})());

assert('startRun places station in Atlanta', (() => {
  const run = freshRun();
  return run.cities['atlanta'].station === true;
})());

assert('startRun sets curesRequired=2 for difficulty 4', (() => {
  const run = freshRun('medic', 4);
  return run.curesRequired === 2;
})());

assert('startRun sets curesRequired=3 for difficulty 5', (() => {
  const run = freshRun('medic', 5);
  return run.curesRequired === 3;
})());

assert('startRun sets curesRequired=4 for difficulty 6', (() => {
  const run = freshRun('medic', 6);
  return run.curesRequired === 4;
})());

assert('startRun deals 4 cards to hand', (() => {
  const run = freshRun();
  return run.hand.length === 4;
})());

assert('startRun: researcher gets 5 cards', (() => {
  const run = freshRun('researcher');
  return run.hand.length === 5;
})());

assert('startRun: priorityCity set for difficulty 7', (() => {
  const run = freshRun('medic', 7);
  return run.priorityCity !== null && CITY_MAP[run.priorityCity] !== undefined;
})());

assert('startRun: priorityCity null for difficulty < 7', (() => {
  const run = freshRun('medic', 4);
  return run.priorityCity === null;
})());

assert('appendLog adds to run.log', (() => {
  freshRun();
  const before = gameState.run.log.length;
  appendLog('test message');
  return gameState.run.log.length === before + 1 && gameState.run.log.at(-1) === 'test message';
})());

// ─── engine.js ────────────────────────────────────────────────────────────────
group('engine.js');

assert('tryDriveToCity: move to adjacent city succeeds', (() => {
  const run = freshRun();
  run.playerCity = 'atlanta';
  return tryDriveToCity('chicago') && run.playerCity === 'chicago';
})());

assert('tryDriveToCity: fails for non-adjacent city', (() => {
  const run = freshRun();
  run.playerCity = 'atlanta';
  const before = run.actionsLeft;
  const ok = tryDriveToCity('tokyo');
  return !ok && run.actionsLeft === before;
})());

assert('tryDriveToCity: costs 1 action', (() => {
  const run = freshRun();
  const before = run.actionsLeft;
  tryDriveToCity('chicago');
  return run.actionsLeft === before - 1;
})());

assert('tryDriveToCity: fails when 0 actions left', (() => {
  const run = freshRun();
  run.actionsLeft = 0;
  return !tryDriveToCity('chicago');
})());

assert('tryBuildStation: succeeds at current city with matching card', (() => {
  const run = freshRun('medic');
  run.playerCity = 'chicago';
  run.cities['chicago'].station = false;
  run.hand.push({ type: CARD_TYPE.CITY, cityId: 'chicago' });
  const ok = tryBuildStation();
  return ok && run.cities['chicago'].station === true;
})());

assert('tryBuildStation: fails if station already exists', (() => {
  const run = freshRun();
  run.cities['atlanta'].station = true;
  return !tryBuildStation();
})());

assert('tryBuildStation: operations_expert needs no card', (() => {
  const run = freshRun('operations_expert');
  run.playerCity = 'chicago';
  run.cities['chicago'].station = false;
  // Ensure no chicago card in hand
  run.hand = run.hand.filter(c => !(c.type === CARD_TYPE.CITY && c.cityId === 'chicago'));
  return tryBuildStation() && run.cities['chicago'].station === true;
})());

assert('tryTreatDisease: removes 1 cube (non-medic, uncured)', (() => {
  const run = freshRun('scientist');
  run.playerCity = 'atlanta';
  run.cities['atlanta'].cubes.blue = 2;
  run.cubeSupply.blue = 22;
  tryTreatDisease('blue');
  return run.cities['atlanta'].cubes.blue === 1 && run.cubeSupply.blue === 23;
})());

assert('tryTreatDisease: medic removes all cubes', (() => {
  const run = freshRun('medic');
  run.playerCity = 'atlanta';
  run.cities['atlanta'].cubes.blue = 3;
  run.cubeSupply.blue = 21;
  tryTreatDisease('blue');
  return run.cities['atlanta'].cubes.blue === 0 && run.cubeSupply.blue === 24;
})());

assert('tryTreatDisease: removes all cubes when disease cured (any role)', (() => {
  const run = freshRun('scientist');
  run.playerCity = 'atlanta';
  run.cities['atlanta'].cubes.blue = 2;
  run.cubeSupply.blue = 22;
  run.cures.blue = true;
  tryTreatDisease('blue');
  return run.cities['atlanta'].cubes.blue === 0;
})());

assert('tryDiscoverCure: succeeds with 5 same-color cards (scientist needs 4)', (() => {
  const run = freshRun('scientist');
  run.playerCity = 'atlanta';
  run.cities['atlanta'].station = true;
  run.hand = [];
  // Give 4 blue cards
  const blueCities = getCitiesByColor('blue').slice(0, 4);
  for (const c of blueCities) run.hand.push({ type: CARD_TYPE.CITY, cityId: c.id });
  const ok = tryDiscoverCure('blue', blueCities.map(c => c.id));
  return ok && run.cures.blue === true;
})());

assert('tryDiscoverCure: medic needs 5 cards', (() => {
  const run = freshRun('medic');
  run.playerCity = 'atlanta';
  run.cities['atlanta'].station = true;
  run.hand = [];
  const blueCities = getCitiesByColor('blue').slice(0, 4);
  for (const c of blueCities) run.hand.push({ type: CARD_TYPE.CITY, cityId: c.id });
  // only 4 cards — should fail for medic
  return !tryDiscoverCure('blue', blueCities.map(c => c.id));
})());

assert('tryDiscoverCure: fails without research station', (() => {
  const run = freshRun('scientist');
  run.playerCity = 'chicago';
  run.cities['chicago'].station = false;
  run.hand = getCitiesByColor('blue').slice(0, 4).map(c => ({ type: CARD_TYPE.CITY, cityId: c.id }));
  return !tryDiscoverCure('blue', getCitiesByColor('blue').slice(0, 4).map(c => c.id));
})());

assert('resolveOutbreak: increments outbreak counter', (() => {
  const run = freshRun();
  // Clear all blue cubes from the board to control state
  for (const cs of Object.values(run.cities)) cs.cubes.blue = 0;
  run.cubeSupply.blue = 24;
  run.outbreaks = 3;
  run.cities['atlanta'].cubes.blue = 3;
  resolveInfection('atlanta', 'blue', 1);
  return run.outbreaks === 4;
})());

assert('resolveOutbreak: chain does not re-outbreak visited cities', (() => {
  const run = freshRun();
  // Clear all blue cubes from the board, then set up controlled state
  for (const cs of Object.values(run.cities)) cs.cubes.blue = 0;
  run.cubeSupply.blue = 24;
  // Atlanta and Chicago both at 3 blue cubes
  run.cities['atlanta'].cubes.blue = 3;
  run.cities['chicago'].cubes.blue = 3;
  run.cubeSupply.blue -= 6;
  const before = run.outbreaks;
  resolveInfection('atlanta', 'blue', 1);
  // 2 outbreaks: atlanta + chicago. Chicago's neighbors (Atlanta/NewYork/London) get +1.
  // Atlanta is in visited set so no 3rd outbreak there.
  return run.outbreaks === before + 2;
})());

assert('resolveEpidemic: advances infectionRateIdx', (() => {
  const run = freshRun();
  run.infectionRateIdx = 0;
  run.infectionDeck = [{ type: CARD_TYPE.INFECTION, cityId: 'tokyo' }];
  run.infectionDiscard = [];
  resolveEpidemic();
  return run.infectionRateIdx === 1;
})());

assert('resolveEpidemic: places 3 cubes on bottom card city', (() => {
  const run = freshRun();
  run.infectionRateIdx = 0;
  run.cities['tokyo'].cubes.red = 0;
  run.cubeSupply.red = 24;
  run.infectionDeck = [{ type: CARD_TYPE.INFECTION, cityId: 'tokyo' }];
  run.infectionDiscard = [];
  resolveEpidemic();
  return run.cities['tokyo'].cubes.red === 3;
})());

assert('resolveEpidemic: shuffles discard+epidemic card onto deck', (() => {
  const run = freshRun();
  run.infectionDeck = [{ type: CARD_TYPE.INFECTION, cityId: 'tokyo' }];
  run.infectionDiscard = [
    { type: CARD_TYPE.INFECTION, cityId: 'beijing' },
    { type: CARD_TYPE.INFECTION, cityId: 'hong_kong' },
  ];
  resolveEpidemic();
  // tokyo goes to discard, then all 3 (tokyo+beijing+hong_kong) are shuffled onto deck
  return run.infectionDiscard.length === 0 && run.infectionDeck.length === 3;
})());

assert('checkWinCondition: returns won when cures >= curesRequired', (() => {
  const run = freshRun('medic', 4); // curesRequired = 2
  run.cures.blue = true; run.cures.yellow = true;
  return checkWinCondition() === 'won';
})());

assert('checkWinCondition: returns null when cures < curesRequired', (() => {
  const run = freshRun('medic', 4);
  run.cures.blue = true;
  return checkWinCondition() === null;
})());

assert('checkWinCondition: eradication win on heroic (2 eradicated)', (() => {
  const run = freshRun('medic', 6); // curesRequired = 4, heroic
  run.eradicated.blue = true; run.eradicated.yellow = true;
  return checkWinCondition() === 'won';
})());

assert('checkWinCondition: no eradication win on standard (difficulty 5)', (() => {
  const run = freshRun('medic', 5);
  run.eradicated.blue = true; run.eradicated.yellow = true;
  return checkWinCondition() === null; // still needs 3 cures
})());

assert('checkLoseCondition: 8 outbreaks → lost', (() => {
  const run = freshRun();
  run.outbreaks = 8;
  return checkLoseCondition() === 'lost';
})());

assert('checkLoseCondition: empty cube supply → lost', (() => {
  const run = freshRun();
  run.cubeSupply.blue = -1;
  return checkLoseCondition() === 'lost';
})());

assert('checkLoseCondition: empty player deck during draw → lost', (() => {
  const run = freshRun();
  run.phase = 'draw';
  run.playerDeck = [];
  return checkLoseCondition() === 'lost';
})());

assert('checkLoseCondition: returns null when no lose condition', (() => {
  const run = freshRun();
  return checkLoseCondition() === null;
})());

assert('checkEradication: marks eradicated when cured and no cubes on board', (() => {
  const run = freshRun();
  run.cures.blue = true;
  for (const cs of Object.values(run.cities)) cs.cubes.blue = 0;
  checkEradication('blue');
  return run.eradicated.blue === true;
})());

assert('checkEradication: does NOT eradicate when cubes remain', (() => {
  const run = freshRun();
  run.cures.blue = true;
  run.cities['atlanta'].cubes.blue = 1;
  checkEradication('blue');
  return run.eradicated.blue === false;
})());

assert('eradicated city skips infection', (() => {
  const run = freshRun();
  run.cures.blue = true;
  for (const cs of Object.values(run.cities)) cs.cubes.blue = 0;
  checkEradication('blue');
  run.cities['london'].cubes.blue = 0;
  run.cubeSupply.blue = 24;
  resolveInfection('london', 'blue', 1);
  return run.cities['london'].cubes.blue === 0; // eradicated = no infection
})());

assert('Legendary priority city lose on outbreak', (() => {
  const run = freshRun('medic', 7);
  const pc = run.priorityCity;
  run.cities[pc].cubes[CITY_MAP[pc].color] = 3;
  run.cubeSupply[CITY_MAP[pc].color] = 21;
  resolveInfection(pc, CITY_MAP[pc].color, 1);
  return run.loseReason !== null && run.loseReason.includes(CITY_MAP[pc].name);
})());

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = _passed + _failed;
const summary = document.getElementById('summary');
summary.innerHTML = _failed === 0
  ? `<span class="pass">✓ All ${total} tests passed</span>`
  : `<span class="fail">✗ ${_failed} failed</span> / <span class="pass">✓ ${_passed} passed</span> — ${total} total`;
