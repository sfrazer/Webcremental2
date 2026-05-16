// ─── UI State ─────────────────────────────────────────────────────────────────

let _actionMode = null;

// Pan / zoom state
let _zoom = { x: 0, y: 0, scale: 1 };
let _dragging = false;
let _dragStart = { x: 0, y: 0 };
let _dragDist = 0;   // px moved since mousedown; used to distinguish click vs drag
let _wasDragging = false;
let _animating = false;

const WRAP_THRESHOLD = 400; // px x-gap beyond which a connection renders as dashed/wrapped
// 'drive' | 'direct_flight' | 'charter_flight' | 'shuttle' | 'treat' | 'cure' | 'airlift'
// | 'government_grant' | 'resilient_pop' | 'field_hospital' | 'emergency_protocol'
// | 'quarantine_seal' | 'contingency_retrieve'

let _pendingCardHandIdx = null;  // index in run.hand for multi-step card plays
let _cureSelectedCards = [];     // cityIds selected for cure

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadGame();
  if (!gameState.meta) gameState.meta = deepClone(DEFAULT_META);

  _bindFooter();
  _bindOptions();
  _initMapPanZoom();

  if (gameState.run && gameState.run.active) {
    _showGame();
    renderMap();
    updateUI();
  } else {
    _showSetup();
  }
}

// ─── Screen management ────────────────────────────────────────────────────────

function _showSetup() {
  document.getElementById('screen-setup').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('hidden');
  renderRoleSelect();
  updateFooterMeta();
}

function _showGame() {
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  _closeAllModals();
}

// ─── Role Selection ───────────────────────────────────────────────────────────

function renderRoleSelect() {
  const container = document.getElementById('role-grid');
  container.innerHTML = '';
  const unlocked = getUnlockedRoles(gameState.meta);

  for (const role of ROLES) {
    const isUnlocked = unlocked.some(r => r.id === role.id);
    const div = document.createElement('div');
    div.className = 'role-card' + (isUnlocked ? '' : ' locked');
    div.style.setProperty('--role-color', role.color);
    div.innerHTML = `
      <div class="role-name">${role.name}</div>
      <div class="role-desc">${isUnlocked ? role.description : 'Win more runs to unlock.'}</div>
    `;
    if (isUnlocked) {
      div.addEventListener('click', () => {
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
        div.classList.add('selected');
        div.dataset.roleId = role.id;
      });
      div.dataset.roleId = role.id;
    }
    container.appendChild(div);
  }

  // Difficulty selector
  const diffSel = document.getElementById('difficulty-select');
  diffSel.value = String(gameState.meta.lastDifficulty || 4);

  // Start button
  document.getElementById('btn-start-run').onclick = () => {
    const selected = document.querySelector('.role-card.selected');
    if (!selected) { _toast('Select a role first.'); return; }
    const roleId = selected.dataset.roleId;
    const difficulty = parseInt(diffSel.value);
    gameState.meta.lastDifficulty = difficulty;
    startRun(roleId, difficulty, gameState.meta);
    saveGame();
    _showGame();
    renderMap();
    updateUI();
  };

  // Meta shop button
  document.getElementById('btn-meta-shop').onclick = () => renderMetaShop();
}

// ─── Map ──────────────────────────────────────────────────────────────────────

const MAP_W = 900, MAP_H = 500;
const CITY_R = 14;
const COLOR_HEX = { blue: '#4a90d9', yellow: '#f1c40f', black: '#888', red: '#e74c3c' };
const CUBE_COLORS = { blue: '#4a90d9', yellow: '#e0b800', black: '#aaa', red: '#e74c3c' };

