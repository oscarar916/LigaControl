import { apiGet } from './api.js';

const params = new URLSearchParams(location.search);
let championshipId = params.get('championshipId') || localStorage.getItem('ligaControlChampionshipId') || '';
let disciplineId = params.get('disciplineId') || localStorage.getItem('ligaControlDisciplineId') || '';
const content = document.querySelector('#public-content');
const message = document.querySelector('#public-message');
let championship; let discipline; let teams = []; let players = []; let matches = []; let events = []; let sanctions = []; let payments = []; let activeView = 'schedule';

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const teamName = (id) => teams.find((team) => team.id === id)?.name || 'Equipo';
const playerName = (id) => players.find((player) => player.id === id)?.fullName || 'Jugador';
const played = (match) => match.closed || match.status === 'FINISHED' || match.roundLocked;
const dateText = (value) => { if (!value) return 'Fecha pendiente'; const date = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date); };
const timeText = (value) => { if (!value) return 'Hora pendiente'; const match = String(value).match(/T(\d{2}):(\d{2})/); return match ? `${match[1]}:${match[2]}` : String(value).slice(0, 5); };
const isVolleyball = () => /v[oó]ley|volley/i.test(discipline?.name || '');
const publicMatchTime = (match, index) => isVolleyball() && index > 0 && !match.time ? `Partido ${index + 1} · a continuación` : timeText(match.time);

