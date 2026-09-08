import { apiGet, apiPost, apiPut } from './api.js?v=20260903-1';

const selectedId = localStorage.getItem('ligaControlChampionshipId') || '';
const list = document.querySelector('#team-list');
const count = document.querySelector('#team-count');
const context = document.querySelector('#championship-context');
const modalContext = document.querySelector('#team-modal-context');
const modal = document.querySelector('#team-modal');
const form = document.querySelector('#team-form');
const status = document.querySelector('#team-form-status');
const openTeamButton = document.querySelector('#open-team-modal');
const managementModal = document.querySelector('#team-management-modal');
let championship;
let discipline;
let championshipDisciplines = [];
let teams = [];
let matches = [];
let walkoverLimit = 2;
let managedTeam;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

async function loadTeams() {
  try {
    const [championshipsResponse, disciplinesResponse, teamsResponse, playersResponse, matchesResponse, configurationResponse] = await Promise.all([apiGet('/api/championships'), apiGet('/api/disciplines'), apiGet('/api/teams'), apiGet('/api/players'), apiGet('/api/matches'), apiGet('/api/configuration', { championshipId: selectedId })]);
    championship = championshipsResponse.data.items.find((item) => item.id === selectedId && item.status !== 'INACTIVE');
    championshipDisciplines = disciplinesResponse.data.items.filter((item) => item.championshipId === selectedId && item.status !== 'INACTIVE');
    const savedDisciplineId = localStorage.getItem('ligaControlDisciplineId');
    discipline = championshipDisciplines.find((item) => item.id === savedDisciplineId) || championshipDisciplines[0];
    if (discipline) localStorage.setItem('ligaControlDisciplineId', discipline.id);
    if (!championship) {
      openTeamButton.disabled = true;
      list.innerHTML = '<div class="empty-state championship-empty"><strong>No seleccionaste un campeonato</strong><p>Regresa a Campeonatos y selecciona uno para administrarlo.</p><a class="action-button" href="dashboard.html">Ir a campeonatos</a></div>';
      return;
    }
    context.textContent = `${championship.name} · ${discipline?.name || 'Disciplina pendiente'}`;
    document.querySelector('#sidebar-championship').textContent = championship.shortName || championship.name;
    modalContext.textContent = `${championship.name} · ${discipline?.name || ''}`;
    const disciplineSelect = document.querySelector('#active-discipline');
    disciplineSelect.innerHTML = championshipDisciplines.length ? championshipDisciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('') : '<option value="">Sin disciplina</option>';
    disciplineSelect.value = discipline?.id || '';
    disciplineSelect.disabled = !championshipDisciplines.length;
    openTeamButton.disabled = false;
    openTeamButton.textContent = discipline ? '+ Nuevo equipo' : '⚽ Configurar Fulbito';
    teams = teamsResponse.data.items.filter((item) => item.championshipId === selectedId && item.disciplineId === discipline?.id && item.status !== 'INACTIVE');
    matches = matchesResponse.data.items.filter((item) => item.championshipId === selectedId && item.disciplineId === discipline?.id && item.status !== 'INACTIVE');
    walkoverLimit = Math.max(1, Number(configurationResponse.data.settings?.WALKOVER_ELIMINATION_LIMIT || 2));
    count.textContent = teams.length;
    list.innerHTML = teams.length ? teams.map((team, index) => {
      const playerCount = playersResponse.data.items.filter((player) => player.teamId === team.id && player.status !== 'INACTIVE').length;
      const walkovers = matches.filter(match => match.isWalkover && !match.automaticWalkover && match.walkoverTeamId === team.id).length;
      return `<article class="championship-card team-card"><span class="team-number">${index + 1}</span><span class="championship-card-header"><h3>${escapeHtml(team.name)}</h3><span class="badge">${playerCount} jugadores</span></span><p><strong>Delegado:</strong> ${escapeHtml(team.delegate || 'No registrado')}</p><p><strong>Estado:</strong> ${team.status === 'ELIMINATED' ? '<span class="badge eliminated-badge">Eliminado</span>' : 'Activo'}</p><p><strong>Walkovers perdidos:</strong> ${walkovers} de ${walkoverLimit}</p><div class="team-card-actions"><button class="action-button compact-button" type="button" data-manage-team="${escapeHtml(team.id)}">Gestionar participación</button><button class="secondary-button compact-button" type="button" data-team-id="${escapeHtml(team.id)}">Ver jugadores</button></div></article>`;
    }).join('') : '<div class="empty-state championship-empty"><strong>Todavía no hay equipos</strong><p>Registra el primer equipo participante.</p></div>';
  } catch (error) { list.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}

function resultFor(match, teamId) {
  if (match.homeScore === '' || match.awayScore === '') return 'Pendiente';
  if (match.isWalkover && match.walkoverTeamId === teamId) return 'Derrota por W.O.';
  if (match.isWalkover) return 'Victoria por W.O.';
  const own = match.homeId === teamId ? Number(match.homeScore) : Number(match.awayScore);
  const rival = match.homeId === teamId ? Number(match.awayScore) : Number(match.homeScore);
  return own > rival ? 'Victoria' : own < rival ? 'Derrota' : 'Empate';
}

function openManagement(teamId) {
  managedTeam = teams.find(team => team.id === teamId);
  if (!managedTeam) return;
  const teamMatches = matches.filter(match => match.homeId === teamId || match.awayId === teamId).sort((a, b) => a.round - b.round || a.order - b.order);
  const walkovers = teamMatches.filter(match => match.isWalkover && !match.automaticWalkover && match.walkoverTeamId === teamId).length;
  const eligible = walkovers >= walkoverLimit && managedTeam.status !== 'ELIMINATED';
  document.querySelector('#management-team-name').textContent = managedTeam.name;
  document.querySelector('#management-team-summary').textContent = `${teamMatches.length} partidos · ${walkovers} W.O. perdido(s) · límite ${walkoverLimit}`;
  document.querySelector('#management-alert').innerHTML = managedTeam.status === 'ELIMINATED' ? '<div class="walkover-alert"><strong>Equipo eliminado.</strong> Sus partidos posteriores se asignan 3–0 a sus rivales.</div>' : eligible ? `<div class="walkover-alert"><strong>Alerta reglamentaria:</strong> alcanzó ${walkovers} W.O. Confirma manualmente la eliminación.</div>` : `<div class="walkover-ok">El equipo todavía no alcanza el límite de ${walkoverLimit} W.O.</div>`;
  document.querySelector('#management-match-history').innerHTML = `<table class="management-history-table"><thead><tr><th>Fecha</th><th>Rival</th><th>Marcador</th><th>Resultado</th></tr></thead><tbody>${teamMatches.map(match => { const isHome = match.homeId === teamId; const rival = teams.find(team => team.id === (isHome ? match.awayId : match.homeId)); const score = match.homeScore === '' || match.awayScore === '' ? '—' : `${isHome ? match.homeScore : match.awayScore}–${isHome ? match.awayScore : match.homeScore}`; return `<tr class="${match.isWalkover ? 'walkover-row' : ''}"><td>Fecha ${match.round}</td><td>${escapeHtml(rival?.name || 'Equipo')}</td><td>${score}</td><td>${resultFor(match, teamId)}</td></tr>`; }).join('') || '<tr><td colspan="4">No hay partidos registrados.</td></tr>'}</tbody></table>`;
  const eliminateButton = document.querySelector('#eliminate-team-walkovers');
  eliminateButton.disabled = !eligible;
  eliminateButton.hidden = managedTeam.status === 'ELIMINATED';
  document.querySelector('#management-status').textContent = '';
  managementModal.showModal();
}

function openModal() { status.textContent = ''; modal.showModal(); setTimeout(() => form.elements.name.focus(), 0); }
function closeModal() { if (!form.querySelector('button[type="submit"]').disabled) modal.close(); }

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  submit.disabled = true; status.className = 'form-status'; status.textContent = 'Guardando…';
  try {
    await apiPost('/api/teams', { championshipId: championship.id, disciplineId: discipline.id, ...values });
    form.reset(); modal.close(); await loadTeams();
  } catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
  finally { submit.disabled = false; }
});

