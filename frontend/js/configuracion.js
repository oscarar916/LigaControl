import { apiGet, apiPost, apiPut } from './api.js';

const selectedId = localStorage.getItem('ligaControlChampionshipId') || '';
const form = document.querySelector('#settings-form');
const status = document.querySelector('#settings-status');
const sanctionForm = document.querySelector('#sanction-settings-form');
const sanctionStatus = document.querySelector('#sanction-settings-status');
let championship;

async function loadSettings() {
  try {
    const response = await apiGet('/api/championships');
    championship = response.data.items.find((item) => item.id === selectedId && item.status !== 'INACTIVE');
    if (!championship) { window.location.href = 'dashboard.html'; return; }
    document.querySelector('#sidebar-championship').textContent = championship.shortName || championship.name;
    ['name', 'shortName', 'year', 'organizer', 'startDate', 'endDate'].forEach((key) => { form.elements[key].value = championship[key] || ''; });
    try {
      const configuration = await apiGet('/api/configuration', { championshipId: selectedId, disciplineId: '' });
      Object.entries(configuration.data.settings || {}).forEach(([key, value]) => { if (sanctionForm.elements[key]) sanctionForm.elements[key].value = value; });
    } catch (error) { sanctionStatus.textContent = 'Publica el backend actualizado para configurar estas reglas.'; }
  } catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  submit.disabled = true; status.className = 'form-status'; status.textContent = 'Guardando…';
  try {
    championship = (await apiPut('/api/championships', { id: championship.id, ...values, year: Number(values.year) })).data;
    document.querySelector('#sidebar-championship').textContent = championship.shortName || championship.name;
    status.className = 'form-status success-message'; status.textContent = 'Información actualizada.';
  } catch (error) { status.className = 'form-status error-message'; status.textContent = error.message; }
  finally { submit.disabled = false; }
});

sanctionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = sanctionForm.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(sanctionForm));
  Object.keys(values).forEach((key) => { values[key] = Number(values[key]); });
  submit.disabled = true; sanctionStatus.className = 'form-status'; sanctionStatus.textContent = 'Guardando…';
  try {
    await apiPost('/api/configuration', { championshipId: selectedId, disciplineId: '', settings: values });
    sanctionStatus.className = 'form-status success-message'; sanctionStatus.textContent = 'Reglas de sanciones actualizadas.';
  } catch (error) { sanctionStatus.className = 'form-status error-message'; sanctionStatus.textContent = error.message; }
  finally { submit.disabled = false; }
});

loadSettings();