function renderMap() {
  const svg = document.getElementById('map-svg');

  // Keep the map-group so the pan/zoom transform is preserved across re-renders.
  let group = document.getElementById('map-group');
  if (!group) {
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'map-group');
    svg.appendChild(group);
    _applyMapTransform();
  }
  group.innerHTML = '';

  const run = gameState.run;
  const highlightSet = _getHighlightCities();

  // Draw connection lines first
  const drawn = new Set();
  for (const city of CITIES) {
    for (const neighborId of city.connections) {
      const key = [city.id, neighborId].sort().join('|');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const nb = CITY_MAP[neighborId];
      const isWrap = Math.abs(city.x - nb.x) > WRAP_THRESHOLD;

      if (isWrap) {
        // Render as two edge-stubs with arrow nubs to signal the wrap.
        // Left city gets a stub going toward x=0; right city gets a stub toward x=MAP_W.
        const left  = city.x < nb.x ? city : nb;
        const right = city.x < nb.x ? nb  : city;
        const midY  = (left.y + right.y) / 2;
        for (const [cx, cy, edgeX] of [[left.x, left.y, 0], [right.x, right.y, MAP_W]]) {
          const stubX = edgeX === 0 ? cx - 28 : cx + 28;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', cx); line.setAttribute('y1', cy);
          line.setAttribute('x2', stubX); line.setAttribute('y2', cy);
          line.setAttribute('class', 'map-connection wrap-connection');
          group.appendChild(line);
        }
      } else {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', city.x); line.setAttribute('y1', city.y);
        line.setAttribute('x2', nb.x);   line.setAttribute('y2', nb.y);
        line.setAttribute('class', 'map-connection');
        group.appendChild(line);
      }
    }
  }

  // Draw cities
  for (const city of CITIES) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'map-city');
    g.setAttribute('data-city', city.id);

    const isHighlighted = highlightSet.has(city.id);
    const isPriority = run && run.priorityCity === city.id;
    const isPlayer = run && run.playerCity === city.id;

    // City circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', city.x); circle.setAttribute('cy', city.y);
    circle.setAttribute('r', CITY_R);
    circle.setAttribute('fill', COLOR_HEX[city.color]);
    circle.setAttribute('class', 'city-circle' +
      (isHighlighted ? ' highlighted' : '') +
      (isPriority ? ' priority' : ''));
    g.appendChild(circle);

    // Research station marker
    if (run && run.cities[city.id]?.station) {
      const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      sq.setAttribute('x', city.x - 6); sq.setAttribute('y', city.y - 22);
      sq.setAttribute('width', 12); sq.setAttribute('height', 8);
      sq.setAttribute('fill', 'white'); sq.setAttribute('rx', 1);
      g.appendChild(sq);
    }

    // Player pawn
    if (isPlayer) {
      const pawn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pawn.setAttribute('cx', city.x); pawn.setAttribute('cy', city.y);
      pawn.setAttribute('r', 6);
      const roleColor = run ? (ROLE_MAP[run.role]?.color || '#fff') : '#fff';
      pawn.setAttribute('fill', roleColor);
      pawn.setAttribute('class', 'player-pawn');
      g.appendChild(pawn);
    }

    // City name
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', city.x); label.setAttribute('y', city.y + CITY_R + 11);
    label.setAttribute('class', 'city-label');
    label.textContent = city.name;
    g.appendChild(label);

    // Disease cube dots
    if (run) {
      const cubes = run.cities[city.id]?.cubes || {};
      let dotX = city.x - 18;
      for (const [color, count] of Object.entries(cubes)) {
        for (let i = 0; i < count; i++) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', dotX); dot.setAttribute('cy', city.y - CITY_R - 5);
          dot.setAttribute('r', 4);
          dot.setAttribute('fill', CUBE_COLORS[color]);
          dot.setAttribute('class', 'cube-dot');
          g.appendChild(dot);
          dotX += 10;
        }
      }
    }

    g.addEventListener('click', () => _onCityClick(city.id));
    group.appendChild(g);
  }
}

// ─── Pan / zoom ───────────────────────────────────────────────────────────────

function _initMapPanZoom() {
  const svg = document.getElementById('map-svg');
  svg.style.cursor = 'grab';

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    _zoom.x = mx - (mx - _zoom.x) * factor;
    _zoom.y = my - (my - _zoom.y) * factor;
    _zoom.scale = Math.max(0.4, Math.min(5, _zoom.scale * factor));
    _applyMapTransform();
  }, { passive: false });

  svg.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    _dragging = true;
    _dragDist = 0;
    _dragStart = { x: e.clientX - _zoom.x, y: e.clientY - _zoom.y };
    svg.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!_dragging) return;
    const dx = e.clientX - (_dragStart.x + _zoom.x);
    const dy = e.clientY - (_dragStart.y + _zoom.y);
    _dragDist += Math.sqrt(dx * dx + dy * dy);
    _zoom.x = e.clientX - _dragStart.x;
    _zoom.y = e.clientY - _dragStart.y;
    _applyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!_dragging) return;
    _wasDragging = _dragDist > 5;
    _dragging = false;
    document.getElementById('map-svg').style.cursor = 'grab';
    // Clear wasDragging after click event fires
    setTimeout(() => { _wasDragging = false; }, 0);
  });
}

