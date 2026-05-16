// ─── Helpers ─────────────────────────────────────────────────────────────────

// Tracked per epidemic/infect tick so game.js can animate them.
let _outbreakCitiesThisTick = [];
let _lastEpidemicCity = null;

function getRun() { return gameState.run; }

function getCuresNeeded(roleId) {
  return roleId === 'scientist' ? 4 : 5;
}

function getActionsPerTurn() {
  const run = getRun();
  const base = gameState.meta.purchasedUpgrades.includes('bonus_action') ? 5 : 4;
  return base;
}

// Cities protected from infection by Quarantine Specialist this turn.
function _quarantinedCities() {
  const run = getRun();
  if (run.role !== 'quarantine_specialist') return new Set();
  const protected_ = new Set([run.playerCity]);
  for (const neighbor of CITY_MAP[run.playerCity].connections) protected_.add(neighbor);
  return protected_;
}

// ─── Core infection logic ─────────────────────────────────────────────────────

// Place `count` cubes of `color` in `cityId`. Handles supply depletion and outbreaks.
// `visited` is a Set of cityIds already outbreaking this chain (prevents re-outbreak).
// Returns 'lose' if any lose condition triggered, otherwise null.
function _infect(cityId, color, count, visited) {
  const run = getRun();
  const quarantined = _quarantinedCities();

  if (quarantined.has(cityId)) {
    appendLog(`${CITY_MAP[cityId].name} is quarantined — infection prevented.`);
    return null;
  }
  if (run.quarantineSealCity === cityId) {
    appendLog(`${CITY_MAP[cityId].name} is sealed — infection prevented.`);
    return null;
  }

  // Eradicated disease: skip infection
  if (run.eradicated[color]) return null;

  const cityState = run.cities[cityId];
  const space = 3 - cityState.cubes[color];

  if (space >= count) {
    // Normal: place cubes
    const actual = Math.min(count, run.cubeSupply[color]);
    cityState.cubes[color] += actual;
    run.cubeSupply[color] -= actual;
    if (run.cubeSupply[color] <= 0 && cityState.cubes[color] < count) return 'lose_cubes';
    return null;
  }

  // Would exceed 3 → place up to 3 then outbreak
  const placeable = space;
  if (placeable > 0) {
    const actual = Math.min(placeable, run.cubeSupply[color]);
    cityState.cubes[color] += actual;
    run.cubeSupply[color] -= actual;
    if (run.cubeSupply[color] < 0) return 'lose_cubes';
  }

  return resolveOutbreak(cityId, color, visited);
}

function resolveOutbreak(cityId, color, visited) {
  if (!visited) visited = new Set();
  if (visited.has(cityId)) return null;
  visited.add(cityId);

  const run = getRun();
  run.outbreaks++;
  _outbreakCitiesThisTick.push(cityId);
  appendLog(`OUTBREAK in ${CITY_MAP[cityId].name}! (${run.outbreaks}/8)`);

  // Priority City lose condition (Legendary)
  if (run.priorityCity === cityId) {
    run.loseReason = `Priority City ${CITY_MAP[cityId].name} outbreaked!`;
    return 'lose_priority';
  }

  if (run.outbreaks >= 8) {
    run.loseReason = '8 outbreaks reached!';
    return 'lose_outbreaks';
  }

  for (const neighborId of CITY_MAP[cityId].connections) {
    const result = _infect(neighborId, color, 1, visited);
    if (result && result.startsWith('lose')) return result;
  }
  return null;
}

function resolveInfection(cityId, color, count) {
  return _infect(cityId, color, count, new Set());
}

// ─── Epidemic resolution ──────────────────────────────────────────────────────

