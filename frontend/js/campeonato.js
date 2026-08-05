import { apiGet } from './api.js';

const selectedId = localStorage.getItem('ligaControlChampionshipId') || '';
const detail = document.querySelector('#championship-detail');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function formatDate(value) {
  if (!value) return 'No definida';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

async function loadSummary() {
  try {
    const [championshipResponse, disciplineResponse, teamResponse] = await Promise.all([apiGet('/api/championships'), apiGet('/api/disciplines'), apiGet('/api/teams')]);
    const championship = championshipResponse.data.items.find((item) => item.id === selectedId && item.status !== 'INACTIVE');
    if (!championship) { window.location.href = 'dashboard.html'; return; }
    const disciplines = disciplineResponse.data.items.filter((item) => item.championshipId === selectedId);
    const teams = teamResponse.data.items.filter((item) => item.championshipId === selectedId && item.status !== 'INACTIVE');
    document.querySelector('#sidebar-championship').textContent = championship.shortName || championship.name;
    document.querySelector('#championship-title').textContent = championship.name;
    const savedDisciplineId = localStorage.getItem('ligaControlDisciplineId');
    const selectedDisciplineId = disciplines.some((item) => item.id === savedDisciplineId) ? savedDisciplineId : disciplines[0]?.id || '';
    if (selectedDisciplineId) localStorage.setItem('ligaControlDisciplineId', selectedDisciplineId);
    const sportIcon = (item) => item.code === 'VOLEY' ? '🏐' : '⚽';
    const teamBreakdown = disciplines.map((item) => `<div class="sport-team-count"><div><span class="sport-mini-icon">${sportIcon(item)}</span><span>${escapeHtml(item.name)}</span></div><strong>${teams.filter((team) => team.disciplineId === item.id).length}</strong></div>`).join('');
    detail.innerHTML = `<div class="detail-heading"><div><small>Información general</small><h2>Resumen del campeonato</h2></div><span class="badge">${escapeHtml(championship.status)}</span></div>
      <div class="summary-grid"><article class="summary-stat"><div class="summary-stat-icon">🏆</div><div class="summary-stat-content"><span class="summary-stat-label">Deportes habilitados</span><strong class="summary-stat-value">${disciplines.length}</strong></div></article><article class="summary-stat sport-breakdown-stat"><div class="summary-stat-icon">👥</div><div class="summary-stat-content"><span class="summary-stat-label">Equipos inscritos</span><div class="sport-team-breakdown">${teamBreakdown || '<span>Sin deportes registrados</span>'}</div></div></article><article class="summary-stat"><div class="summary-stat-icon">📅</div><div class="summary-stat-content"><span class="summary-stat-label">Temporada</span><strong class="summary-stat-value">${escapeHtml(championship.year)}</strong></div></article></div>
      <div class="detail-grid"><div><span class="detail-label">Organizador</span><strong>${escapeHtml(championship.organizer || 'No especificado')}</strong></div><div><span class="detail-label">Nombre corto</span><strong>${escapeHtml(championship.shortName || 'No especificado')}</strong></div><div><span class="detail-label">Fecha de inicio</span><strong>${escapeHtml(formatDate(championship.startDate))}</strong></div><div><span class="detail-label">Fecha de finalización</span><strong>${escapeHtml(formatDate(championship.endDate))}</strong></div></div>
      <div class="discipline-section"><div class="section-heading"><div><h2>Deportes del campeonato</h2><p class="muted">Elige un deporte para administrar sus equipos, jugadores y partidos.</p></div></div>
      <div class="discipline-grid">${disciplines.length ? disciplines.map((item) => { const count = teams.filter((team) => team.disciplineId === item.id).length; return `<a class="discipline-card${item.id === selectedDisciplineId ? ' selected' : ''}" href="equipos.html" data-discipline-id="${escapeHtml(item.id)}"><span class="discipline-icon">${sportIcon(item)}</span><div class="discipline-card-content"><span class="discipline-kicker">Deporte</span><strong>${escapeHtml(item.name)}</strong><p>${count} ${count === 1 ? 'equipo inscrito' : 'equipos inscritos'}</p></div><span class="discipline-enter">Administrar <b>→</b></span></a>`; }).join('') : '<div class="empty-state compact"><strong>Sin deportes</strong><p>Este campeonato fue creado sin deportes.</p></div>'}</div></div>`;
    detail.querySelectorAll('[data-discipline-id]').forEach((card) => card.addEventListener('click', () => localStorage.setItem('ligaControlDisciplineId', card.dataset.disciplineId)));
  } catch (error) { detail.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}
loadSummary();
