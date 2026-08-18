import { apiDelete, apiGet, apiPost, apiPut } from './api.js';

const championshipId = localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId = localStorage.getItem('ligaControlDisciplineId') || '';
const matchList = document.querySelector('#result-match-list');
const roundSelect = document.querySelector('#result-round');
const standingsBody = document.querySelector('#standings-body');
const modal = document.querySelector('#match-sheet-modal');
const scoreForm = document.querySelector('#final-score-form');
const notesForm = document.querySelector('#minute-notes-form');
const quickPlayerModal = document.querySelector('#quick-player-modal');
const quickPlayerForm = document.querySelector('#quick-player-form');
let teams = [], matches = [], players = [], events = [], minutes = [], sanctions = [], payments = [], currentDiscipline = null, activeMatch, lineupDraft = { home: [], away: [] };

const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const teamName = id => teams.find(team => team.id === id)?.name || 'Equipo';
const normalizeDni = value => String(value || '').replace(/\D/g, '');
const isVolley = () => /v[oó]ley|volley/i.test(currentDiscipline?.name || '');
const playerRosterLabel = player => {
  const shirtNumber = String(player?.shirtNumber ?? '').trim();
  return shirtNumber ? `${shirtNumber} - ${player.fullName}` : player.fullName;
};

function matchWinnerId(match) {
  if (match.homeScore === '' || match.awayScore === '') return '';
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (homeScore === awayScore) return '';
  return homeScore > awayScore ? match.homeId : match.awayId;
}

function volleyMatchCard(match) {
  const winnerId = matchWinnerId(match);
  const locked = Boolean(match.roundLocked);
  const winnerLabel = winnerId ? `Ganador: ${teamName(winnerId)}` : 'Pendiente de ganador';
  return `<article class="result-match-card volleyball-result-card${locked ? ' finished' : ''}" data-match-id="${match.id}"><div class="result-team"><strong>${esc(teamName(match.homeId))}</strong><span>Equipo A</span></div><span class="versus-badge">VS</span><div class="result-team away"><strong>${esc(teamName(match.awayId))}</strong><span>Equipo B</span></div><div class="volley-winner-control"><label class="field volley-winner-field"><span>Ganador del partido</span><select data-volley-winner="${match.id}" ${locked ? 'disabled' : ''}><option value="">Seleccionar ganador</option><option value="${match.homeId}"${winnerId === match.homeId ? ' selected' : ''}>${esc(teamName(match.homeId))}</option><option value="${match.awayId}"${winnerId === match.awayId ? ' selected' : ''}>${esc(teamName(match.awayId))}</option></select></label><button class="action-button compact-button" type="button" data-save-volley-winner="${match.id}" ${locked ? 'disabled' : ''}>Guardar ganador</button><span class="volley-winner-status ${winnerId ? 'success-message' : ''}">${esc(winnerLabel)}</span></div><small class="result-schedule">${match.date ? String(match.date).slice(0, 10) : 'Sin fecha'} · ${match.time || 'Sin hora'} · ${esc(match.venue || 'Sin escenario')}</small></article>`;
}

function duplicatePlayerByDni(dni) {
  const normalizedDni = normalizeDni(dni);
  if (!normalizedDni) return null;
  return players.find(player => player.status !== 'INACTIVE' && normalizeDni(player.dni) === normalizedDni);
}

function duplicatePlayerMessage(player, requestedTeamId) {
  const registeredTeamName = teamName(player.teamId);
  if (String(player.teamId) === String(requestedTeamId)) {
    return `Este DNI ya esta registrado en este mismo equipo: ${registeredTeamName}.`;
  }
  return `Este DNI ya esta registrado en el equipo ${registeredTeamName}.`;
}

