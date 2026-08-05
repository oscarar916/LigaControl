import { apiDelete, apiGet } from './api.js';

const selectedId = localStorage.getItem('ligaControlChampionshipId') || '';
const modal = document.querySelector('#delete-championship-modal');
const confirmationInput = document.querySelector('#delete-confirmation-input');
const confirmButton = document.querySelector('#confirm-delete-championship');
const deleteStatus = document.querySelector('#delete-status');
let championship;
const adminKeyInput = document.querySelector('#admin-api-key');
const adminKeyStatus = document.querySelector('#admin-key-status');

adminKeyInput.value = localStorage.getItem('ligaControlAdminKey') || '';

document.querySelector('#admin-key-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const key = adminKeyInput.value.trim();
  if (key.length < 24) {
    adminKeyStatus.className = 'form-status error-message';
    adminKeyStatus.textContent = 'La clave debe tener por lo menos 24 caracteres.';
    return;
  }
  localStorage.setItem('ligaControlAdminKey', key);
  adminKeyStatus.className = 'form-status success-message';
  adminKeyStatus.textContent = 'Clave guardada en este navegador.';
});

document.querySelector('#show-admin-key').addEventListener('change', (event) => {
  adminKeyInput.type = event.target.checked ? 'text' : 'password';
});

document.querySelector('#clear-admin-key').addEventListener('click', () => {
  localStorage.removeItem('ligaControlAdminKey');
  adminKeyInput.value = '';
  adminKeyStatus.className = 'form-status';
  adminKeyStatus.textContent = 'La clave fue retirada de este navegador.';
});

async function loadContext() {
  try {
    const response = await apiGet('/api/championships');
    championship = response.data.items.find((item) => item.id === selectedId && item.status !== 'INACTIVE');
    if (!championship) { window.location.href = 'dashboard.html'; return; }
    document.querySelector('#sidebar-championship').textContent = championship.shortName || championship.name;
    document.querySelector('#delete-confirmation-name').textContent = championship.name;
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'error-message'; message.textContent = error.message;
    document.querySelector('.settings-card').prepend(message);
  }
}

function openDeleteModal() {
  confirmationInput.value = ''; confirmButton.disabled = true;
  deleteStatus.textContent = ''; modal.showModal();
  setTimeout(() => confirmationInput.focus(), 0);
}

function closeDeleteModal() {
  if (!confirmButton.dataset.busy) modal.close();
}

confirmationInput.addEventListener('input', () => { confirmButton.disabled = confirmationInput.value !== championship?.name; });
confirmButton.addEventListener('click', async () => {
  if (confirmationInput.value !== championship.name) return;
  confirmButton.disabled = true; confirmButton.dataset.busy = 'true';
  deleteStatus.className = 'form-status'; deleteStatus.textContent = 'Eliminando…';
  try {
    await apiDelete('/api/championships', { id: championship.id });
    localStorage.removeItem('ligaControlChampionshipId'); localStorage.removeItem('ligaControlDisciplineId');
    window.location.href = 'dashboard.html';
  } catch (error) {
    deleteStatus.className = 'form-status error-message'; deleteStatus.textContent = error.message;
    delete confirmButton.dataset.busy; confirmButton.disabled = false;
  }
});

document.querySelector('#open-delete-championship').addEventListener('click', openDeleteModal);
document.querySelector('#close-delete-modal').addEventListener('click', closeDeleteModal);
document.querySelector('#cancel-delete-modal').addEventListener('click', closeDeleteModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeDeleteModal(); });
loadContext();