function _applyMapTransform() {
  const group = document.getElementById('map-group');
  if (group) group.setAttribute('transform',
    `translate(${_zoom.x.toFixed(2)}, ${_zoom.y.toFixed(2)}) scale(${_zoom.scale.toFixed(4)})`);
}

// ─── City animations ──────────────────────────────────────────────────────────

function _animateCity(cityId, cssClass) {
  const el = document.querySelector(`[data-city="${cityId}"] .city-circle`);
  if (!el) return;
  el.classList.remove(cssClass);
  // Force reflow so re-adding the class restarts the animation
  void el.offsetWidth;
  el.classList.add(cssClass);
  setTimeout(() => el.classList.remove(cssClass), 700);
}

function _showEpidemicAlert(cityId) {
  return new Promise(resolve => {
    const el = document.getElementById('epidemic-alert');
    const sub = document.getElementById('epidemic-city');
    if (sub) sub.textContent = cityId ? CITY_MAP[cityId]?.name || '' : '';
    el.classList.remove('hidden');
    if (cityId) _animateCity(cityId, 'outbreaking');
    setTimeout(() => {
      el.classList.add('hidden');
      resolve();
    }, 1800);
  });
}

function _getHighlightCities() {
  const run = gameState.run;
  if (!run) return new Set();
  const s = new Set();
  if (!_actionMode) return s;

  if (_actionMode === 'drive') {
    for (const n of CITY_MAP[run.playerCity].connections) s.add(n);
  } else if (_actionMode === 'charter_flight' || _actionMode === 'airlift') {
    for (const city of CITIES) s.add(city.id);
    s.delete(run.playerCity);
  } else if (_actionMode === 'direct_flight') {
    for (const c of run.hand) {
      if (c.type === CARD_TYPE.CITY && c.cityId !== run.playerCity) s.add(c.cityId);
    }
  } else if (_actionMode === 'shuttle') {
    for (const [cid, cs] of Object.entries(run.cities)) {
      if (cs.station && cid !== run.playerCity) s.add(cid);
    }
  } else if (_actionMode === 'dispatcher_free') {
    for (const [cid, cs] of Object.entries(run.cities)) {
      if (cs.station) s.add(cid);
    }
  } else if (_actionMode === 'government_grant' || _actionMode === 'field_hospital') {
    for (const city of CITIES) {
      if (!run.cities[city.id].station) s.add(city.id);
    }
  } else if (_actionMode === 'resilient_pop' || _actionMode === 'quarantine_seal') {
    // handled by UI panel, not map
  }
  return s;
}

// ─── City click handler ───────────────────────────────────────────────────────

function _onCityClick(cityId) {
  if (_wasDragging) return;
  const run = gameState.run;
  if (!run || run.phase !== 'action') return;

  if (_actionMode === 'drive') {
    if (tryDriveToCity(cityId)) _clearActionMode();
  } else if (_actionMode === 'direct_flight') {
    if (tryDirectFlight(cityId)) _clearActionMode();
  } else if (_actionMode === 'charter_flight') {
    if (tryCharterFlight(cityId)) _clearActionMode();
  } else if (_actionMode === 'shuttle') {
    if (tryShuttleFlight(cityId)) _clearActionMode();
  } else if (_actionMode === 'dispatcher_free') {
    if (tryDispatcherFreeMove(cityId)) _clearActionMode();
  } else if (_actionMode === 'government_grant') {
    run.cities[cityId].station = true;
    appendLog(`Government Grant: Research Station built in ${CITY_MAP[cityId].name}.`);
    saveGame();
    _clearActionMode();
  } else if (_actionMode === 'field_hospital') {
    run.cities[cityId].station = true;
    appendLog(`Field Hospital: Research Station built in ${CITY_MAP[cityId].name}.`);
    saveGame();
    _clearActionMode();
  } else if (_actionMode === 'airlift') {
    run.playerCity = cityId;
    appendLog(`Airlift to ${CITY_MAP[cityId].name}.`);
    _medicAutoTreat(cityId);
    saveGame();
    _clearActionMode();
  } else {
    // No mode: clicking current city shows treat options
    if (cityId === run.playerCity) _showTreatMenu();
  }

  renderMap();
  updateUI();
  _checkGameOver();
}

// ─── Action panel ─────────────────────────────────────────────────────────────