function renderMatches() {
  const round = Number(roundSelect.value);
  const items = matches.filter(match => match.round === round).sort((a, b) => a.order - b.order);
  if (isVolley()) {
    matchList.innerHTML = items.length ? items.map(volleyMatchCard).join('') : '<div class="empty-state"><strong>No hay partidos en esta fecha</strong></div>';
    updateRoundControls();
    return;
  }
  matchList.innerHTML = items.length ? items.map(match => `<button class="result-match-card clickable-match${match.roundLocked ? ' finished' : ''}" type="button" data-match-id="${match.id}"><div class="result-team"><strong>${esc(teamName(match.homeId))}</strong><span>Local</span></div><span class="result-score">${match.homeScore === '' ? '–' : match.homeScore}</span><span class="score-separator">–</span><span class="result-score">${match.awayScore === '' ? '–' : match.awayScore}</span><div class="result-team away"><strong>${esc(teamName(match.awayId))}</strong><span>Visitante</span></div><span class="manage-label">${match.isWalkover ? 'W.O. · ' : ''}${match.roundLocked ? 'Consultar acta' : 'Abrir acta'} →</span><small class="result-schedule">${match.date ? String(match.date).slice(0, 10) : 'Sin fecha'} · ${match.time || 'Sin hora'} · ${esc(match.venue || 'Sin escenario')}</small></button>`).join('') : '<div class="empty-state"><strong>No hay partidos en esta fecha</strong></div>';
  updateRoundControls();
}

async function saveVolleyWinner(matchId, winnerId, button) {
  const match = matches.find(item => item.id === matchId);
  if (!match || !winnerId) return;
  const status = button.closest('.volleyball-result-card')?.querySelector('.volley-winner-status');
  button.disabled = true;
  if (status) {
    status.textContent = 'Guardando ganador...';
    status.className = 'volley-winner-status';
  }
  try {
    const response = await apiPut('/api/matches', {
      id: match.id,
      homeScore: winnerId === match.homeId ? 1 : 0,
      awayScore: winnerId === match.awayId ? 1 : 0,
      closed: false,
      walkoverTeamId: ''
    });
    matches = matches.map(item => item.id === response.data.id ? response.data : item);
    renderMatches();
    renderStandings();
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.className = 'volley-winner-status error-message';
    }
    button.disabled = false;
  }
}

function updateRoundControls() {
  const round = Number(roundSelect.value);
  const roundMatches = matches.filter(match => match.round === round);
  const locked = roundMatches.length > 0 && roundMatches.every(match => match.roundLocked);
  const button = document.querySelector('#lock-result-round');
  const unlockButton = document.querySelector('#unlock-result-round');
  button.disabled = locked || !roundMatches.length;
  button.textContent = locked ? `Fecha ${round} cerrada` : `Cerrar Fecha ${round}`;
  unlockButton.hidden = !locked;
  unlockButton.disabled = !locked;
  const status = document.querySelector('#round-lock-status');
  status.className = 'form-status';
  status.textContent = locked ? 'Resultados oficiales: esta fecha ya no se puede editar.' : '';
}

