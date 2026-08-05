import { apiGet, apiPost } from './api.js';

const selectedId = localStorage.getItem('ligaControlChampionshipId') || '';
const list = document.querySelector('#team-list');
const count = document.querySelector('#team-count');
const context = document.querySelector('#championship-context');
const modalContext = document.querySelector('#team-modal-context');
const modal = document.querySelector('#team-modal');
const form = document.querySelector('#team-form');
const status = document.querySelector('#team-form-status');
const openTeamButton = document.querySelector('#open-team-modal');
let championship;
let discipline;
let championshipDisciplines = [];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

async function loadTeams() {
  try {
    const [championshipsResponse, disciplinesResponse, teamsResponse, playersResponse] = await Promise.all([apiGet('/api/championships'), apiGet('/api/disciplines'), apiGet('/api/teams'), apiGet('/api/players')]);
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
    const teams = teamsResponse.data.items.filter((item) => item.championshipId === selectedId && item.disciplineId === discipline?.id && item.status !== 'INACTIVE');
    count.textContent = teams.length;
    list.innerHTML = teams.length ? teams.map((team, index) => {
      const playerCount = playersResponse.data.items.filter((player) => player.teamId === team.id && player.status !== 'INACTIVE').length;
      return `<button class="championship-card team-card" type="button" data-team-id="${escapeHtml(team.id)}"><span class="team-number">${index + 1}</span><span class="championship-card-header"><h3>${escapeHtml(team.name)}</h3><span class="badge">${playerCount} jugadores</span></span><p><strong>Delegado:</strong> ${escapeHtml(team.delegate || 'No registrado')}</p><p><strong>Teléfono:</strong> ${escapeHtml(team.phone || 'No registrado')}</p><p><strong>Uniforme:</strong> ${escapeHtml(team.uniform || 'No registrado')}</p><span class="manage-label">Ver equipo y jugadores →</span></button>`;
    }).join('') : '<div class="empty-state championship-empty"><strong>Todavía no hay equipos</strong><p>Registra el primer equipo participante.</p></div>';
  } catch (error) { list.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
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
  const card = event.target.closest('[data-team-id]');
  if (!card) return;
  localStorage.setItem('ligaControlTeamId', card.dataset.teamId);
  window.location.href = 'equipo.html';
});
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
loadTeams();
