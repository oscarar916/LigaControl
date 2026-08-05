import { apiDelete, apiGet, apiPost, apiPut } from './api.js';

const teamId = localStorage.getItem('ligaControlTeamId') || '';
const list = document.querySelector('#player-list');
const count = document.querySelector('#player-count');
const modal = document.querySelector('#player-modal');
const form = document.querySelector('#player-form');
const status = document.querySelector('#player-form-status');
let team;
let players = [];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function dateInputValue(value) { return value ? String(value).slice(0, 10) : ''; }

function renderPlayers() {
  count.textContent = players.length;
  list.innerHTML = players.length ? players.map((player) => `<article class="player-card" data-player-id="${escapeHtml(player.id)}">
    <span class="shirt-number">${player.shirtNumber === '' ? '—' : escapeHtml(player.shirtNumber)}</span>
    <div class="player-info"><h3>${escapeHtml(player.fullName)}</h3><p>DNI: ${escapeHtml(player.dni || 'No registrado')}</p><p>${escapeHtml(player.position || 'Posición no registrada')}</p></div>
    <div class="player-actions"><button class="secondary-button compact-button" type="button" data-edit-player="${escapeHtml(player.id)}">Editar</button><button class="text-danger-button" type="button" data-remove-player="${escapeHtml(player.id)}">Retirar</button></div>
  </article>`).join('') : '<div class="empty-state championship-empty"><strong>Plantel vacío</strong><p>Registra el primer jugador de este equipo.</p></div>';
}

async function loadPlayers() {
  try {
    const [teamsResponse, playersResponse] = await Promise.all([apiGet('/api/teams'), apiGet('/api/players')]);
    team = teamsResponse.data.items.find((item) => item.id === teamId && item.status !== 'INACTIVE');
    if (!team) { window.location.href = 'equipos.html'; return; }
    document.querySelector('#sidebar-team').textContent = team.name;
    document.querySelector('#team-context').textContent = team.name;
    document.querySelector('#team-title').textContent = `Jugadores de ${team.name}`;
    document.querySelector('#player-modal-context').textContent = team.name;
    players = playersResponse.data.items.filter((item) => item.teamId === teamId && item.status !== 'INACTIVE');
    renderPlayers();
  } catch (error) { list.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`; }
}

function openNewPlayer() {
  form.reset(); form.elements.id.value = ''; status.textContent = '';
  modal.querySelector('h2').textContent = 'Registrar jugador';
  form.querySelector('button[type="submit"]').textContent = 'Guardar jugador';
  modal.showModal(); setTimeout(() => form.elements.fullName.focus(), 0);
}

function openPlayer(player) {
  form.elements.id.value = player.id; form.elements.dni.value = player.dni;
  form.elements.shirtNumber.value = player.shirtNumber; form.elements.fullName.value = player.fullName;
  form.elements.position.value = player.position; form.elements.birthDate.value = dateInputValue(player.birthDate);
  status.textContent = ''; modal.querySelector('h2').textContent = 'Ficha y edición del jugador';
  form.querySelector('button[type="submit"]').textContent = 'Guardar cambios'; modal.showModal();
}

function closeModal() { if (!form.querySelector('button[type="submit"]').disabled) modal.close(); }
form.addEventListener('submit', async (event) => {
  event.preventDefault(); const submit = form.querySelector('button[type="submit"]'); const values = Object.fromEntries(new FormData(form));
  submit.disabled = true; status.className = 'form-status'; status.textContent = 'Guardando…';
  try {
    const payload = { teamId: team.id, dni: values.dni, fullName: values.fullName, shirtNumber: values.shirtNumber, position: values.position, birthDate: values.birthDate };
    if (values.id) await apiPut('/api/players', { id: values.id, ...payload }); else await apiPost('/api/players', payload);
    form.reset(); modal.close(); await loadPlayers();
  } catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
  finally { submit.disabled = false; }
});

list.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-player]');
  const removeButton = event.target.closest('[data-remove-player]');
  const card = event.target.closest('[data-player-id]');
  if (removeButton) {
    const player = players.find((item) => item.id === removeButton.dataset.removePlayer);
    if (!window.confirm(`¿Retirar a ${player.fullName} del equipo?`)) return;
    removeButton.disabled = true;
    try { await apiDelete('/api/players', { id: player.id }); await loadPlayers(); }
    catch (error) { window.alert(error.message); removeButton.disabled = false; }
    return;
  }
  const id = editButton?.dataset.editPlayer || card?.dataset.playerId;
  const player = players.find((item) => item.id === id);
  if (player) openPlayer(player);
});

document.querySelector('#open-player-modal').addEventListener('click', openNewPlayer);
document.querySelector('#close-player-modal').addEventListener('click', closeModal);
document.querySelector('#cancel-player-modal').addEventListener('click', closeModal);
document.querySelector('#reload-players').addEventListener('click', loadPlayers);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
loadPlayers();