function resolveEpidemic() {
  const run = getRun();
  _lastEpidemicCity = null;
  appendLog('EPIDEMIC!');

  // 1. Intensify: advance infection rate
  if (run.infectionRateIdx < INFECTION_RATE_TRACK.length - 1) {
    run.infectionRateIdx++;
  }

  // 2. Infect: bottom card of infection deck → place 3 cubes
  if (run.infectionDeck.length === 0) return null;
  const bottomCard = run.infectionDeck.pop();
  run.infectionDiscard.unshift(bottomCard);

  if (bottomCard.type === CARD_TYPE.INFECTION) {
    _lastEpidemicCity = bottomCard.cityId;
    const color = CITY_MAP[bottomCard.cityId].color;
    appendLog(`Epidemic infects ${CITY_MAP[bottomCard.cityId].name} with 3 ${color} cubes.`);
    const result = resolveInfection(bottomCard.cityId, color, 3);
    if (result && result.startsWith('lose')) {
      run.loseReason = run.loseReason || `Cube supply depleted (${color})!`;
      return result;
    }
  } else if (bottomCard.type === CARD_TYPE.CHALLENGE) {
    _applyChallengeInfectionCard(bottomCard);
  }

  // 3. Intensify: shuffle infection discard pile, place on top of deck
  const shuffledDiscard = shuffle(run.infectionDiscard.slice());
  run.infectionDeck = [...shuffledDiscard, ...run.infectionDeck];
  run.infectionDiscard = [];

  return null;
}

// ─── Eradication ─────────────────────────────────────────────────────────────

function checkEradication(color) {
  const run = getRun();
  if (!run.cures[color]) return false;
  if (run.eradicated[color]) return false;
  // Check if any cubes of this color remain on the board
  for (const cityState of Object.values(run.cities)) {
    if (cityState.cubes[color] > 0) return false;
  }
  run.eradicated[color] = true;
  appendLog(`${color.toUpperCase()} disease eradicated!`);
  return true;
}

// ─── Win / Lose checks ────────────────────────────────────────────────────────

function checkWinCondition() {
  const run = getRun();
  const curedCount = Object.values(run.cures).filter(Boolean).length;

  // Primary win: required number of cures
  if (curedCount >= run.curesRequired) return 'won';

  // Eradication win (Heroic+): eradicate any 2 diseases
  if (run.difficulty >= 6) {
    const eradicatedCount = Object.values(run.eradicated).filter(Boolean).length;
    if (eradicatedCount >= 2) return 'won';
  }

  return null;
}

function checkLoseCondition() {
  const run = getRun();

  if (run.outbreaks >= 8) {
    run.loseReason = run.loseReason || '8 outbreaks reached!';
    return 'lost';
  }

  for (const [color, supply] of Object.entries(run.cubeSupply)) {
    if (supply < 0) {
      run.loseReason = run.loseReason || `Ran out of ${color} disease cubes!`;
      return 'lost';
    }
  }

  if (run.phase === 'draw' && run.playerDeck.length === 0) {
    run.loseReason = run.loseReason || 'Player deck exhausted!';
    return 'lost';
  }

  if (run.loseReason) return 'lost';

  return null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function _spendAction() {
  getRun().actionsLeft--;
}

function tryDriveToCity(cityId) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (!areCitiesAdjacent(run.playerCity, cityId)) return false;

  _spendAction();
  run.playerCity = cityId;
  appendLog(`Moved to ${CITY_MAP[cityId].name}.`);

  // Medic: auto-treat cured diseases on arrival
  if (run.role === 'medic') {
    for (const [color, cured] of Object.entries(run.cures)) {
      if (cured && run.cities[cityId].cubes[color] > 0) {
        const removed = run.cities[cityId].cubes[color];
        run.cubeSupply[color] += removed;
        run.cities[cityId].cubes[color] = 0;
        appendLog(`Medic auto-treated ${removed} ${color} cubes in ${CITY_MAP[cityId].name}.`);
        checkEradication(color);
      }
    }
  }

  saveGame();
  return true;
}

