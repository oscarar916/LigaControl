import { apiGet } from './api.js';

const championshipId = localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId = localStorage.getItem('ligaControlDisciplineId') || '';
const content = document.querySelector('#report-content');
const status = document.querySelector('#report-status');
let championship; let discipline; let teams = []; let players = []; let matches = []; let events = []; let sanctions = []; let activeReport = 'standings';

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const teamName = (id) => teams.find((team) => team.id === id)?.name || 'Equipo';
const playerName = (id) => players.find((player) => player.id === id)?.fullName || 'Jugador';
const activeMatches = () => matches.filter((match) => match.closed || match.status === 'FINISHED');

function standings() {
  const table = Object.fromEntries(teams.map((team) => [team.id, { team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
  activeMatches().forEach((match) => {
    const home = table[match.homeId]; const away = table[match.awayId];
    if (!home || !away || match.homeScore === '' || match.awayScore === '') return;
    const homeScore = Number(match.homeScore); const awayScore = Number(match.awayScore);
    home.pj += 1; away.pj += 1; home.gf += homeScore; home.gc += awayScore; away.gf += awayScore; away.gc += homeScore;
    if (homeScore > awayScore) { home.pg += 1; home.pts += 3; away.pp += 1; }
    else if (awayScore > homeScore) { away.pg += 1; away.pts += 3; home.pp += 1; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
  });
  return Object.values(table).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || b.pg - a.pg || a.team.name.localeCompare(b.team.name));
}

function eventTotals(types) {
  const totals = {};
  events.filter((event) => types.includes(event.type) && event.status !== 'INACTIVE').forEach((event) => {
    const key = event.playerId; totals[key] ||= { playerId: key, teamId: event.teamId, total: 0, yellow: 0, red: 0 };
    totals[key].total += 1;
    if (event.type === 'YELLOW_CARD') totals[key].yellow += 1;
    if (event.type === 'RED_CARD') totals[key].red += 1;
  });
  return Object.values(totals);
}

function renderSummary() {
  const goals = eventTotals(['GOAL', 'OWN_GOAL']).reduce((sum, item) => sum + item.total, 0);
  const cards = eventTotals(['YELLOW_CARD', 'RED_CARD']).reduce((sum, item) => sum + item.total, 0);
  document.querySelector('#reports-summary').innerHTML = `
    <article class="report-stat"><span>Equipos</span><strong>${teams.length}</strong><small>${players.length} jugadores inscritos</small></article>
    <article class="report-stat"><span>Partidos jugados</span><strong>${activeMatches().length}</strong><small>de ${matches.length} programados</small></article>
    <article class="report-stat"><span>Goles registrados</span><strong>${goals}</strong><small>Asignados en actas</small></article>
    <article class="report-stat"><span>Tarjetas</span><strong>${cards}</strong><small>${sanctions.length} sanciones activas</small></article>`;
}

function table(headers, rows, emptyText) {
  return `<div class="table-wrap report-table-wrap"><table class="report-table"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="empty-state compact">${esc(emptyText)}</td></tr>`}</tbody></table></div>`;
}

function renderStandings() {
  const rows = standings().map((item, index) => `<tr${index < 8 ? ' class="qualified-row"' : ''}><td><strong>${index + 1}</strong></td><td><strong>${esc(item.team.name)}</strong></td><td>${item.pj}</td><td>${item.pg}</td><td>${item.pe}</td><td>${item.pp}</td><td>${item.gf}</td><td>${item.gc}</td><td>${item.gf - item.gc}</td><td><strong>${item.pts}</strong></td></tr>`);
  return table(['Pos.', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'PTS'], rows, 'Todavía no hay equipos registrados.');
}

function renderScorers() {
  const scorers = eventTotals(['GOAL']).sort((a, b) => b.total - a.total || playerName(a.playerId).localeCompare(playerName(b.playerId)));
  const rows = scorers.map((item, index) => `<tr><td><strong>${index + 1}</strong></td><td>${esc(playerName(item.playerId))}</td><td>${esc(teamName(item.teamId))}</td><td class="report-highlight">${item.total}</td></tr>`);
  return table(['Pos.', 'Jugador', 'Equipo', 'Goles'], rows, 'Todavía no hay goles asignados a jugadores.');
}

function renderCards() {
  const cards = eventTotals(['YELLOW_CARD', 'RED_CARD']).sort((a, b) => b.red - a.red || b.yellow - a.yellow || playerName(a.playerId).localeCompare(playerName(b.playerId)));
  if (!cards.length) return '<div class="empty-state compact">Todavía no hay tarjetas registradas.</div>';
  const groups = teams.map((team) => ({ team, items: cards.filter((item) => item.teamId === team.id) })).filter((group) => group.items.length);
  return `<div class="sanction-team-groups">${groups.map(({ team, items }) => {
    const detailed = items.map((item) => {
      const playerSanctions = sanctions.filter((sanction) => sanction.playerId === item.playerId);
      return { ...item, amount: playerSanctions.reduce((sum, sanction) => sum + Number(sanction.amount || 0), 0), suspension: playerSanctions.reduce((sum, sanction) => sum + Number(sanction.suspensionMatches || 0), 0) };
    });
    const totals = detailed.reduce((result, item) => ({ yellow: result.yellow + item.yellow, red: result.red + item.red, suspension: result.suspension + item.suspension, amount: result.amount + item.amount }), { yellow: 0, red: 0, suspension: 0, amount: 0 });
    const showRed = totals.red > 0;
    const rows = detailed.map((item) => `<tr><td>${esc(playerName(item.playerId))}</td><td><span class="yellow-total">${item.yellow}</span></td>${showRed ? `<td>${item.red ? `<span class="red-total">${item.red}</span>` : '—'}</td>` : ''}<td>${item.suspension || '—'}</td><td><strong>S/ ${item.amount.toFixed(2)}</strong></td></tr>`);
    return `<section class="sanction-team-card"><header><div><small>Equipo</small><h3>${esc(team.name)}</h3></div><div class="sanction-team-summary"><span>🟨 <strong>${totals.yellow}</strong></span>${showRed ? `<span>🟥 <strong>${totals.red}</strong></span>` : ''}<span class="sanction-team-amount">Total: <strong>S/ ${totals.amount.toFixed(2)}</strong></span></div></header>${table(['Jugador', 'Amarillas', ...(showRed ? ['Rojas'] : []), 'Suspensión', 'Multa'], rows, '')}</section>`;
  }).join('')}</div>`;
}

function renderRosters() {
  return `<div class="roster-report-grid">${teams.map((team) => {
    const roster = players.filter((player) => player.teamId === team.id && player.status !== 'INACTIVE').sort((a, b) => Number(a.shirtNumber || 999) - Number(b.shirtNumber || 999) || a.fullName.localeCompare(b.fullName));
    return `<article class="roster-report-card"><header><h3>${esc(team.name)}</h3><span>${roster.length} jugadores</span></header>${roster.length ? `<ol>${roster.map((player) => `<li><strong>${player.shirtNumber === '' ? 'S/N' : esc(player.shirtNumber)}</strong><span>${esc(player.fullName)}</span></li>`).join('')}</ol>` : '<p class="muted">Sin jugadores inscritos.</p>'}</article>`;
  }).join('')}</div>`;
}

const reportDefinitions = {
  standings: { title: 'Tabla de posiciones', description: 'Clasificación actual según los resultados cerrados.', render: renderStandings },
  scorers: { title: 'Tabla de goleadores', description: 'Goles registrados individualmente en las actas digitales.', render: renderScorers },
  cards: { title: 'Tarjetas y sanciones', description: 'Resumen disciplinario y económico por jugador.', render: renderCards },
  rosters: { title: 'Planteles inscritos', description: 'Relación de jugadores activos agrupados por equipo.', render: renderRosters }
};

function renderReport() {
  const definition = reportDefinitions[activeReport];
  document.querySelector('#report-title').textContent = definition.title;
  document.querySelector('#report-description').textContent = definition.description;
  document.querySelector('#report-generated-at').textContent = `Actualizado: ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
  content.innerHTML = definition.render();
  document.querySelectorAll('[data-report]').forEach((button) => button.classList.toggle('active', button.dataset.report === activeReport));
}

function reportShareText() {
  const title = `${reportDefinitions[activeReport].title} — ${championship?.name || 'Campeonato'} (${discipline?.name || 'Deporte'})`;
  if (activeReport === 'standings') return [title, '', ...standings().map((item, index) => `${index + 1}. ${item.team.name} — ${item.pts} pts. (DG ${item.gf - item.gc})`)].join('\n');
  if (activeReport === 'scorers') return [title, '', ...eventTotals(['GOAL']).sort((a, b) => b.total - a.total).map((item, index) => `${index + 1}. ${playerName(item.playerId)} (${teamName(item.teamId)}) — ${item.total} goles`)].join('\n');
  return `${title}\n\nConsulta el reporte completo impreso o guardado como PDF desde LigaControl.`;
}

async function load() {
  try {
    if (!championshipId || !disciplineId) throw new Error('Selecciona nuevamente el campeonato y el deporte para abrir sus reportes.');
    const response = await apiGet('/api/results-bootstrap', { championshipId, disciplineId });
    const data = response.data || {};
    championship = (data.championships || []).find((item) => item.id === championshipId);
    discipline = (data.disciplines || []).find((item) => item.id === disciplineId);
    teams = data.teams || []; players = data.players || []; matches = data.matches || [];
    const playerIds = new Set(players.map((player) => player.id));
    events = (data.events || []).filter((event) => playerIds.has(event.playerId));
    sanctions = (data.sanctions || []).filter((sanction) => playerIds.has(sanction.playerId));
    document.querySelector('#sidebar-championship').textContent = championship?.shortName || championship?.name || 'Campeonato';
    document.querySelector('#reports-context').textContent = `${championship?.name || ''} · ${discipline?.name || ''}`;
    document.querySelector('#report-championship').textContent = championship?.name || 'Campeonato';
    document.querySelector('#report-discipline').textContent = discipline?.name || 'Deporte';
    document.querySelector('#report-footer-context').textContent = `${championship?.shortName || championship?.name || ''} · ${discipline?.name || ''}`;
    renderSummary(); renderReport();
  } catch (error) {
    content.innerHTML = `<p class="error-message">${esc(error.message)}</p>`;
    status.textContent = 'No se pudieron cargar los reportes.';
    status.className = 'form-status error-message';
  }
}

document.querySelector('.report-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-report]'); if (button) { activeReport = button.dataset.report; renderReport(); } });
document.querySelector('#print-report').addEventListener('click', () => window.print());
document.querySelector('#share-report').addEventListener('click', async () => {
  const text = reportShareText();
  try {
    if (navigator.share) await navigator.share({ title: reportDefinitions[activeReport].title, text });
    else await navigator.clipboard.writeText(text);
    status.textContent = navigator.share ? 'Reporte compartido.' : 'Resumen copiado al portapapeles.';
    status.className = 'form-status success-message';
  } catch (error) {
    if (error.name !== 'AbortError') { status.textContent = 'No se pudo compartir el reporte. Puedes guardarlo con Imprimir / PDF.'; status.className = 'form-status error-message'; }
  }
});

load();
