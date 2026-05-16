const ROLES = [
  {
    id: 'medic',
    name: 'Medic',
    color: '#27ae60',
    description: 'Remove ALL cubes of one color per Treat action. Auto-treats cured diseases when moving.',
    unlockCondition: null, // always available
    startingCity: 'atlanta',
  },
  {
    id: 'scientist',
    name: 'Scientist',
    color: '#2980b9',
    description: 'Needs only 4 cards (instead of 5) to Discover a Cure.',
    unlockCondition: null,
    startingCity: 'atlanta',
  },
  {
    id: 'dispatcher',
    name: 'Dispatcher',
    color: '#8e44ad',
    description: 'Once per turn, may move to any city with a Research Station for 0 actions.',
    unlockCondition: null,
    startingCity: 'atlanta',
  },
  {
    id: 'quarantine_specialist',
    name: 'Quarantine Specialist',
    color: '#16a085',
    description: 'Prevents cube placement in your current city and all adjacent cities each turn.',
    unlockCondition: { type: 'win', difficulty: 4 },
    startingCity: 'atlanta',
  },
  {
    id: 'operations_expert',
    name: 'Operations Expert',
    color: '#e67e22',
    description: 'Build a Research Station without discarding a card.',
    unlockCondition: { type: 'win', difficulty: 5 },
    startingCity: 'atlanta',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    color: '#c0392b',
    description: 'Start each run with 1 extra card and a free Vaccine Cache in your deck.',
    unlockCondition: { type: 'win', difficulty: 5 },
    startingCity: 'atlanta',
  },
  {
    id: 'contingency_planner',
    name: 'Contingency Planner',
    color: '#f39c12',
    description: 'Once per run, retrieve 1 event card from the player discard pile.',
    unlockCondition: { type: 'win', difficulty: 6 },
    startingCity: 'atlanta',
  },
];

const ROLE_MAP = {};
for (const role of ROLES) ROLE_MAP[role.id] = role;

function isRoleUnlocked(roleId, meta) {
  const role = ROLE_MAP[roleId];
  if (!role) return false;
  if (!role.unlockCondition) return true;
  return meta.unlockedRoles.includes(roleId);
}

function getUnlockedRoles(meta) {
  return ROLES.filter(r => isRoleUnlocked(r.id, meta));
}

function checkRoleUnlocks(meta) {
  const newUnlocks = [];
  for (const role of ROLES) {
    if (meta.unlockedRoles.includes(role.id)) continue;
    if (!role.unlockCondition) continue;
    const cond = role.unlockCondition;
    if (cond.type === 'win' && meta.wins > 0) {
      // unlock if player has ever won at sufficient difficulty
      if ((meta.bestDifficultyWon || 0) >= cond.difficulty) {
        meta.unlockedRoles.push(role.id);
        newUnlocks.push(role);
      }
    }
  }
  return newUnlocks;
}