function standings() {
  const table = Object.fromEntries(teams.map((team) => [team.id, { team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
  matches.filter(played).forEach((match) => { const home = table[match.homeId]; const away = table[match.awayId]; if (!home || !away) return; const hs = Number(match.homeScore); const as = Number(match.awayScore); home.pj += 1; away.pj += 1; home.gf += hs; home.gc += as; away.gf += as; away.gc += hs; if (hs > as) { home.pg += 1; home.pts += 3; away.pp += 1; } else if (as > hs) { away.pg += 1; away.pts += 3; home.pp += 1; } else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; } });
  return Object.values(table).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
}

function roundsWith(items) { const values = [...new Set(items.map((match) => match.round))].sort((a, b) => a - b); return values.map((round) => ({ round, matches: items.filter((match) => match.round === round).sort((a, b) => a.order - b.order) })); }
function roundHasOfficialOrder(round, items, nextPendingRound) { return items.every(played) || (round === nextPendingRound && items.every((match) => match.orderConfirmed)); }

function renderSummary() {
  const completed = matches.filter(played).length; const pendingAmount = payments.filter((payment) => payment.status === 'PENDING').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  document.querySelector('#public-summary').innerHTML = `<article><span>Equipos</span><strong>${teams.length}</strong></article><article><span>Partidos jugados</span><strong>${completed}/${matches.length}</strong></article><article><span>Próxima fecha</span><strong>${roundsWith(matches.filter((match) => !played(match)))[0]?.round || '—'}</strong></article><article><span>Multas pendientes</span><strong>S/ ${pendingAmount.toFixed(2)}</strong></article>`;
}

function renderSchedule() {
  const rounds = roundsWith(matches);
  const nextPendingRound = rounds.find(({ matches: items }) => !items.every(played))?.round;
  content.innerHTML = `<div class="public-section-heading"><div><small>Calendario oficial</small><h2>Programación de partidos</h2></div></div><div class="public-rounds">${rounds.map(({ round, matches: items }) => { const bye = teams.find((team) => !items.some((match) => match.homeId === team.id || match.awayId === team.id)); const showOrder = roundHasOfficialOrder(round, items, nextPendingRound); return `<article class="public-round-card"><header><h3>Fecha ${round}</h3><span>${showOrder ? `${items.length} partidos` : 'Orden por definir'}</span></header>${items.map((match, index) => `<div class="public-match-row${showOrder ? '' : ' order-pending'}">${showOrder ? `<b>${index + 1}</b>` : ''}<div class="public-match-teams"><strong>${esc(teamName(match.homeId))}</strong><span>VS</span><strong>${esc(teamName(match.awayId))}</strong></div><div class="public-match-info"><span>${esc(dateText(match.date))}</span><strong>${esc(publicMatchTime(match, index))}</strong><span>${esc(match.venue || 'Escenario pendiente')}</span></div></div>`).join('')}${bye ? `<footer>Descansa: <strong>${esc(bye.name)}</strong></footer>` : ''}</article>`; }).join('')}</div>`;
}

function renderResults() {
  const rounds = roundsWith(matches.filter(played));
  content.innerHTML = `<div class="public-section-heading"><div><small>Marcadores oficiales</small><h2>Resultados por fecha</h2></div></div>${rounds.length ? `<div class="public-rounds">${rounds.map(({ round, matches: items }) => `<article class="public-round-card"><header><h3>Fecha ${round}</h3><span>${items.length} resultados</span></header>${items.map((match) => `<div class="public-result-row"><span>${esc(teamName(match.homeId))}</span><strong>${match.homeScore} – ${match.awayScore}${match.isWalkover ? ' <small>W.O.</small>' : ''}</strong><span>${esc(teamName(match.awayId))}</span></div>`).join('')}</article>`).join('')}</div>` : '<div class="empty-state"><strong>Todavía no hay resultados oficiales</strong></div>'}`;
}

function renderStandings() {
  const rows = standings();
  content.innerHTML = `<div class="public-section-heading"><div><small>Clasificación actual</small><h2>Tabla de posiciones</h2></div><div class="standings-legend"><span class="qualification-legend"><i></i> Clasifican a cuartos de final</span><span>3 puntos por victoria · 1 por empate</span></div></div><div class="table-wrap"><table class="public-standings"><thead><tr><th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>${rows.map((item, index) => `<tr${index < 8 ? ' class="qualified-row"' : ''}><td><strong>${index + 1}</strong></td><td><strong>${esc(item.team.name)}</strong></td><td>${item.pj}</td><td>${item.pg}</td><td>${item.pe}</td><td>${item.pp}</td><td>${item.gf}</td><td>${item.gc}</td><td>${item.gf - item.gc}</td><td><strong>${item.pts}</strong></td></tr>`).join('')}</tbody></table></div>`;
}

function renderSanctions() {
  const pending = sanctions.map((sanction) => ({ sanction, payment: payments.find((payment) => payment.sanctionId === sanction.id) })).filter((item) => item.payment?.status === 'PENDING');
  const groups = teams.map((team) => ({ team, items: pending.filter((item) => item.sanction.teamId === team.id) })).filter((group) => group.items.length);
  content.innerHTML = `<div class="public-section-heading"><div><small>Control disciplinario</small><h2>Sanciones y pagos pendientes</h2><p>Información publicada para conocimiento de equipos y delegados.</p></div></div>${groups.length ? `<div class="public-sanction-groups">${groups.map(({ team, items }) => `<article><header><h3>${esc(team.name)}</h3><strong>S/ ${items.reduce((sum, item) => sum + Number(item.payment.amount || 0), 0).toFixed(2)}</strong></header><div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Sanción</th><th>Suspensión</th><th>Monto</th></tr></thead><tbody>${items.map(({ sanction, payment }) => `<tr><td>${esc(playerName(sanction.playerId))}</td><td>${sanction.type === 'YELLOW_CARD' ? '🟨 Amarilla' : sanction.type === 'RED_CARD' ? '🟥 Roja' : '⛔ Expulsión'}</td><td>${sanction.suspensionMatches ? `${sanction.suspensionMatches} fecha(s)` : 'Sin suspensión'}</td><td><strong>S/ ${Number(payment.amount || 0).toFixed(2)}</strong></td></tr>`).join('')}</tbody></table></div></article>`).join('')}</div>` : '<div class="empty-state"><strong>No existen sanciones pendientes de pago</strong></div>'}`;
}

const renderers = { schedule: renderSchedule, results: renderResults, standings: renderStandings, sanctions: renderSanctions };
function render() { document.querySelectorAll('[data-public-view]').forEach((button) => button.classList.toggle('active', button.dataset.publicView === activeView)); renderers[activeView](); }

async function resolvePublicContext() {
  if (!championshipId) {
    const response = await apiGet('/api/championships');
    const available = (response.data?.items || []).filter((item) => item.status !== 'INACTIVE');
    const selected = available.find((item) => item.status === 'ACTIVE') || available[0];
    championshipId = selected?.id || '';
  }

  if (championshipId && !disciplineId) {
    const response = await apiGet('/api/disciplines', { championshipId });
    const available = (response.data?.items || []).filter((item) => item.status !== 'INACTIVE');
    const selected = available.find((item) => String(item.name).toLowerCase().includes('fulbito')) || available[0];
    disciplineId = selected?.id || '';
  }
}

async function load() {
  try {
    await resolvePublicContext();
    if (!championshipId || !disciplineId) throw new Error('Este enlace no identifica un campeonato y deporte válidos.');
    const response = await apiGet('/api/results-bootstrap', { championshipId, disciplineId }); const data = response.data || {};
    championship = (data.championships || []).find((item) => item.id === championshipId); discipline = (data.disciplines || []).find((item) => item.id === disciplineId); teams = data.teams || []; players = data.players || []; matches = data.matches || []; events = data.events || [];
    const playerIds = new Set(players.map((player) => player.id)); const officialMatchIds = new Set(matches.filter(played).map((match) => match.id)); const officialEventIds = new Set(events.filter((event) => officialMatchIds.has(event.matchId)).map((event) => event.id)); sanctions = (data.sanctions || []).filter((sanction) => playerIds.has(sanction.playerId) && officialEventIds.has(sanction.eventId)); const sanctionIds = new Set(sanctions.map((sanction) => sanction.id)); payments = (data.payments || []).filter((payment) => sanctionIds.has(payment.sanctionId));
    document.title = `${championship?.shortName || championship?.name || 'Campeonato'} | LigaControl`; document.querySelector('#public-organizer').textContent = championship?.organizer || 'Información oficial'; document.querySelector('#public-championship').textContent = championship?.name || 'Campeonato'; document.querySelector('#public-discipline').textContent = discipline?.name || 'Deporte'; document.querySelector('#public-status').textContent = championship?.status || 'Información oficial';
    if (!params.get('championshipId')) history.replaceState(null, '', `?championshipId=${encodeURIComponent(championshipId)}&disciplineId=${encodeURIComponent(disciplineId)}`);
    renderSummary(); render();
  } catch (error) { content.innerHTML = `<div class="empty-state"><strong>No se pudo abrir la vista pública</strong><p>${esc(error.message)}</p></div>`; document.querySelector('#public-status').textContent = 'No disponible'; }
}

document.querySelector('.public-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-public-view]'); if (button) { activeView = button.dataset.publicView; render(); } });
document.querySelector('#share-public-page').addEventListener('click', async () => { const url = location.href; const text = `${championship?.name || 'Campeonato'} · ${discipline?.name || ''}`; try { if (navigator.share) await navigator.share({ title: text, text: 'Consulta la información oficial del campeonato:', url }); else await navigator.clipboard.writeText(url); message.textContent = navigator.share ? 'Enlace compartido.' : 'Enlace copiado al portapapeles.'; message.className = 'form-status success-message'; } catch (error) { if (error.name !== 'AbortError') { message.textContent = 'No se pudo compartir el enlace.'; message.className = 'form-status error-message'; } } });

load();