function tryDirectFlight(cityId) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (run.flightBannedTurns > 0) { appendLog('Flight actions are banned this turn!'); return false; }
  const cardIdx = run.hand.findIndex(c => c.type === CARD_TYPE.CITY && c.cityId === cityId);
  if (cardIdx === -1) return false;

  run.hand.splice(cardIdx, 1);
  run.playerDiscard.push({ type: CARD_TYPE.CITY, cityId });
  _spendAction();
  run.playerCity = cityId;
  appendLog(`Direct flight to ${CITY_MAP[cityId].name}.`);
  _medicAutoTreat(cityId);
  saveGame();
  return true;
}

function tryCharterFlight(cityId) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (run.flightBannedTurns > 0) { appendLog('Flight actions are banned this turn!'); return false; }
  const cardIdx = run.hand.findIndex(c => c.type === CARD_TYPE.CITY && c.cityId === run.playerCity);
  if (cardIdx === -1) return false;

  run.hand.splice(cardIdx, 1);
  run.playerDiscard.push({ type: CARD_TYPE.CITY, cityId: run.playerCity });
  _spendAction();
  run.playerCity = cityId;
  appendLog(`Charter flight to ${CITY_MAP[cityId].name}.`);
  _medicAutoTreat(cityId);
  saveGame();
  return true;
}

function tryShuttleFlight(cityId) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (run.flightBannedTurns > 0) { appendLog('Flight actions are banned this turn!'); return false; }
  if (!run.cities[run.playerCity].station) return false;
  if (!run.cities[cityId].station) return false;
  if (run.playerCity === cityId) return false;

  _spendAction();
  run.playerCity = cityId;
  appendLog(`Shuttle flight to ${CITY_MAP[cityId].name}.`);
  _medicAutoTreat(cityId);
  saveGame();
  return true;
}

// Dispatcher free move: to any city with a research station (once per turn, costs 0 actions)
function tryDispatcherFreeMove(cityId) {
  const run = getRun();
  if (run.role !== 'dispatcher') return false;
  if (run.phase !== 'action') return false;
  if (run.dispatcherUsedFreeMove) return false;
  if (!run.cities[cityId].station) return false;

  run.dispatcherUsedFreeMove = true;
  run.playerCity = cityId;
  appendLog(`Dispatcher free move to ${CITY_MAP[cityId].name}.`);
  _medicAutoTreat(cityId);
  saveGame();
  return true;
}

function tryBuildStation() {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (run.cities[run.playerCity].station) return false;

  if (run.role === 'operations_expert') {
    // No card needed
  } else {
    const cardIdx = run.hand.findIndex(c => c.type === CARD_TYPE.CITY && c.cityId === run.playerCity);
    if (cardIdx === -1) return false;
    run.hand.splice(cardIdx, 1);
    run.playerDiscard.push({ type: CARD_TYPE.CITY, cityId: run.playerCity });
  }

  _spendAction();
  run.cities[run.playerCity].station = true;
  appendLog(`Research Station built in ${CITY_MAP[run.playerCity].name}.`);
  saveGame();
  return true;
}

function tryTreatDisease(color) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  const city = run.cities[run.playerCity];
  if (city.cubes[color] === 0) return false;

  _spendAction();

  if (run.role === 'medic' || run.cures[color]) {
    // Remove all cubes of this color
    const removed = city.cubes[color];
    run.cubeSupply[color] += removed;
    city.cubes[color] = 0;
    appendLog(`Treated all ${removed} ${color} cubes in ${CITY_MAP[run.playerCity].name}.`);
  } else {
    city.cubes[color]--;
    run.cubeSupply[color]++;
    appendLog(`Treated 1 ${color} cube in ${CITY_MAP[run.playerCity].name}.`);
  }

  checkEradication(color);
  saveGame();
  return true;
}