function standings() {
  const table = Object.fromEntries(teams.map(team => [team.id, { team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
  matches.filter(match => match.closed || match.status === 'FINISHED').forEach(match => {
    const home = table[match.homeId], away = table[match.awayId];
    if (!home || !away) return;
    const homeScore = Number(match.homeScore), awayScore = Number(match.awayScore);
    home.pj++; away.pj++; home.gf += homeScore; home.gc += awayScore; away.gf += awayScore; away.gc += homeScore;
    if (homeScore > awayScore) { home.pg++; home.pts += 3; away.pp++; }
    else if (awayScore > homeScore) { away.pg++; away.pts += 3; home.pp++; }
    else { home.pe++; away.pe++; home.pts++; away.pts++; }
  });
  return Object.values(table).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || b.pg - a.pg || a.gc - b.gc);
}

function renderStandings() {
  const rows = standings();
  standingsBody.innerHTML = rows.map((item, index) => `<tr class="${rows.length > 8 && index === 7 ? 'classification-cutoff-row' : ''}"><td><strong>${index + 1}</strong></td><td>${esc(item.team.name)}</td><td>${item.pj}</td><td>${item.pg}</td><td>${item.pe}</td><td>${item.pp}</td><td>${item.gf}</td><td>${item.gc}</td><td>${item.gf - item.gc}</td><td><strong>${item.pts}</strong></td></tr>`).join('');
}

function renderSanctions() {
  const body = document.querySelector('#sanctions-body');
  const paymentFor = sanctionId => payments.find(payment => payment.sanctionId === sanctionId);
  const suspensionText = sanction => {
    const matches = Number(sanction.suspensionMatches || 0);
    if (!matches) return 'Sin suspensión';
    const reason = sanction.reason && sanction.reason !== 'Tarjeta amarilla'
      ? sanction.reason
      : sanction.type === 'YELLOW_CARD'
        ? 'Acumulación de tarjetas amarillas'
        : sanction.type === 'RED_CARD'
          ? 'Tarjeta roja directa'
          : 'Expulsión';
    return `<strong>${matches} fecha${matches === 1 ? '' : 's'}</strong><small>${esc(reason)}</small>`;
  };
  body.innerHTML = sanctions.length ? sanctions.map(sanction => {
    const player = players.find(item => item.id === sanction.playerId);
    const payment = paymentFor(sanction.id);
    const paid = payment?.status === 'PAID';
    const label = sanction.type === 'YELLOW_CARD' ? '🟨 Amarilla' : sanction.type === 'RED_CARD' ? '🟥 Roja directa' : '⛔ Expulsión';
    return `<tr><td><strong>${esc(player?.fullName || 'Jugador')}</strong></td><td>${esc(teamName(sanction.teamId))}</td><td>${label}</td><td class="suspension-cell">${suspensionText(sanction)}</td><td><strong>S/ ${Number(sanction.amount).toFixed(2)}</strong></td><td><span class="badge ${paid ? 'paid-badge' : 'pending-badge'}">${paid ? 'Pagado' : 'Pendiente'}</span></td><td>${payment && !paid ? `<button class="secondary-button compact-button" type="button" data-mark-paid="${payment.id}">Marcar pagado</button>` : ''}</td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty-state">No hay sanciones registradas.</td></tr>';
  const pending = payments.filter(payment => payment.status === 'PENDING').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  document.querySelector('#pending-total').textContent = `S/ ${pending.toFixed(2)}`;
}

async function refreshSanctions() {
  const [sanctionResponse, paymentResponse] = await Promise.all([apiGet('/api/sanctions', { championshipId }), apiGet('/api/payments', { championshipId })]);
  const activePlayerIds = new Set(players.filter(player => player.status !== 'INACTIVE').map(player => player.id));
  sanctions = (sanctionResponse.data.items || []).filter(sanction => activePlayerIds.has(sanction.playerId));
  const sanctionIds = new Set(sanctions.map(sanction => sanction.id));
  payments = (paymentResponse.data.items || []).filter(payment => sanctionIds.has(payment.sanctionId));
  renderSanctions();
}

function activeRoster(teamId) {
  return players.filter(player => player.teamId === teamId && player.status !== 'INACTIVE');
}

function updateWalkoverScorer() {
  const absentTeamId = document.querySelector('#walkover-team').value;
  const scorerSelect = document.querySelector('#walkover-scorer');
  const preview = document.querySelector('#walkover-preview');
  if (!activeMatch || !absentTeamId) {
    scorerSelect.innerHTML = '<option value="">Primero selecciona el equipo ausente</option>';
    scorerSelect.disabled = true;
    preview.innerHTML = '<small>Vista previa</small><strong>Selecciona al equipo ausente</strong>';
    return;
  }
  const winnerTeamId = absentTeamId === activeMatch.homeId ? activeMatch.awayId : activeMatch.homeId;
  const roster = activeRoster(winnerTeamId);
  scorerSelect.innerHTML = `<option value="">Seleccionar jugador de ${esc(teamName(winnerTeamId))}</option>${roster.map(player => `<option value="${player.id}">${esc(playerRosterLabel(player))}</option>`).join('')}`;
  scorerSelect.disabled = roster.length === 0;
  if (!roster.length) scorerSelect.innerHTML = '<option value="">El equipo ganador no tiene jugadores registrados</option>';
  preview.innerHTML = `<small>Vista previa</small><strong>${esc(teamName(winnerTeamId))} <span>3–0</span> ${esc(teamName(absentTeamId))}</strong><p>No se presentó: ${esc(teamName(absentTeamId))}</p>`;
}

function matchEvents() {
  return events.filter(event => event.matchId === activeMatch.id && event.status !== 'INACTIVE');
}

function eventCount(playerId, type) {
  return matchEvents().filter(event => event.playerId === playerId && event.type === type).length;
}

function lineupSide(teamId) { return teamId === activeMatch.homeId ? 'home' : 'away'; }
function lineupCount(teamId, role) { return lineupDraft[lineupSide(teamId)].filter(item => item.role === role).length; }
function normalizeDraft(items) {
  const counters = { TITULAR: 0, SUPLENTE: 0 };
  return (items || []).map(item => ({ ...item, slot: Number(item.slot) || ++counters[item.role] }));
}
function selectedAt(teamId, role, slot) {
  return lineupDraft[lineupSide(teamId)].find(item => item.role === role && Number(item.slot) === slot)?.playerId || '';
}
function playerOptions(teamId, currentId) {
  const selectedIds = new Set(lineupDraft[lineupSide(teamId)].map(item => item.playerId));
  return `<option value="">Seleccionar jugador</option>${activeRoster(teamId).map(player => `<option value="${player.id}"${player.id === currentId ? ' selected' : ''}${selectedIds.has(player.id) && player.id !== currentId ? ' disabled' : ''}>${esc(playerRosterLabel(player))}</option>`).join('')}`;
}

function quickButton(player, teamId, type, cssClass, label) {
  const count = eventCount(player.id, type);
  return `<div class="quick-event-control ${cssClass}"><button type="button" data-remove-event="${type}" data-team-id="${teamId}" data-player-id="${player.id}" title="Quitar ${label}" ${count === 0 ? 'disabled' : ''}>−</button><span>${count}</span><button type="button" data-quick-event="${type}" data-team-id="${teamId}" data-player-id="${player.id}" title="Registrar ${label}">+</button></div>`;
}

function renderRosters() {
  document.querySelector('#match-rosters').innerHTML = [activeMatch.homeId, activeMatch.awayId].map(teamId => {
    const roster = activeRoster(teamId);
    const rows = [['TITULAR', 6, 'Titular'], ['SUPLENTE', 4, 'Suplente']].flatMap(([role, count, label]) => Array.from({ length: count }, (_, index) => {
      const slot = index + 1;
      const playerId = selectedAt(teamId, role, slot);
      const player = roster.find(item => item.id === playerId);
      const shirtLabel = player && player.shirtNumber !== '' ? `${player.shirtNumber}` : `${role === 'TITULAR' ? 'T' : 'S'}${slot}`;
      return `<tr class="lineup-slot-row ${role === 'TITULAR' ? 'starter-row' : 'substitute-row'}"><td class="slot-label"><span>${shirtLabel}</span><small>${label}</small></td><td><select class="player-slot-select" data-lineup-role="${role}" data-lineup-slot="${slot}" data-lineup-team="${teamId}" aria-label="${label} ${slot}">${playerOptions(teamId, playerId)}</select></td><td>${player ? quickButton(player, teamId, 'GOAL', 'goal-event', 'gol') : '—'}</td><td>${player ? quickButton(player, teamId, 'YELLOW_CARD', 'yellow-card', 'tarjeta amarilla') : '—'}</td><td>${player ? quickButton(player, teamId, 'RED_CARD', 'red-card', 'tarjeta roja') : '—'}</td></tr>`;
    })).join('');
    const content = roster.length ? `<table class="acta-roster-table lineup-table"><thead><tr><th>N.º</th><th>Jugador</th><th>Gol</th><th title="Tarjeta amarilla">T.A.</th><th title="Tarjeta roja">T.R.</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty-roster"><strong>Sin jugadores registrados</strong><p>Agrega el primer jugador sin salir del acta.</p></div>`;
    return `<section class="sheet-team"><div class="sheet-team-heading"><h3>${esc(teamName(teamId))}</h3><div class="sheet-team-tools"><span>${lineupCount(teamId, 'TITULAR')}/6 · ${lineupCount(teamId, 'SUPLENTE')}/4</span><button class="secondary-button compact-button" type="button" data-add-player="${teamId}">+ Nuevo jugador</button></div></div>${content}</section>`;
  }).join('');
}

function openQuickPlayer(teamId) {
  quickPlayerForm.reset();
  quickPlayerForm.elements.teamId.value = teamId;
  document.querySelector('#quick-player-team').textContent = `Se agregará al plantel de ${teamName(teamId)}.`;
  document.querySelector('#quick-player-status').textContent = '';
  quickPlayerModal.showModal();
  setTimeout(() => quickPlayerForm.elements.fullName.focus(), 0);
}

function closeQuickPlayer() {
  if (!quickPlayerForm.querySelector('button[type="submit"]').disabled) quickPlayerModal.close();
}

function openSheet(match) {
  activeMatch = match;
  const savedMinute = minutes.find(item => item.matchId === match.id);
  lineupDraft = { home: normalizeDraft(savedMinute?.homeLineup), away: normalizeDraft(savedMinute?.awayLineup) };
  document.querySelector('#match-sheet-title').textContent = `${teamName(match.homeId)} vs. ${teamName(match.awayId)}`;
  document.querySelector('#match-sheet-schedule').textContent = `${match.date ? String(match.date).slice(0, 10) : 'Sin fecha'} · ${match.time || 'Sin hora'} · ${match.venue || 'Sin escenario'}`;
  renderRosters();
  notesForm.elements.observations.value = minutes.find(item => item.matchId === match.id)?.observations || '';
  document.querySelector('#event-status').textContent = '';
  document.querySelector('#minute-notes-status').textContent = '';
  document.querySelector('#lineup-status').textContent = '';
  document.querySelector('#score-home-name').textContent = teamName(match.homeId);
  document.querySelector('#score-away-name').textContent = teamName(match.awayId);
  scoreForm.elements.homeScore.value = match.homeScore;
  scoreForm.elements.awayScore.value = match.awayScore;
  document.querySelector('#walkover-team').innerHTML = `<option value="">Seleccionar equipo</option><option value="${match.homeId}">${esc(teamName(match.homeId))}</option><option value="${match.awayId}">${esc(teamName(match.awayId))}</option>`;
  document.querySelector('#walkover-team').value = match.walkoverTeamId || '';
  updateWalkoverScorer();
  document.querySelector('#walkover-box').open = Boolean(match.isWalkover);
  document.querySelector('#walkover-status').textContent = match.isWalkover ? `Resultado cerrado por walkover. No se presentó ${teamName(match.walkoverTeamId)}.` : '';
  document.querySelector('#final-score-status').textContent = '';
  modal.querySelectorAll('input, select, textarea, button').forEach(control => { if (control.id !== 'close-match-sheet') control.disabled = Boolean(match.roundLocked); });
  if (!match.roundLocked) document.querySelectorAll('[data-remove-event]').forEach(button => { button.disabled = eventCount(button.dataset.playerId, button.dataset.removeEvent) === 0; });
  if (match.roundLocked) document.querySelector('#final-score-status').textContent = 'Fecha cerrada: acta disponible solo para consulta.';
  modal.showModal();
}

async function load() {
  try {
    if (!championshipId || !disciplineId) throw new Error('No hay un campeonato o deporte seleccionado. Regresa al resumen y entra nuevamente al deporte.');
    matchList.innerHTML = '<p class="muted">Cargando resultados…</p>';
    const response = await apiGet('/api/results-bootstrap', { championshipId, disciplineId });
    const data = response.data || {};
    const championship = (data.championships || []).find(item => item.id === championshipId);
    const discipline = (data.disciplines || []).find(item => item.id === disciplineId);
    currentDiscipline = discipline || null;
    teams = data.teams || [];
    matches = data.matches || [];
    players = data.players || [];
    events = data.events || [];
    const activePlayerIds = new Set(players.filter(player => player.status !== 'INACTIVE').map(player => player.id));
    sanctions = (data.sanctions || []).filter(sanction => activePlayerIds.has(sanction.playerId));
    const sanctionIds = new Set(sanctions.map(sanction => sanction.id));
    payments = (data.payments || []).filter(payment => sanctionIds.has(payment.sanctionId));
    minutes = data.minutes || [];
    document.querySelector('#sidebar-championship').textContent = championship?.shortName || championship?.name || 'Campeonato';
    document.querySelector('#results-context').textContent = `${championship?.name || ''} · ${discipline?.name || ''}`;
    const rounds = [...new Set(matches.map(item => item.round))].sort((a, b) => a - b);
    roundSelect.innerHTML = rounds.map(round => `<option value="${round}">Fecha ${round}</option>`).join('');
    renderMatches(); renderStandings(); renderSanctions();
  } catch (error) {
    matchList.innerHTML = `<p class="error-message">${esc(error.message)}</p>`;
    document.querySelector('#round-lock-status').textContent = 'No se pudieron cargar los datos.';
    document.querySelector('#lock-result-round').disabled = true;
  }
}

matchList.addEventListener('click', event => {
  const volleyButton = event.target.closest('[data-save-volley-winner]');
  if (volleyButton) {
    const card = volleyButton.closest('[data-match-id]');
    const winnerSelect = card?.querySelector('[data-volley-winner]');
    if (!winnerSelect?.value) {
      const status = card?.querySelector('.volley-winner-status');
      if (status) {
        status.textContent = 'Selecciona el ganador antes de guardar.';
        status.className = 'volley-winner-status error-message';
      }
      return;
    }
    saveVolleyWinner(volleyButton.dataset.saveVolleyWinner, winnerSelect.value, volleyButton);
    return;
  }
  if (isVolley()) return;
  const card = event.target.closest('[data-match-id]');
  if (card) openSheet(matches.find(match => match.id === card.dataset.matchId));
});
document.querySelector('#match-rosters').addEventListener('change', event => {
  const select = event.target.closest('[data-lineup-slot]');
  if (!select) return;
  const side = lineupSide(select.dataset.lineupTeam);
  const role = select.dataset.lineupRole;
  const slot = Number(select.dataset.lineupSlot);
  lineupDraft[side] = lineupDraft[side].filter(item => !(item.role === role && Number(item.slot) === slot));
  if (select.value) lineupDraft[side].push({ playerId: select.value, role, slot });
  document.querySelector('#lineup-status').textContent = 'Hay cambios de alineación sin guardar.';
  document.querySelector('#lineup-status').className = 'form-status';
  renderRosters();
});
document.querySelector('#match-rosters').addEventListener('click', async event => {
  const addPlayerButton = event.target.closest('[data-add-player]');
  if (addPlayerButton) {
    openQuickPlayer(addPlayerButton.dataset.addPlayer);
    return;
  }
  const registerButton = event.target.closest('[data-register-team]');
  if (registerButton) {
    localStorage.setItem('ligaControlTeamId', registerButton.dataset.registerTeam);
    location.href = 'equipo.html';
    return;
  }
  const button = event.target.closest('[data-quick-event]');
  const removeButton = event.target.closest('[data-remove-event]');
  if (removeButton) {
    const removable = [...matchEvents()].reverse().find(item => item.playerId === removeButton.dataset.playerId && item.type === removeButton.dataset.removeEvent);
    if (!removable) return;
    removeButton.disabled = true;
    document.querySelector('#event-status').textContent = '';
    try {
      await apiDelete('/api/events', { id: removable.id });
      events = events.filter(item => item.id !== removable.id);
      if (removeButton.dataset.removeEvent === 'GOAL') {
        const scoreField = removeButton.dataset.teamId === activeMatch.homeId ? scoreForm.elements.homeScore : scoreForm.elements.awayScore;
        scoreField.value = Math.max(0, Number(scoreField.value || 0) - 1);
        scoreField.classList.remove('score-updated');
        void scoreField.offsetWidth;
        scoreField.classList.add('score-updated');
      }
      renderRosters();
      await refreshSanctions();
    } catch (error) {
      document.querySelector('#event-status').textContent = error.message;
      removeButton.disabled = false;
    }
    return;
  }
  if (!button) return;
  button.disabled = true;
  document.querySelector('#event-status').textContent = '';
  try {
    const response = await apiPost('/api/events', { matchId: activeMatch.id, teamId: button.dataset.teamId, playerId: button.dataset.playerId, type: button.dataset.quickEvent, minute: '' });
    events.push(response.data);
    if (button.dataset.quickEvent === 'GOAL') {
      const scoreField = button.dataset.teamId === activeMatch.homeId ? scoreForm.elements.homeScore : scoreForm.elements.awayScore;
      scoreField.value = Number(scoreField.value || 0) + 1;
      scoreField.classList.remove('score-updated');
      void scoreField.offsetWidth;
      scoreField.classList.add('score-updated');
    }
    renderRosters();
    await refreshSanctions();
  } catch (error) {
    document.querySelector('#event-status').textContent = error.message;
    button.disabled = false;
  }
});
quickPlayerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = quickPlayerForm.querySelector('button[type="submit"]');
  const status = document.querySelector('#quick-player-status');
  const values = Object.fromEntries(new FormData(quickPlayerForm));
  const duplicatePlayer = duplicatePlayerByDni(values.dni);
  if (duplicatePlayer) {
    status.textContent = duplicatePlayerMessage(duplicatePlayer, values.teamId);
    status.className = 'form-status error-message';
    return;
  }
  button.disabled = true;
  status.textContent = 'Registrando jugador...';
  status.className = 'form-status';
  try {
    const response = await apiPost('/api/players', {
      teamId: values.teamId,
      dni: values.dni,
      fullName: values.fullName,
      shirtNumber: values.shirtNumber,
      position: values.position,
      birthDate: values.birthDate
    });
    players.push(response.data);
    quickPlayerModal.close();
    renderRosters();
    updateWalkoverScorer();
    document.querySelector('#lineup-status').textContent = `${response.data.fullName} fue agregado a ${teamName(values.teamId)}. Ya puedes seleccionarlo.`;
    document.querySelector('#lineup-status').className = 'form-status success-message';
  } catch (error) {
    status.textContent = error.message;
    status.className = 'form-status error-message';
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#close-quick-player').addEventListener('click', closeQuickPlayer);
document.querySelector('#cancel-quick-player').addEventListener('click', closeQuickPlayer);
quickPlayerModal.addEventListener('click', event => { if (event.target === quickPlayerModal) closeQuickPlayer(); });
notesForm.addEventListener('submit', event => event.preventDefault());
scoreForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = scoreForm.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(scoreForm));
  button.disabled = true;
  try {
    const [minuteResponse, matchResponse] = await Promise.all([
      apiPost('/api/minutes', { matchId: activeMatch.id, observations: notesForm.elements.observations.value, homeLineup: lineupDraft.home, awayLineup: lineupDraft.away }),
      apiPut('/api/matches', { id: activeMatch.id, homeScore: Number(values.homeScore), awayScore: Number(values.awayScore), closed: false, walkoverTeamId: '' })
    ]);
    minutes = minutes.filter(item => item.matchId !== activeMatch.id);
    minutes.push(minuteResponse.data);
    activeMatch = matchResponse.data;
    matches = matches.map(match => match.id === activeMatch.id ? activeMatch : match);
    modal.close(); renderMatches(); renderStandings();
  } catch (error) {
    document.querySelector('#final-score-status').textContent = error.message;
  } finally { button.disabled = false; }
});
document.querySelector('#apply-walkover').addEventListener('click', async event => {
  const absentTeamId = document.querySelector('#walkover-team').value;
  const scorerId = document.querySelector('#walkover-scorer').value;
  const status = document.querySelector('#walkover-status');
  if (!absentTeamId) { status.textContent = 'Selecciona el equipo que no se presentó.'; return; }
  if (!scorerId) { status.textContent = 'Selecciona al jugador que recibirá los 3 goles del walkover.'; return; }
  const winnerTeamId = absentTeamId === activeMatch.homeId ? activeMatch.awayId : activeMatch.homeId;
  const scorer = players.find(player => player.id === scorerId);
  if (!confirm(`¿Confirmas el walkover? ${teamName(winnerTeamId)} ganará 3–0 y los 3 goles se asignarán a ${scorer?.fullName || 'el jugador seleccionado'}.`)) return;
  const button = event.currentTarget;
  button.disabled = true;
  status.textContent = 'Aplicando walkover...';
  const createdGoalIds = [];
  try {
    for (let goal = 0; goal < 3; goal += 1) {
      const goalResponse = await apiPost('/api/events', { matchId: activeMatch.id, teamId: winnerTeamId, playerId: scorerId, type: 'GOAL', minute: '', detail: 'Gol asignado por walkover' });
      events.push(goalResponse.data);
      createdGoalIds.push(goalResponse.data.id);
    }
    const response = await apiPut('/api/matches', { id: activeMatch.id, walkoverTeamId: absentTeamId });
    activeMatch = response.data;
    matches = matches.map(match => match.id === activeMatch.id ? activeMatch : match);
    scoreForm.elements.homeScore.value = activeMatch.homeScore;
    scoreForm.elements.awayScore.value = activeMatch.awayScore;
    status.textContent = `Walkover aplicado: 3–0. Los 3 goles fueron asignados a ${scorer?.fullName || 'el jugador seleccionado'}.`;
    renderRosters();
    renderMatches(); renderStandings();
  } catch (error) {
    await Promise.allSettled(createdGoalIds.map(id => apiDelete('/api/events', { id })));
    events = events.filter(item => !createdGoalIds.includes(item.id));
    renderRosters();
    status.textContent = `${error.message} No se aplicó el walkover.`;
  }
  finally { button.disabled = false; }
});
document.querySelector('#walkover-team').addEventListener('change', () => {
  updateWalkoverScorer();
  document.querySelector('#walkover-status').textContent = '';
});
document.querySelector('#close-match-sheet').addEventListener('click', () => modal.close());
roundSelect.addEventListener('change', renderMatches);
document.querySelector('#lock-result-round').addEventListener('click', async event => {
  const round = Number(roundSelect.value);
  const roundMatches = matches.filter(match => match.round === round);
  if (!roundMatches.length) return;
  if (!confirm(`¿Confirmas el cierre de la Fecha ${round}? Después ya no se podrán editar sus actas ni resultados.`)) return;
  const button = event.currentTarget;
  button.disabled = true;
  document.querySelector('#round-lock-status').textContent = 'Cerrando fecha...';
  try {
    await apiPut('/api/matches', { id: roundMatches[0].id, lockRound: true });
    await load();
  } catch (error) {
    document.querySelector('#round-lock-status').textContent = error.message;
    button.disabled = false;
  }
});
document.querySelector('#unlock-result-round').addEventListener('click', async event => {
  const round = Number(roundSelect.value);
  const roundMatches = matches.filter(match => match.round === round);
  if (!roundMatches.length) return;
  if (!confirm(`¿Reabrir la Fecha ${round} para corregir el acta? Después de corregir debes volver a cerrar la fecha.`)) return;
  const button = event.currentTarget;
  button.disabled = true;
  document.querySelector('#round-lock-status').textContent = 'Reabriendo fecha para corrección...';
  try {
    await apiPut('/api/matches', { id: roundMatches[0].id, unlockRound: true });
    await load();
    document.querySelector('#round-lock-status').textContent = `Fecha ${round} reabierta. Corrige el acta y vuelve a cerrar la fecha.`;
    document.querySelector('#round-lock-status').className = 'form-status success-message';
  } catch (error) {
    document.querySelector('#round-lock-status').textContent = error.message;
    document.querySelector('#round-lock-status').className = 'form-status error-message';
    button.disabled = false;
  }
});
document.querySelectorAll('[data-results-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-results-view]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#matches-view').hidden = button.dataset.resultsView !== 'matches';
  document.querySelector('#standings-view').hidden = button.dataset.resultsView !== 'standings';
  document.querySelector('#sanctions-view').hidden = button.dataset.resultsView !== 'sanctions';
  renderStandings();
}));
document.querySelector('#reload-results').addEventListener('click', load);
document.querySelector('#sanctions-body').addEventListener('click', async event => {
  const button = event.target.closest('[data-mark-paid]');
  if (!button) return;
  button.disabled = true;
  try {
    const response = await apiPut('/api/payments', { id: button.dataset.markPaid, paid: true });
    payments = payments.map(payment => payment.id === response.data.id ? response.data : payment);
    renderSanctions();
  } catch (error) { alert(error.message); button.disabled = false; }
});
document.querySelector('#recalculate-sanctions').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Recalculando...';
  try {
    await apiPost('/api/sanctions', { championshipId });
    await refreshSanctions();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; button.textContent = 'Recalcular'; }
});
load();