function updateActions() {
  const run = gameState.run;
  const panel = document.getElementById('actions-panel');
  if (!run || run.phase !== 'action') {
    panel.innerHTML = '';
    return;
  }

  const city = run.cities[run.playerCity];
  const canFly = run.flightBannedTurns === 0;
  const hasCurrentCityCard = run.hand.some(c => c.type === CARD_TYPE.CITY && c.cityId === run.playerCity);
  const hasFlight = run.hand.some(c => c.type === CARD_TYPE.CITY);
  const hasStation = run.cities[run.playerCity].station;
  const anyCubes = Object.values(city.cubes).some(v => v > 0);

  // Count curable cards by color
  const colorCounts = {};
  for (const c of run.hand) {
    if (c.type === CARD_TYPE.CITY) {
      const col = CITY_MAP[c.cityId].color;
      colorCounts[col] = (colorCounts[col] || 0) + 1;
    }
  }
  const needed = getCuresNeeded(run.role);
  const canCure = hasStation && Object.entries(colorCounts).some(([col, cnt]) => !run.cures[col] && cnt >= needed);

  const actions = [
    { id: 'drive',      label: 'Drive / Ferry',      enabled: true },
    { id: 'direct',     label: 'Direct Flight',      enabled: canFly && hasFlight },
    { id: 'charter',    label: 'Charter Flight',     enabled: canFly && hasCurrentCityCard },
    { id: 'shuttle',    label: 'Shuttle Flight',     enabled: canFly && hasStation && Object.values(run.cities).some((cs, _) => {
        return Object.keys(run.cities).some(cid => run.cities[cid].station && cid !== run.playerCity);
      }) },
    { id: 'build',      label: 'Build Station',      enabled: !city.station && (run.role === 'operations_expert' || hasCurrentCityCard) },
    { id: 'treat',      label: 'Treat Disease',      enabled: anyCubes },
    { id: 'cure',       label: 'Discover Cure',      enabled: canCure },
    { id: 'end_phase',  label: `End Turn  (${run.actionsLeft} left)`, enabled: !_animating, special: true },
  ];

  if (run.role === 'dispatcher' && !run.dispatcherUsedFreeMove) {
    actions.unshift({ id: 'dispatcher_free', label: 'Free Station Move', enabled: true });
  }
  if (run.role === 'contingency_planner' && !run.contingencyCard) {
    actions.push({ id: 'contingency', label: 'Retrieve Event Card', enabled: run.playerDiscard.some(c => c.type === CARD_TYPE.EVENT || c.type === CARD_TYPE.SPECIAL) });
  }

  panel.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'action-btn' + (a.special ? ' end-btn' : '');
    btn.textContent = a.label;
    btn.disabled = !a.enabled || run.actionsLeft <= 0 && a.id !== 'end_phase';
    btn.addEventListener('click', () => _onActionClick(a.id));
    panel.appendChild(btn);
  }
}

function _onActionClick(actionId) {
  const run = gameState.run;
  if (!run) return;

  if (actionId === 'end_phase') {
    endActionPhase();
    _doDrawThenInfect();
    return;
  }

  _clearActionMode();

  switch (actionId) {
    case 'drive':            _actionMode = 'drive'; break;
    case 'direct':           _actionMode = 'direct_flight'; break;
    case 'charter':          _actionMode = 'charter_flight'; break;
    case 'shuttle':          _actionMode = 'shuttle'; break;
    case 'build':            if (tryBuildStation()) { _clearActionMode(); } break;
    case 'treat':            _showTreatMenu(); return;
    case 'cure':             _showCureMenu(); return;
    case 'dispatcher_free':  _actionMode = 'dispatcher_free'; break;
    case 'contingency':      _showContingencyMenu(); return;
  }

  renderMap();
  updateUI();
}

function _showTreatMenu() {
  const run = gameState.run;
  const city = run.cities[run.playerCity];
  const colors = Object.entries(city.cubes).filter(([, v]) => v > 0);
  if (colors.length === 1) {
    tryTreatDisease(colors[0][0]);
    renderMap();
    updateUI();
    _checkGameOver();
  } else if (colors.length > 1) {
    _showColorPicker('Treat Disease', colors.map(([c]) => c), (color) => {
      tryTreatDisease(color);
      renderMap();
      updateUI();
      _checkGameOver();
    });
  }
}

