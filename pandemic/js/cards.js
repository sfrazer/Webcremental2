// Card type constants
const CARD_TYPE = {
  CITY: 'city',
  EVENT: 'event',
  EPIDEMIC: 'epidemic',
  SPECIAL: 'special',   // player deck additions from meta shop
  CHALLENGE: 'challenge', // infection deck additions (challenge modifiers)
  INFECTION: 'infection',
};

const BASE_EVENTS = [
  { type: CARD_TYPE.EVENT, id: 'one_quiet_night', name: 'One Quiet Night',
    description: 'Skip the next Infection Phase entirely.' },
  { type: CARD_TYPE.EVENT, id: 'government_grant', name: 'Government Grant',
    description: 'Add a Research Station to any city for free.' },
  { type: CARD_TYPE.EVENT, id: 'airlift', name: 'Airlift',
    description: 'Move your pawn to any city on the board.' },
  { type: CARD_TYPE.EVENT, id: 'resilient_population', name: 'Resilient Population',
    description: 'Remove any 1 card from the Infection discard pile permanently.' },
];

const SPECIAL_PLAYER_CARDS = [
  { type: CARD_TYPE.SPECIAL, id: 'vaccine_cache', name: 'Vaccine Cache',
    description: 'Treat ALL cubes of 1 color in your current city for free.' },
  { type: CARD_TYPE.SPECIAL, id: 'field_hospital', name: 'Field Hospital',
    description: 'Immediately build a Research Station in any city.' },
  { type: CARD_TYPE.SPECIAL, id: 'emergency_protocol', name: 'Emergency Protocol',
    description: 'Take 2 extra actions this turn.' },
  { type: CARD_TYPE.SPECIAL, id: 'quarantine_seal', name: 'Quarantine Seal',
    description: 'Prevent all infections in 1 city for 1 full round.' },
  { type: CARD_TYPE.SPECIAL, id: 'supply_drop', name: 'Supply Drop',
    description: 'Add 3 cubes back to any depleted disease supply.' },
];

const SPECIAL_CARD_MAP = {};
for (const c of [...BASE_EVENTS, ...SPECIAL_PLAYER_CARDS]) SPECIAL_CARD_MAP[c.id] = c;

const CHALLENGE_INFECTION_CARDS = [
  { type: CARD_TYPE.CHALLENGE, id: 'hotspot', name: 'Hotspot',
    description: 'Infect a random city with 2 cubes instead of 1.' },
  { type: CARD_TYPE.CHALLENGE, id: 'cascade_event', name: 'Cascade Event',
    description: 'Infect the top 2 cards from the infection deck instead of 1.' },
  { type: CARD_TYPE.CHALLENGE, id: 'virulent_strain', name: 'Virulent Strain',
    description: 'Next epidemic places cubes in 3 cities, not 1.' },
  { type: CARD_TYPE.CHALLENGE, id: 'travel_ban', name: 'Travel Ban',
    description: 'Flight actions are disabled for 1 full turn.' },
];

const INFECTION_RATE_TRACK = [2, 2, 2, 3, 3, 4, 4];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCityCard(cityId) {
  return { type: CARD_TYPE.CITY, cityId };
}

function makeInfectionCard(cityId) {
  return { type: CARD_TYPE.INFECTION, cityId };
}

function makeEpidemicCard() {
  return { type: CARD_TYPE.EPIDEMIC };
}

// Build the player deck: city cards + base events + meta special cards, then inject epidemics evenly.
function buildPlayerDeck(difficulty, playerDeckAdditions) {
  const cards = [];

  // 24 city cards
  for (const city of CITIES) cards.push(makeCityCard(city.id));

  // 4 base event cards
  for (const ev of BASE_EVENTS) cards.push({ ...ev });

  // meta-shop special cards
  if (playerDeckAdditions) {
    for (const [cardId, count] of Object.entries(playerDeckAdditions)) {
      const template = SPECIAL_CARD_MAP[cardId];
      if (template) {
        for (let i = 0; i < count; i++) cards.push({ ...template });
      }
    }
  }

  const shuffled = shuffle(cards);
  return distributeEpidemics(shuffled, difficulty);
}

// Split deck into N piles, add 1 epidemic to each pile, re-stack.
function distributeEpidemics(cards, count) {
  const pileSize = Math.floor(cards.length / count);
  const remainder = cards.length % count;
  const result = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const extra = i < remainder ? 1 : 0;
    const pile = cards.slice(offset, offset + pileSize + extra);
    pile.push(makeEpidemicCard());
    result.push(...shuffle(pile));
    offset += pileSize + extra;
  }
  return result;
}

// Build the infection deck: 24 city cards + challenge cards.
function buildInfectionDeck(infectionDeckAdditions) {
  const cards = [];
  for (const city of CITIES) cards.push(makeInfectionCard(city.id));

  if (infectionDeckAdditions) {
    for (const [cardId, count] of Object.entries(infectionDeckAdditions)) {
      const template = CHALLENGE_INFECTION_CARDS.find(c => c.id === cardId);
      if (template) {
        for (let i = 0; i < count; i++) cards.push({ ...template });
      }
    }
  }

  return shuffle(cards);
}

// Initial infection seeding: 3 cities × 3 cubes, 3 × 2, 3 × 1.
// Draws from top of infectionDeck. Returns { infectionDeck, infectionDiscard, cityCubesAdded }.
function seedInfections(infectionDeck, skipCount) {
  const deck = infectionDeck.slice();
  const discard = [];
  const seedings = []; // { cityId, count }

  let skipped = 0;
  const counts = [3, 3, 3, 2, 2, 2, 1, 1, 1];
  for (const cubeCount of counts) {
    if (deck.length === 0) break;
    const card = deck.shift();
    if (card.type !== CARD_TYPE.INFECTION) {
      // challenge card in seeding — treat as a normal infection of the last seeded city
      // (edge case: just skip it for seeding purposes)
      deck.unshift(card);
      break;
    }
    if (skipped < skipCount) {
      skipped++;
      // skip this infection (light_infections bonus)
      discard.push(card);
      // still consume a slot but add 0 cubes — decrement effective index
      continue;
    }
    discard.push(card);
    seedings.push({ cityId: card.cityId, count: cubeCount });
  }

  return { infectionDeck: deck, infectionDiscard: discard, seedings };
}

function getInfectionRate(idx) {
  return INFECTION_RATE_TRACK[Math.min(idx, INFECTION_RATE_TRACK.length - 1)];
}

function cardLabel(card) {
  if (card.type === CARD_TYPE.CITY) return CITY_MAP[card.cityId]?.name || card.cityId;
  if (card.type === CARD_TYPE.EPIDEMIC) return 'Epidemic!';
  if (card.type === CARD_TYPE.INFECTION) return CITY_MAP[card.cityId]?.name || card.cityId;
  return card.name || card.id;
}