function tryDiscoverCure(color, cardIds) {
  const run = getRun();
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;
  if (!run.cities[run.playerCity].station) return false;
  if (run.cures[color]) return false;

  const needed = getCuresNeeded(run.role);
  if (cardIds.length < needed) return false;

  // Validate all selected cards are in hand and match color
  for (const cid of cardIds) {
    const idx = run.hand.findIndex(c => c.type === CARD_TYPE.CITY && c.cityId === cid && CITY_MAP[cid].color === color);
    if (idx === -1) return false;
  }

  // Discard the cards
  for (const cid of cardIds) {
    const idx = run.hand.findIndex(c => c.type === CARD_TYPE.CITY && c.cityId === cid);
    run.hand.splice(idx, 1);
    run.playerDiscard.push({ type: CARD_TYPE.CITY, cityId: cid });
  }

  _spendAction();
  run.cures[color] = true;
  appendLog(`${color.toUpperCase()} disease cured!`);
  checkEradication(color);
  saveGame();
  return true;
}

// Play an event/special card from hand by its index in run.hand.
function tryPlayCard(handIdx) {
  const run = getRun();
  const card = run.hand[handIdx];
  if (!card) return false;

  if (card.type !== CARD_TYPE.EVENT && card.type !== CARD_TYPE.SPECIAL) return false;

  run.hand.splice(handIdx, 1);
  run.playerDiscard.push(card);

  // Effects handled by caller (game.js) with UI for target selection;
  // simple self-contained effects resolved here:
  if (card.id === 'one_quiet_night') {
    run.skipNextInfect = true;
    appendLog('One Quiet Night played — next infection phase skipped.');
  } else if (card.id === 'supply_drop') {
    // Restore 3 cubes to the most depleted color
    let minColor = null, minVal = Infinity;
    for (const [c, v] of Object.entries(run.cubeSupply)) if (v < minVal) { minVal = v; minColor = c; }
    if (minColor) { run.cubeSupply[minColor] = Math.min(24, run.cubeSupply[minColor] + 3); }
    appendLog(`Supply Drop: +3 ${minColor} cubes restored.`);
  }

  saveGame();
  return card;
}

// Contingency Planner: retrieve event from player discard
function tryContingencyRetrieve(cardIdx) {
  const run = getRun();
  if (run.role !== 'contingency_planner') return false;
  if (run.contingencyCard) return false; // already holding one
  if (run.phase !== 'action' || run.actionsLeft <= 0) return false;

  const card = run.playerDiscard[cardIdx];
  if (!card || (card.type !== CARD_TYPE.EVENT && card.type !== CARD_TYPE.SPECIAL)) return false;

  run.playerDiscard.splice(cardIdx, 1);
  run.contingencyCard = card;
  _spendAction();
  appendLog(`Contingency Planner retrieved ${card.name}.`);
  saveGame();
  return true;
}

function tryPlayContingencyCard() {
  const run = getRun();
  if (!run.contingencyCard) return false;
  const card = run.contingencyCard;
  run.contingencyCard = null;
  // Card is removed from game (not added to discard)
  appendLog(`Played contingency card: ${card.name}.`);
  return card;
}

// ─── Phase advancement ────────────────────────────────────────────────────────

function endActionPhase() {
  const run = getRun();
  run.phase = 'draw';
  run.dispatcherUsedFreeMove = false;
  appendLog('Draw phase.');
  saveGame();
}

// Returns list of events that happened during draw (epidemics, cards drawn).
// Caller must check checkLoseCondition() and checkWinCondition() after.
function doDrawPhase() {
  const run = getRun();
  const events = [];

  for (let i = 0; i < 2; i++) {
    if (run.playerDeck.length === 0) {
      run.loseReason = 'Player deck exhausted!';
      events.push({ type: 'lose', reason: run.loseReason });
      break;
    }

    const card = run.playerDeck.shift();

    if (card.type === CARD_TYPE.EPIDEMIC) {
      const result = resolveEpidemic();
      events.push({ type: 'epidemic', cityId: _lastEpidemicCity });
      if (result && result.startsWith('lose')) {
        run.loseReason = run.loseReason || 'Cube supply depleted!';
        events.push({ type: 'lose', reason: run.loseReason });
        break;
      }
    } else {
      run.hand.push(card);
      run.playerDiscard.push(card); // no — card goes to hand not discard yet
      // Fix: remove from discard, keep in hand
      run.playerDiscard.pop();
      events.push({ type: 'draw', card });
      appendLog(`Drew ${cardLabel(card)}.`);
    }
  }

  run.phase = 'infect';
  saveGame();
  return events;
}