function _showCureMenu() {
  const run = gameState.run;
  const needed = getCuresNeeded(run.role);
  const colorGroups = {};
  run.hand.forEach((c, i) => {
    if (c.type === CARD_TYPE.CITY) {
      const col = CITY_MAP[c.cityId].color;
      if (!run.cures[col]) {
        if (!colorGroups[col]) colorGroups[col] = [];
        colorGroups[col].push({ card: c, idx: i });
      }
    }
  });
  const eligible = Object.entries(colorGroups).filter(([, cards]) => cards.length >= needed);
  if (eligible.length === 0) return;

  if (eligible.length === 1) {
    const [color, cards] = eligible[0];
    const ids = cards.slice(0, needed).map(({ card }) => card.cityId);
    if (tryDiscoverCure(color, ids)) { renderMap(); updateUI(); _checkGameOver(); }
  } else {
    _showColorPicker('Discover Cure', eligible.map(([c]) => c), (color) => {
      const cards = colorGroups[color].slice(0, needed).map(({ card }) => card.cityId);
      if (tryDiscoverCure(color, cards)) { renderMap(); updateUI(); _checkGameOver(); }
    });
  }
}

function _showContingencyMenu() {
  const run = gameState.run;
  const eventCards = run.playerDiscard
    .map((c, i) => ({ card: c, idx: i }))
    .filter(({ card }) => card.type === CARD_TYPE.EVENT || card.type === CARD_TYPE.SPECIAL);
  if (eventCards.length === 0) return;

  const modal = document.getElementById('modal-generic');
  const body = document.getElementById('modal-generic-body');
  body.innerHTML = '<h3>Retrieve Event Card</h3>';
  for (const { card, idx } of eventCards) {
    const btn = document.createElement('button');
    btn.className = 'modal-list-btn';
    btn.textContent = card.name + ' — ' + card.description;
    btn.addEventListener('click', () => {
      tryContingencyRetrieve(idx);
      _closeAllModals();
      updateUI();
    });
    body.appendChild(btn);
  }
  modal.classList.remove('hidden');
}

// ─── Draw + Infect automation ─────────────────────────────────────────────────

async function _doDrawThenInfect() {
  if (_animating) return;
  _animating = true;

  const drawEvents = doDrawPhase();

  // Show epidemic alert for each epidemic drawn (rare: usually 1 per turn max)
  const epidemics = drawEvents.filter(e => e.type === 'epidemic');
  if (epidemics.length > 0) {
    renderMap();
    updateFooter();
    for (const ev of epidemics) {
      await _showEpidemicAlert(ev.cityId);
    }
  }

  if (checkLoseCondition()) { _animating = false; _showGameOver(false); return; }
  if (checkWinCondition())  { _animating = false; _showGameOver(true);  return; }

  // Run infect phase (state updates happen synchronously)
  const infectEvents = doInfectPhase();

  // Render updated cube counts, then animate each affected city
  renderMap();
  updateFooter();

  for (const ev of infectEvents) {
    if (ev.type === 'infection') _animateCity(ev.cityId, 'infecting');
    if (ev.type === 'outbreak')  _animateCity(ev.cityId, 'outbreaking');
    if (ev.type === 'challenge') _toast(ev.card.name + '!', 'danger');
  }

  // Wait for animations to finish before checking game over
  if (infectEvents.some(e => e.type === 'outbreak' || e.type === 'infection')) {
    await new Promise(r => setTimeout(r, 750));
  }

  if (checkLoseCondition()) { _animating = false; _showGameOver(false); return; }
  if (checkWinCondition())  { _animating = false; _showGameOver(true);  return; }

  _animating = false;
  renderMap();
  updateUI();
}

function _checkGameOver() {
  if (checkLoseCondition()) { _showGameOver(false); return; }
  if (checkWinCondition()) { _showGameOver(true); return; }
}

// ─── Hand ─────────────────────────────────────────────────────────────────────

function updateHand() {
  const run = gameState.run;
  const container = document.getElementById('hand-area');
  container.innerHTML = '';
  if (!run) return;

  const allCards = [...run.hand];
  if (run.contingencyCard) allCards.push({ ...run.contingencyCard, _isContingency: true });

  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i];
    const div = document.createElement('div');
    div.className = 'hand-card';

    if (card.type === CARD_TYPE.CITY) {
      div.classList.add('city-card');
      div.style.setProperty('--card-color', COLOR_HEX[CITY_MAP[card.cityId].color]);
      div.innerHTML = `<span class="card-name">${CITY_MAP[card.cityId].name}</span>
        <span class="card-color-tag">${CITY_MAP[card.cityId].color}</span>`;
    } else if (card.type === CARD_TYPE.EVENT || card.type === CARD_TYPE.SPECIAL) {
      div.classList.add('event-card');
      if (card._isContingency) div.classList.add('contingency-card');
      div.innerHTML = `<span class="card-name">${card.name}</span>
        <span class="card-desc">${card.description}</span>`;
      div.addEventListener('click', () => _onEventCardClick(i, card));
    }

    container.appendChild(div);
  }
}

