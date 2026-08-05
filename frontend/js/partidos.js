import { apiGet, apiPost, apiPut } from './api.js';

const championshipId = localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId = localStorage.getItem('ligaControlDisciplineId') || '';
const builder = document.querySelector('#fixture-builder');
const preview = document.querySelector('#fixture-preview');
const status = document.querySelector('#fixture-status');
const methodSelect = document.querySelector('#fixture-method');
const manualCheckbox = document.querySelector('#manual-first-round');
const externalOrder = document.querySelector('#external-order');
const manualRound = document.querySelector('#manual-round');
const tabs = document.querySelector('#round-tabs');
const content = document.querySelector('#round-content');
const scheduleModal = document.querySelector('#schedule-modal');
const scheduleForm = document.querySelector('#schedule-form');
const scheduleStatus = document.querySelector('#schedule-status');
let championship; let discipline; let teams = []; let rounds = []; let activeRound = 1;
let fixtureSaved = false;
let showingGeneral = false;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function teamOptions(blankLabel = 'Selecciona') { return `<option value="">${blankLabel}</option>${teams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`).join('')}`; }

function renderExternalOrder() {
  externalOrder.hidden = methodSelect.value !== 'external';
  if (externalOrder.hidden) return;
  externalOrder.innerHTML = `<h3>Números del sorteo</h3><div class="draw-number-grid">${teams.map((team, index) => `<label class="field"><span>${escapeHtml(team.name)}</span><input type="number" min="1" max="${teams.length}" value="${index + 1}" data-draw-team="${team.id}"></label>`).join('')}</div>`;
}

function renderManualRound() {
  manualRound.hidden = !manualCheckbox.checked;
  if (manualRound.hidden) return;
  const matchCount = Math.floor(teams.length / 2);
  manualRound.innerHTML = `<h3>Primera fecha fija</h3><p class="muted">Registra los partidos en el mismo orden del sorteo.</p><div class="manual-match-list">${Array.from({ length: matchCount }, (_, index) => `<div class="manual-match-row"><strong>${index + 1}.°</strong><select data-manual-home="${index}">${teamOptions('Equipo A')}</select><span>vs.</span><select data-manual-away="${index}">${teamOptions('Equipo B')}</select></div>`).join('')}</div>${teams.length % 2 ? `<label class="field bye-select"><span>Equipo que descansa</span><select id="manual-bye">${teamOptions('Selecciona')}</select></label>` : ''}`;
  refreshManualOptions();
}

function refreshManualOptions() {
  const selects = [...manualRound.querySelectorAll('select')];
  const selectedValues = selects.map((select) => select.value).filter(Boolean);
  selects.forEach((select) => {
    [...select.options].forEach((option) => {
      if (!option.value) return;
      const usedElsewhere = selectedValues.includes(option.value) && select.value !== option.value;
      option.disabled = usedElsewhere;
      option.hidden = usedElsewhere;
    });
  });
}

function orderedTeams() {
  let result = [...teams];
  if (methodSelect.value === 'random') {
    for (let i = result.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  }
  if (methodSelect.value === 'external') {
    const entries = [...externalOrder.querySelectorAll('[data-draw-team]')].map((input) => ({ id: input.dataset.drawTeam, number: Number(input.value) }));
    if (new Set(entries.map((item) => item.number)).size !== teams.length || entries.some((item) => item.number < 1 || item.number > teams.length)) throw new Error('Los números del sorteo deben ser únicos y consecutivos.');
    result = entries.sort((a, b) => a.number - b.number).map((entry) => teams.find((team) => team.id === entry.id));
  }
  return result;
}

function manualSeed() {
  const homes = [...manualRound.querySelectorAll('[data-manual-home]')].map((select) => select.value);
  const aways = [...manualRound.querySelectorAll('[data-manual-away]')].map((select) => select.value);
  const bye = document.querySelector('#manual-bye')?.value || null;
  const ids = [...homes, ...aways, ...(bye ? [bye] : [])];
  if (ids.some((id) => !id) || new Set(ids).size !== teams.length) throw new Error('Todos los equipos deben aparecer una sola vez en la primera fecha.');
  return [...homes, ...(bye ? [bye] : []), ...(bye ? [null] : []), ...aways.slice().reverse()];
}

function generateRounds(seedTeams) {
  let rotation = seedTeams.map((item) => item?.id || item);
  if (rotation.length % 2) rotation.push(null);
  const generated = [];
  for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
    const matches = []; let byeTeamId = '';
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const first = rotation[index]; const second = rotation[rotation.length - 1 - index];
      if (!first || !second) { byeTeamId = first || second; continue; }
      const reverse = (roundIndex + index) % 2 === 1;
      matches.push({ homeId: reverse ? second : first, awayId: reverse ? first : second, order: matches.length + 1 });
    }
    generated.push({ number: roundIndex + 1, matches, byeTeamId });
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  return generated;
}

function teamName(id) { return teams.find((team) => team.id === id)?.name || 'Equipo'; }
function displayDate(value) { if (!value) return 'Fecha pendiente'; const date = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).format(date); }
function displayTime(value) { if (!value) return 'Hora pendiente'; const text = String(value); const iso = text.match(/T(\d{2}):(\d{2})/); return iso ? `${iso[1]}:${iso[2]}` : text.slice(0, 5); }
function addMinutes(time, minutes) { const [hour, minute] = time.split(':').map(Number); const total = hour * 60 + minute + minutes; return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function roundTimes(round) { const start = scheduleForm.elements.startTime.value; const interval = 40; return start ? round.matches.map((_, index) => addMinutes(start, interval * index)) : []; }
function renderSchedulePreview() { const round = rounds.find((item) => item.number === activeRound); const times = roundTimes(round); document.querySelector('#schedule-times-preview').innerHTML = times.length ? round.matches.map((match, index) => `<div><strong>${index + 1}. ${times[index]}</strong><span>${escapeHtml(teamName(match.homeId))} vs. ${escapeHtml(teamName(match.awayId))}</span></div>`).join('') : ''; }
function openScheduleModal() { const round = rounds.find((item) => item.number === activeRound); document.querySelector('#schedule-title').textContent = `Programar Fecha ${round.number}`; scheduleForm.elements.date.value = round.matches[0]?.date ? String(round.matches[0].date).slice(0, 10) : ''; scheduleForm.elements.startTime.value = round.matches[0]?.time ? displayTime(round.matches[0].time) : '08:00'; scheduleForm.elements.venue.value = round.matches[0]?.venue || ''; scheduleStatus.textContent = ''; renderSchedulePreview(); scheduleModal.showModal(); }
function closeScheduleModal() { if (!scheduleForm.querySelector('button[type="submit"]').disabled) scheduleModal.close(); }
function calculatePoints() {
  const points = Object.fromEntries(teams.map((team) => [team.id, 0]));
  rounds.flatMap((round) => round.matches).filter((match) => match.closed || match.status === 'FINISHED').forEach((match) => {
    const home = Number(match.homeScore); const away = Number(match.awayScore);
    if (home > away) points[match.homeId] += 3;
    else if (away > home) points[match.awayId] += 3;
    else { points[match.homeId] += 1; points[match.awayId] += 1; }
  });
  return points;
}
function roundCompleted(round) { return round.matches.length > 0 && round.matches.every((match) => match.closed || match.status === 'FINISHED' || match.roundLocked); }
function nextPendingRoundNumber() { return rounds.find((round) => !roundCompleted(round))?.number; }
function roundHasOfficialOrder(round) { return roundCompleted(round) || (round.number === nextPendingRoundNumber() && round.matches.every((match) => match.orderConfirmed)); }
function renderTabs() { tabs.innerHTML = rounds.map((round) => `<button class="round-tab${round.number === activeRound ? ' active' : ''}" data-round="${round.number}" type="button">Fecha ${round.number}</button>`).join(''); }
function renderRound() {
  showingGeneral = false;
  const round = rounds.find((item) => item.number === activeRound);
  const firstMatch = round.matches[0];
  const confirmed = round.matches.length && round.matches.every((match) => match.orderConfirmed);
  const canManageOrder = round.number === nextPendingRoundNumber();
  const showOrder = roundHasOfficialOrder(round);
  const points = calculatePoints();
  renderTabs();
  const orderControls = showOrder && confirmed
    ? '<span class="confirmed-order">✓ Orden confirmado</span>'
    : canManageOrder
      ? `<button class="secondary-button" type="button" data-suggest-order>Orden sugerido por puntos</button>${fixtureSaved ? '<button class="action-button" type="button" data-confirm-order>Confirmar orden</button>' : ''}`
      : '<span class="pending-order-label">Disponible después de cerrar la fecha anterior</span>';
  content.innerHTML = `<div class="round-heading"><div><h3>Fecha ${round.number}</h3><span>${round.matches.length} partidos</span><div class="print-round-details"><strong>${escapeHtml(firstMatch?.date ? displayDate(firstMatch.date) : 'Fecha pendiente')}</strong><span>${escapeHtml(firstMatch?.venue || 'Escenario pendiente')}</span></div></div><div class="button-group">${fixtureSaved && showOrder ? '<button class="secondary-button" type="button" data-schedule-round>Programar fecha</button>' : ''}${orderControls}</div></div><div class="fixture-match-list">${round.matches.map((match, index) => `<article class="fixture-match${showOrder ? '' : ' order-pending'}">${showOrder ? `<span class="match-order">${index + 1}.°</span>` : ''}<div class="match-teams"><strong>${escapeHtml(teamName(match.homeId))}</strong><span class="versus-badge">VS</span><strong>${escapeHtml(teamName(match.awayId))}</strong></div><div class="match-metadata"><span class="match-date">🗓 ${escapeHtml(displayDate(match.date))}</span><span class="match-time">🕐 ${escapeHtml(displayTime(match.time))}</span><span class="match-venue">📍 ${escapeHtml(match.venue || 'Escenario pendiente')}</span><span class="points-badge">${(points[match.homeId] || 0) + (points[match.awayId] || 0)} pts.</span></div>${canManageOrder && !confirmed ? `<div class="order-actions"><button type="button" data-move="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-index="${index}" ${index === round.matches.length - 1 ? 'disabled' : ''}>↓</button></div>` : ''}</article>`).join('')}</div>${round.byeTeamId ? `<div class="bye-card">Descansa: <strong>${escapeHtml(teamName(round.byeTeamId))}</strong></div>` : ''}`;
  document.querySelector('#print-fixture').textContent = `Imprimir Fecha ${round.number}`;
}

function matchScheduleText(match) {
  const parts = [];
  if (match.date) parts.push(displayDate(match.date));
  if (match.time) parts.push(displayTime(match.time));
  if (match.venue) parts.push(match.venue);
  return parts.join(' · ');
}

function renderGeneral() {
  showingGeneral = true;
  tabs.querySelectorAll('.round-tab').forEach((tab) => tab.classList.remove('active'));
  content.innerHTML = `<div class="general-fixture-grid">${rounds.map((round) => { const showOrder = roundHasOfficialOrder(round); return `<article class="general-round"><h3>Fecha ${round.number}</h3>${showOrder ? '' : '<span class="pending-order-label">Orden por definir</span>'}<div class="general-match-list">${round.matches.map((match, index) => `<div class="general-match${showOrder ? '' : ' order-pending'}">${showOrder ? `<strong class="general-match-order">${index + 1}.</strong>` : ''}<span class="general-match-teams">${escapeHtml(teamName(match.homeId))} <b>vs.</b> ${escapeHtml(teamName(match.awayId))}</span>${matchScheduleText(match) ? `<small>${escapeHtml(matchScheduleText(match))}</small>` : ''}</div>`).join('')}</div>${round.byeTeamId ? `<div class="general-bye">Descansa: <strong>${escapeHtml(teamName(round.byeTeamId))}</strong></div>` : ''}</article>`; }).join('')}</div>`;
  document.querySelector('#print-fixture').textContent = 'Imprimir programación';
}

function fixtureShareText() {
  const title = `${championship?.name || 'Campeonato'} · ${discipline?.name || 'Deporte'}`;
  return [`PROGRAMACIÓN — ${title}`, '', ...rounds.flatMap((round) => [
    `FECHA ${round.number}`,
    ...round.matches.map((match, index) => `${roundHasOfficialOrder(round) ? `${index + 1}. ` : ''}${teamName(match.homeId)} vs. ${teamName(match.awayId)}${matchScheduleText(match) ? ` — ${matchScheduleText(match)}` : ''}`),
    ...(round.byeTeamId ? [`Descansa: ${teamName(round.byeTeamId)}`] : []),
    ''
  ])].join('\n').trim();
}

async function initialize() {
  try {
    const [championshipsResponse, disciplinesResponse, teamsResponse, matchesResponse] = await Promise.all([apiGet('/api/championships'), apiGet('/api/disciplines'), apiGet('/api/teams'), apiGet('/api/matches')]);
    championship = championshipsResponse.data.items.find((item) => item.id === championshipId);
    discipline = disciplinesResponse.data.items.find((item) => item.id === disciplineId);
    teams = teamsResponse.data.items.filter((item) => item.championshipId === championshipId && item.disciplineId === disciplineId && item.status !== 'INACTIVE');
    document.querySelector('#sidebar-championship').textContent = championship?.shortName || championship?.name || 'Campeonato';
    document.querySelector('#fixture-context').textContent = `${championship?.name || ''} · ${discipline?.name || ''}`;
    document.querySelector('#print-championship-name').textContent = championship?.name || 'Campeonato';
    document.querySelector('#print-discipline-name').textContent = discipline?.name || 'Deporte';
    document.querySelector('#fixture-team-count').textContent = `${teams.length} equipos`;
    const saved = matchesResponse.data.items.filter((item) => item.championshipId === championshipId && item.disciplineId === disciplineId);
    if (saved.length) {
      const grouped = Object.groupBy ? Object.groupBy(saved, (item) => item.round) : saved.reduce((acc, item) => ((acc[item.round] ||= []).push(item), acc), {});
      rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b).map((number) => ({ number, matches: grouped[number].sort((a, b) => a.order - b.order), byeTeamId: teams.find((team) => !grouped[number].some((match) => match.homeId === team.id || match.awayId === team.id))?.id || '' }));
      fixtureSaved = true; builder.hidden = true; preview.hidden = false; document.querySelector('#save-fixture').hidden = true; renderRound();
    }
  } catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
}