openTeamButton.addEventListener('click', async () => {
  if (discipline) { openModal(); return; }
  openTeamButton.disabled = true;
  openTeamButton.textContent = 'Configurando…';
  try {
    await apiPost('/api/disciplines', { championshipId: championship.id, name: 'Fulbito', code: 'FULBITO', type: 'TEAM' });
    await loadTeams();
  } catch (error) {
    list.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
    openTeamButton.disabled = false;
    openTeamButton.textContent = '⚽ Configurar Fulbito';
  }
});
document.querySelector('#close-team-modal').addEventListener('click', closeModal);
document.querySelector('#cancel-team-modal').addEventListener('click', closeModal);
document.querySelector('#reload-teams').addEventListener('click', loadTeams);
document.querySelector('#active-discipline').addEventListener('change', (event) => { localStorage.setItem('ligaControlDisciplineId', event.target.value); loadTeams(); });
list.addEventListener('click', (event) => {
  const managementButton = event.target.closest('[data-manage-team]');
  if (managementButton) { openManagement(managementButton.dataset.manageTeam); return; }
  const card = event.target.closest('[data-team-id]');
  if (!card) return;
  localStorage.setItem('ligaControlTeamId', card.dataset.teamId);
  window.location.href = 'equipo.html';
});
document.querySelector('#close-team-management').addEventListener('click', () => managementModal.close());
document.querySelector('#view-team-roster').addEventListener('click', () => { if (!managedTeam) return; localStorage.setItem('ligaControlTeamId', managedTeam.id); window.location.href = 'equipo.html'; });
document.querySelector('#eliminate-team-walkovers').addEventListener('click', async (event) => { if (!managedTeam) return; if (!confirm(`¿Confirmas la eliminación de ${managedTeam.name}? Sus partidos restantes se registrarán 3–0 a favor de sus rivales.`)) return; const button = event.currentTarget; const managementStatus = document.querySelector('#management-status'); button.disabled = true; managementStatus.textContent = 'Aplicando eliminación…'; managementStatus.className = 'form-status'; try { const response = await apiPut('/api/teams', { id: managedTeam.id, eliminateForWalkovers: true }); if (!(response.data.eliminatedTeamIds || []).includes(managedTeam.id)) throw new Error('El backend publicado todavía no incluye la eliminación por W.O. Actualiza MatchService.gs, TeamService.gs y ConfigurationService.gs y publica una versión nueva.'); managementModal.close(); await loadTeams(); } catch (error) { managementStatus.textContent = error.message; managementStatus.className = 'form-status error-message'; button.disabled = false; } });
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
managementModal.addEventListener('click', (event) => { if (event.target === managementModal) managementModal.close(); });
loadTeams();
