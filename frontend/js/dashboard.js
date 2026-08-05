import { apiGet, apiPost } from './api.js';

const form = document.querySelector('#championship-form');
const list = document.querySelector('#championship-list');
const status = document.querySelector('#form-status');
const modal = document.querySelector('#championship-modal');
const openModalButton = document.querySelector('#open-championship-modal');
const closeModalButton = document.querySelector('#close-championship-modal');
const cancelModalButton = document.querySelector('#cancel-championship-modal');
const reloadButton = document.querySelector('#reload-championships');
const disciplineFields = document.querySelector('#discipline-fields');
const addDisciplineButton = document.querySelector('#add-discipline-field');
let championships = [];
let disciplines = [];
let selectedChampionshipId = localStorage.getItem('ligaControlChampionshipId') || '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function disciplineCode(name) {
  return String(name || 'DEPORTE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function disciplineOptions(selected = '') {
  return ['Fulbito', 'Fútbol', 'Vóley'].map((name) => `<option value="${name}"${name === selected ? ' selected' : ''}>${name}</option>`).join('');
}

function resetDisciplineFields() {
  disciplineFields.innerHTML = `<label class="field"><span>Disciplina *</span><select name="disciplineName" required><option value="">Selecciona una disciplina</option>${disciplineOptions()}</select></label>`;
  addDisciplineButton.disabled = false;
}

function addDisciplineField() {
  const currentValues = [...disciplineFields.querySelectorAll('select')].map((select) => select.value);
  if (currentValues.length >= 3) return;
  const available = ['Fulbito', 'Fútbol', 'Vóley'].find((name) => !currentValues.includes(name)) || 'Fulbito';
  const row = document.createElement('div');
  row.className = 'discipline-field-row';
  row.innerHTML = `<label class="field"><span>Otra disciplina *</span><select name="disciplineName" required>${disciplineOptions(available)}</select></label><button class="icon-button remove-discipline" type="button" aria-label="Quitar disciplina">×</button>`;
  disciplineFields.appendChild(row);
  addDisciplineButton.disabled = disciplineFields.querySelectorAll('select').length >= 3;
}

function renderChampionships() {
  if (!championships.some((item) => item.id === selectedChampionshipId)) selectedChampionshipId = championships[0]?.id || '';
  if (selectedChampionshipId) localStorage.setItem('ligaControlChampionshipId', selectedChampionshipId);

  list.innerHTML = championships.length ? championships.map((item) => {
    const championshipDisciplines = disciplines.filter((discipline) => discipline.championshipId === item.id);
    const disciplineText = championshipDisciplines.length
      ? championshipDisciplines.map((discipline) => discipline.name).join(', ')
      : 'Disciplina pendiente';
    return `<button class="championship-card${item.id === selectedChampionshipId ? ' selected' : ''}" type="button" data-championship-id="${escapeHtml(item.id)}">
      <span class="championship-card-header"><h3>${escapeHtml(item.name)}</h3><span class="badge">${escapeHtml(item.status)}</span></span>
      <p>${escapeHtml(item.organizer)} · ${escapeHtml(item.year)}</p>
      <p class="card-discipline">⚽ ${escapeHtml(disciplineText)}</p>
      <span class="manage-label">Entrar al campeonato →</span>
    </button>`;
  }).join('') : `<div class="empty-state championship-empty">
    <strong>Todavía no hay campeonatos</strong>
    <p>Crea el primero para comenzar a registrar equipos y jugadores.</p>
    <button class="action-button" type="button" data-open-modal>+ Crear primer campeonato</button>
  </div>`;
}

async function loadData() {
  list.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const [championshipResponse, disciplineResponse] = await Promise.all([
      apiGet('/api/championships'), apiGet('/api/disciplines')
    ]);
    championships = championshipResponse.data.items.filter((item) => item.status !== 'INACTIVE');
    disciplines = disciplineResponse.data.items;
    renderChampionships();
  } catch (error) { list.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}

function openModal() {
  status.textContent = '';
  status.className = 'form-status';
  modal.showModal();
  setTimeout(() => form.elements.name.focus(), 0);
}

function closeModal() {
  if (!form.querySelector('button[type="submit"]').disabled) modal.close();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const values = Object.fromEntries(formData);
  const selectedDisciplines = [...new Set(formData.getAll('disciplineName').filter(Boolean))];
  if (!selectedDisciplines.length) {
    status.className = 'form-status error-message';
    status.textContent = 'Debes elegir al menos una disciplina.';
    form.querySelector('select[name="disciplineName"]').focus();
    return;
  }
  submit.disabled = true;
  status.className = 'form-status';
  status.textContent = 'Creando campeonato y disciplina…';
  try {
    const championshipResponse = await apiPost('/api/championships', {
      name: values.name, shortName: values.shortName, year: Number(values.year),
      organizer: values.organizer, startDate: values.startDate, endDate: values.endDate
    });
    const championship = championshipResponse.data;
    for (const disciplineName of selectedDisciplines) {
      await apiPost('/api/disciplines', {
        championshipId: championship.id, name: disciplineName,
        code: disciplineCode(disciplineName), type: 'TEAM'
      });
    }
    selectedChampionshipId = championship.id;
    localStorage.setItem('ligaControlChampionshipId', championship.id);
    form.reset();
    form.elements.year.value = new Date().getFullYear();
    resetDisciplineFields();
    modal.close();
    await loadData();
  } catch (error) {
    status.className = 'form-status error-message';
    status.textContent = error.message;
  } finally { submit.disabled = false; }
});

list?.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-modal]')) { openModal(); return; }
  const card = event.target.closest('[data-championship-id]');
  if (!card) return;
  selectedChampionshipId = card.dataset.championshipId;
  localStorage.setItem('ligaControlChampionshipId', selectedChampionshipId);
  window.location.href = 'campeonato.html';
});

openModalButton?.addEventListener('click', openModal);
addDisciplineButton?.addEventListener('click', addDisciplineField);
disciplineFields?.addEventListener('click', (event) => {
  const remove = event.target.closest('.remove-discipline');
  if (!remove) return;
  remove.closest('.discipline-field-row').remove();
  addDisciplineButton.disabled = false;
});
closeModalButton?.addEventListener('click', closeModal);
cancelModalButton?.addEventListener('click', closeModal);
reloadButton?.addEventListener('click', loadData);
modal?.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
loadData();