methodSelect.addEventListener('change', renderExternalOrder); manualCheckbox.addEventListener('change', renderManualRound);
manualRound.addEventListener('change', refreshManualOptions);
document.querySelector('#generate-fixture').addEventListener('click', () => {
  try { if (teams.length < 2) throw new Error('Se necesitan al menos dos equipos.'); const seed = manualCheckbox.checked ? manualSeed() : orderedTeams(); rounds = generateRounds(seed); activeRound = 1; preview.hidden = false; status.textContent = ''; renderRound(); }
  catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
});
tabs.addEventListener('click', (event) => { const tab = event.target.closest('[data-round]'); if (tab) { activeRound = Number(tab.dataset.round); renderRound(); } });
content.addEventListener('click', async (event) => {
  const round = rounds.find((item) => item.number === activeRound);
  const moveButton = event.target.closest('[data-move]');
  if (moveButton) { const index = Number(moveButton.dataset.index); const target = moveButton.dataset.move === 'up' ? index - 1 : index + 1; [round.matches[index], round.matches[target]] = [round.matches[target], round.matches[index]]; round.matches.forEach((match, i) => { match.order = i + 1; }); renderRound(); return; }
  if (event.target.closest('[data-suggest-order]')) {
    const points = calculatePoints();
    round.matches = round.matches.map((match, index) => ({ ...match, previousOrder: index })).sort((a, b) => ((points[a.homeId] || 0) + (points[a.awayId] || 0)) - ((points[b.homeId] || 0) + (points[b.awayId] || 0)) || a.previousOrder - b.previousOrder);
    round.matches.forEach((match, index) => { match.order = index + 1; }); renderRound(); return;
  }
  const confirmButton = event.target.closest('[data-confirm-order]');
  if (confirmButton) {
    confirmButton.disabled = true;
    try { await Promise.all(round.matches.map((match, index) => apiPut('/api/matches', { id: match.id, order: index + 1, orderConfirmed: true }))); round.matches.forEach((match, index) => { match.order = index + 1; match.orderConfirmed = true; }); renderRound(); }
    catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; confirmButton.disabled = false; }
  }
  if (event.target.closest('[data-schedule-round]')) openScheduleModal();
});
document.querySelector('#general-view').addEventListener('click', renderGeneral);
document.querySelector('#print-fixture').addEventListener('click', () => {
  document.querySelector('#print-discipline-name').textContent = showingGeneral ? (discipline?.name || 'Deporte') : `${discipline?.name || 'Deporte'} · Fecha ${activeRound}`;
  document.body.classList.toggle('print-single-round', !showingGeneral);
  requestAnimationFrame(() => window.print());
});
window.addEventListener('afterprint', () => { document.querySelector('#print-discipline-name').textContent = discipline?.name || 'Deporte'; document.body.classList.remove('print-single-round'); });
document.querySelector('#share-fixture').addEventListener('click', async () => {
  const shareStatus = document.querySelector('#share-fixture-status');
  const text = fixtureShareText();
  try {
    if (navigator.share) {
      await navigator.share({ title: `Programación - ${championship?.name || 'Campeonato'}`, text });
      shareStatus.textContent = 'Programación compartida.';
    } else {
      await navigator.clipboard.writeText(text);
      shareStatus.textContent = 'Programación copiada. Ya puedes pegarla en WhatsApp, correo u otra aplicación.';
    }
    shareStatus.className = 'form-status success-message';
  } catch (error) {
    if (error.name === 'AbortError') return;
    shareStatus.className = 'form-status error-message';
    shareStatus.textContent = 'No se pudo compartir. Usa Imprimir / PDF para guardar el documento.';
  }
});
document.querySelector('#save-fixture').addEventListener('click', async () => {
  const button = document.querySelector('#save-fixture'); button.disabled = true; status.textContent = 'Guardando fixture…';
  try { const matches = rounds.flatMap((round) => round.matches.map((match, index) => ({ ...match, round: round.number, order: index + 1 }))); const response = await apiPost('/api/matches', { championshipId, disciplineId, matches }); const saved = response.data.items; rounds.forEach((round) => { round.matches = saved.filter((match) => match.round === round.number).sort((a, b) => a.order - b.order); }); fixtureSaved = true; builder.hidden = true; button.hidden = true; status.className = 'form-status success-message'; status.textContent = 'Fixture guardado. Ahora confirma el orden de cada fecha.'; renderRound(); }
  catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; button.disabled = false; }
});
scheduleForm.addEventListener('input', renderSchedulePreview);
scheduleForm.addEventListener('submit', async (event) => { event.preventDefault(); const button = scheduleForm.querySelector('button[type="submit"]'); const round = rounds.find((item) => item.number === activeRound); const values = Object.fromEntries(new FormData(scheduleForm)); const times = roundTimes(round); button.disabled = true; scheduleStatus.textContent = 'Guardando…'; try { const updated = await Promise.all(round.matches.map((match, index) => apiPut('/api/matches', { id: match.id, date: values.date, time: times[index], venue: values.venue }))); round.matches = updated.map((response) => response.data).sort((a, b) => a.order - b.order); scheduleModal.close(); renderRound(); } catch (error) { scheduleStatus.className = 'form-status error-message'; scheduleStatus.textContent = error.message; } finally { button.disabled = false; } });
document.querySelector('#close-schedule-modal').addEventListener('click', closeScheduleModal); document.querySelector('#cancel-schedule-modal').addEventListener('click', closeScheduleModal); scheduleModal.addEventListener('click', (event) => { if (event.target === scheduleModal) closeScheduleModal(); });
initialize();