function doInfectPhase() {
  const run = getRun();
  const events = [];
  _outbreakCitiesThisTick = [];

  if (run.skipNextInfect) {
    run.skipNextInfect = false;
    appendLog('Infection phase skipped (One Quiet Night).');
    events.push({ type: 'skipped' });
  } else {
    const rate = getInfectionRate(run.infectionRateIdx);
    for (let i = 0; i < rate; i++) {
      if (run.infectionDeck.length === 0) break;
      const card = run.infectionDeck.shift();

      if (card.type === CARD_TYPE.INFECTION) {
        run.infectionDiscard.unshift(card);
        const color = CITY_MAP[card.cityId].color;
        appendLog(`Infecting ${CITY_MAP[card.cityId].name} (${color}).`);
        const result = resolveInfection(card.cityId, color, 1);
        if (result && result.startsWith('lose')) {
          run.loseReason = run.loseReason || `Cube supply depleted!`;
          events.push({ type: 'lose', reason: run.loseReason });
          break;
        }
        events.push({ type: 'infection', cityId: card.cityId, color });
      } else if (card.type === CARD_TYPE.CHALLENGE) {
        _applyChallengeInfectionCard(card);
        events.push({ type: 'challenge', card });
      }
    }
  }

  // Include outbreak events so game.js can animate them
  for (const c of _outbreakCitiesThisTick) events.push({ type: 'outbreak', cityId: c });

  // Reset per-turn transient state
  run.quarantineSealCity = null;
  if (run.flightBannedTurns > 0) run.flightBannedTurns--;

  // Advance to next action phase
  run.turn++;
  run.actionsLeft = getActionsPerTurn();
  run.phase = 'action';
  appendLog(`--- Turn ${run.turn} ---`);
  saveGame();
  return events;
}

// ─── Challenge infection cards ────────────────────────────────────────────────

function _applyChallengeInfectionCard(card) {
  const run = getRun();
  appendLog(`Challenge: ${card.name} — ${card.description}`);

  if (card.id === 'hotspot') {
    // Infect a random city with 2 cubes
    if (run.infectionDeck.length > 0) {
      const top = run.infectionDeck.shift();
      run.infectionDiscard.unshift(top);
      if (top.type === CARD_TYPE.INFECTION) {
        const color = CITY_MAP[top.cityId].color;
        resolveInfection(top.cityId, color, 2);
      }
    }
  } else if (card.id === 'cascade_event') {
    // Infect top 2 infection cards
    for (let i = 0; i < 2; i++) {
      if (run.infectionDeck.length === 0) break;
      const c = run.infectionDeck.shift();
      run.infectionDiscard.unshift(c);
      if (c.type === CARD_TYPE.INFECTION) {
        const color = CITY_MAP[c.cityId].color;
        resolveInfection(c.cityId, color, 1);
      }
    }
  } else if (card.id === 'virulent_strain') {
    // Flag for next epidemic to place 3 cities
    run._virulentStrain = true;
  } else if (card.id === 'travel_ban') {
    run.flightBannedTurns = 1;
  }
}

// ─── Medic helper ─────────────────────────────────────────────────────────────

function _medicAutoTreat(cityId) {
  const run = getRun();
  if (run.role !== 'medic') return;
  for (const [color, cured] of Object.entries(run.cures)) {
    if (cured && run.cities[cityId].cubes[color] > 0) {
      const removed = run.cities[cityId].cubes[color];
      run.cubeSupply[color] += removed;
      run.cities[cityId].cubes[color] = 0;
      appendLog(`Medic auto-treated ${removed} ${color} cubes in ${CITY_MAP[cityId].name}.`);
      checkEradication(color);
    }
  }
}