function _onEventCardClick(handIdx, card) {
  const run = gameState.run;
  if (!run || run.phase !== 'action') return;

  if (card._isContingency) {
    const played = tryPlayContingencyCard();
    if (played) _resolvePlayedCard(played);
    return;
  }

  const played = tryPlayCard(handIdx);
  if (played) _resolvePlayedCard(played);
}

function _resolvePlayedCard(card) {
  if (card.id === 'government_grant') {
    _actionMode = 'government_grant';
    renderMap();
    updateUI();
    return;
  }
  if (card.id === 'airlift') {
    _actionMode = 'airlift';
    renderMap();
    updateUI();
    return;
  }
  if (card.id === 'resilient_population') {
    _showResilientPopMenu();
    return;
  }
  if (card.id === 'field_hospital') {
    _actionMode = 'field_hospital';
    renderMap();
    updateUI();
    return;
  }
  if (card.id === 'quarantine_seal') {
    _showQuarantineSealMenu();
    return;
  }
  if (card.id === 'vaccine_cache') {
    _showVaccineCacheMenu();
    return;
  }
  if (card.id === 'emergency_protocol') {
    gameState.run.actionsLeft += 2;
    appendLog('Emergency Protocol: +2 actions this turn.');
    saveGame();
  }
  renderMap();
  updateUI();
  _checkGameOver();
}

function _showResilientPopMenu() {
  const run = gameState.run;
  const modal = document.getElementById('modal-generic');
  const body = document.getElementById('modal-generic-body');
  body.innerHTML = '<h3>Resilient Population — Remove 1 Infection Card</h3>';
  const infectionCards = run.infectionDiscard.filter(c => c.type === CARD_TYPE.INFECTION);
  if (infectionCards.length === 0) { body.innerHTML += '<p>No cards in infection discard.</p>'; }
  infectionCards.forEach((card, idx) => {
    const btn = document.createElement('button');
    btn.className = 'modal-list-btn';
    btn.textContent = CITY_MAP[card.cityId].name;
    btn.addEventListener('click', () => {
      run.infectionDiscard.splice(run.infectionDiscard.indexOf(card), 1);
      appendLog(`Resilient Population: removed ${CITY_MAP[card.cityId].name} from infection discard.`);
      saveGame();
      _closeAllModals();
      updateUI();
    });
    body.appendChild(btn);
  });
  modal.classList.remove('hidden');
}

function _showVaccineCacheMenu() {
  const run = gameState.run;
  const city = run.cities[run.playerCity];
  const colors = Object.entries(city.cubes).filter(([, v]) => v > 0).map(([c]) => c);
  if (colors.length === 0) { _toast('No cubes to treat here.'); return; }
  _showColorPicker('Vaccine Cache — Treat All Cubes', colors, (color) => {
    const removed = city.cubes[color];
    run.cubeSupply[color] += removed;
    city.cubes[color] = 0;
    appendLog(`Vaccine Cache: treated all ${removed} ${color} cubes in ${CITY_MAP[run.playerCity].name}.`);
    checkEradication(color);
    saveGame();
    renderMap();
    updateUI();
    _checkGameOver();
  });
}

function _showQuarantineSealMenu() {
  const run = gameState.run;
  _showColorPicker('Quarantine Seal — Protect City',
    CITIES.map(c => c.id),
    (cityId) => {
      run.quarantineSealCity = cityId;
      appendLog(`Quarantine Seal: ${CITY_MAP[cityId].name} protected this round.`);
      saveGame();
      updateUI();
    },
    true /* cities mode */);
}

// ─── Color picker modal ───────────────────────────────────────────────────────

function _showColorPicker(title, options, callback, citiesMode) {
  const modal = document.getElementById('modal-generic');
  const body = document.getElementById('modal-generic-body');
  body.innerHTML = `<h3>${title}</h3>`;
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'modal-list-btn';
    if (citiesMode) {
      btn.textContent = CITY_MAP[opt]?.name || opt;
      btn.style.borderColor = COLOR_HEX[CITY_MAP[opt]?.color] || '';
    } else {
      btn.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      btn.style.borderColor = COLOR_HEX[opt] || CUBE_COLORS[opt] || '';
    }
    btn.addEventListener('click', () => {
      _closeAllModals();
      callback(opt);
    });
    body.appendChild(btn);
  }
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-list-btn cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', _closeAllModals);
  body.appendChild(cancelBtn);
  modal.classList.remove('hidden');
}

// ─── Event log ────────────────────────────────────────────────────────────────

function updateLog() {
  const run = gameState.run;
  const el = document.getElementById('event-log');
  if (!run) { el.innerHTML = ''; return; }
  const entries = run.log.slice(-14);
  el.innerHTML = entries.map(e => `<div class="log-entry">${e}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

// ─── Footer stats ─────────────────────────────────────────────────────────────

function updateFooter() {
  const run = gameState.run;
  if (!run) { updateFooterMeta(); return; }

  const curedCount = Object.values(run.cures).filter(Boolean).length;
  const eradCount = Object.values(run.eradicated).filter(Boolean).length;

  const setEl = (id, val, warn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    el.classList.toggle('warn', !!warn);
  };

  setEl('stat-cures', `${curedCount}/${run.curesRequired}`);
  setEl('stat-eradicated', eradCount);
  setEl('stat-cube-blue',   run.cubeSupply.blue,   run.cubeSupply.blue <= 4);
  setEl('stat-cube-yellow', run.cubeSupply.yellow, run.cubeSupply.yellow <= 4);
  setEl('stat-cube-black',  run.cubeSupply.black,  run.cubeSupply.black <= 4);
  setEl('stat-cube-red',    run.cubeSupply.red,    run.cubeSupply.red <= 4);
  setEl('stat-deck',        run.playerDeck.length, run.playerDeck.length <= 5);
  setEl('stat-outbreaks',   `${run.outbreaks}/8`,  run.outbreaks >= 6);
  setEl('stat-rate',        getInfectionRate(run.infectionRateIdx));
  setEl('stat-turn',        run.turn);
  setEl('stat-phase',       run.phase === 'action' ? `Action (${run.actionsLeft} left)` : run.phase);
  setEl('stat-rp',          gameState.meta.researchPoints);
}

function updateFooterMeta() {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-rp', gameState.meta.researchPoints);
  setEl('stat-cures', '—');
  setEl('stat-eradicated', '—');
  setEl('stat-cube-blue', '—');
  setEl('stat-cube-yellow', '—');
  setEl('stat-cube-black', '—');
  setEl('stat-cube-red', '—');
  setEl('stat-deck', '—');
  setEl('stat-outbreaks', '—');
  setEl('stat-rate', '—');
  setEl('stat-turn', '—');
  setEl('stat-phase', 'No active run');
}

// ─── Meta shop ────────────────────────────────────────────────────────────────

function renderMetaShop() {
  const modal = document.getElementById('modal-meta-shop');
  const body = document.getElementById('meta-shop-body');
  body.innerHTML = `<h2>Meta Shop <span class="rp-display">${gameState.meta.researchPoints} RP</span></h2>`;

  // Starting bonuses
  const section1 = document.createElement('div');
  section1.innerHTML = '<h3>Starting Bonuses</h3>';
  for (const item of getPrestigeShopItems()) {
    const owned = gameState.meta.purchasedUpgrades.filter(id => id === item.id).length;
    const canBuy = gameState.meta.researchPoints >= item.cost &&
      (item.stackable ? owned < item.maxStack : owned === 0);
    const div = _shopItemEl(item.name, item.cost, item.description,
      owned > 0 ? (item.stackable ? `×${owned}` : '✓') : '',
      canBuy, () => {
        tryBuyPrestigeUpgrade(item.id);
        renderMetaShop();
      });
    section1.appendChild(div);
  }
  body.appendChild(section1);

  // Player deck cards
  const section2 = document.createElement('div');
  section2.innerHTML = '<h3>Player Deck Cards</h3>';
  for (const card of SPECIAL_PLAYER_CARDS) {
    const owned = gameState.meta.playerDeckAdditions[card.id] || 0;
    const costs = { vaccine_cache: 3, field_hospital: 4, emergency_protocol: 5, quarantine_seal: 4, supply_drop: 3 };
    const cost = costs[card.id] || 5;
    const canBuy = gameState.meta.researchPoints >= cost && owned < 2;
    const div = _shopItemEl(card.name, cost, card.description,
      owned > 0 ? `×${owned}` : '', canBuy, () => {
        tryBuyPlayerCard(card.id);
        renderMetaShop();
      });
    section2.appendChild(div);
  }
  body.appendChild(section2);

  // Infection deck challenges
  const section3 = document.createElement('div');
  section3.innerHTML = '<h3>Challenge Modifiers (earn bonus RP per run)</h3>';
  for (const card of CHALLENGE_INFECTION_CARDS) {
    const owned = gameState.meta.infectionDeckAdditions[card.id] || 0;
    const rpBonus = { hotspot: 1, cascade_event: 2, virulent_strain: 3, travel_ban: 1 }[card.id];
    const canBuy = owned < 2;
    const div = _shopItemEl(card.name, 0, card.description + ` (+${rpBonus} RP/run)`,
      owned > 0 ? `×${owned}` : '', canBuy, () => {
        tryBuyInfectionCard(card.id);
        renderMetaShop();
      });
    section3.appendChild(div);
  }
  body.appendChild(section3);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.textContent = '✕ Close Shop';
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    _showSetup();
  });
  body.appendChild(closeBtn);

  modal.classList.remove('hidden');
}

function _shopItemEl(name, cost, desc, badge, canBuy, onBuy) {
  const div = document.createElement('div');
  div.className = 'shop-item';
  div.innerHTML = `
    <div class="shop-item-info">
      <span class="shop-item-name">${name}</span>
      ${badge ? `<span class="shop-badge">${badge}</span>` : ''}
      <span class="shop-item-desc">${desc}</span>
    </div>
    <button class="shop-buy-btn" ${canBuy ? '' : 'disabled'}>${cost > 0 ? cost + ' RP' : 'Free'}</button>
  `;
  div.querySelector('.shop-buy-btn').addEventListener('click', onBuy);
  return div;
}

// ─── Options modal ────────────────────────────────────────────────────────────

function _bindOptions() {
  document.getElementById('btn-options').addEventListener('click', () => {
    const modal = document.getElementById('modal-options');
    modal.classList.toggle('hidden');
  });
  document.getElementById('btn-export').addEventListener('click', exportSave);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importSave);
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      resetGame();
      _closeAllModals();
      _showSetup();
      updateFooterMeta();
    }
  });
}

function exportSave() {
  try {
    const blob = new Blob([JSON.stringify(gameState)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `outbreak_protocol_${Date.now()}.json`;
    a.click();
  } catch (e) {
    _toast('Export failed.', 'danger');
  }
}

function importSave() {
  const file = document.getElementById('import-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.version) throw new Error('Invalid save file.');
      gameState.version = parsed.version;
      gameState.meta = deepMerge(deepClone(DEFAULT_META), parsed.meta || {});
      gameState.run = parsed.run || null;
      saveGame();
      _closeAllModals();
      if (gameState.run && gameState.run.active) {
        _showGame();
        renderMap();
        updateUI();
      } else {
        _showSetup();
      }
      _toast('Save imported!');
    } catch (err) {
      _toast('Invalid save file.', 'danger');
    }
  };
  reader.readAsText(file);
}

// ─── Win / Lose screen ────────────────────────────────────────────────────────

function _showGameOver(won) {
  const run = gameState.run;
  const rpEarned = endRun(won);
  saveGame();

  const modal = document.getElementById('modal-game-over');
  document.getElementById('game-over-title').textContent = won ? '🏆 Victory!' : '☠ Defeat';
  document.getElementById('game-over-title').className = won ? 'victory' : 'defeat';
  document.getElementById('game-over-reason').textContent = won
    ? `You cured ${Object.values(run.cures).filter(Boolean).length} diseases!`
    : run.loseReason || 'The outbreak could not be contained.';
  document.getElementById('game-over-rp').textContent = `+${rpEarned} Research Points earned`;

  document.getElementById('btn-play-again').onclick = () => {
    _closeAllModals();
    _showSetup();
  };
  document.getElementById('btn-game-over-shop').onclick = () => {
    _closeAllModals();
    renderMetaShop();
  };

  modal.classList.remove('hidden');
}

// ─── Footer bindings ──────────────────────────────────────────────────────────

function _bindFooter() {
  // nothing extra for now; options handled in _bindOptions
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function _closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  _clearActionMode();
}

function _clearActionMode() {
  _actionMode = null;
  _pendingCardHandIdx = null;
  _cureSelectedCards = [];
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function _toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ` toast-${type}` : '');
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── Master UI update ─────────────────────────────────────────────────────────

function updateUI() {
  updateActions();
  updateHand();
  updateLog();
  updateFooter();
}

// ─── Start ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', init);
