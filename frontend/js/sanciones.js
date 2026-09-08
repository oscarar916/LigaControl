import { apiGet, apiPost, apiPut } from './api.js';

const championshipId = localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId = localStorage.getItem('ligaControlDisciplineId') || '';
const groups = document.querySelector('#sanction-groups');
const status = document.querySelector('#sanction-status');
let championship; let discipline; let teams = []; let players = []; let matches = []; let events = []; let sanctions = []; let payments = [];

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const teamName = (id) => teams.find((team) => team.id === id)?.name || 'Equipo';
const playerName = (id) => players.find((player) => player.id === id)?.fullName || 'Jugador';
const paymentFor = (sanctionId) => payments.find((payment) => payment.sanctionId === sanctionId);
function roundForSanction(sanction) {
  const event = events.find((item) => item.id === sanction.eventId);
  const eventMatch = event && matches.find((match) => match.id === event.matchId);
  if (eventMatch) return eventMatch.round;
  return matches.find((match) => String(match.date || '').slice(0, 10) === String(sanction.startDate || '').slice(0, 10))?.round || '';
}

function filteredSanctions() {
  const round = document.querySelector('#sanction-round').value;
  const teamId = document.querySelector('#sanction-team').value;
  const type = document.querySelector('#sanction-type').value;
  const paymentStatus = document.querySelector('#sanction-payment').value;
  return sanctions.filter((sanction) => {
    const payment = paymentFor(sanction.id);
    return (!round || String(roundForSanction(sanction)) === round) && (!teamId || sanction.teamId === teamId) && (!type || sanction.type === type) && (!paymentStatus || payment?.status === paymentStatus);
  });
}

function renderSummary() {
  const validIds = new Set(sanctions.map((sanction) => sanction.id));
  const validPayments = payments.filter((payment) => validIds.has(payment.sanctionId));
  const pending = validPayments.filter((payment) => payment.status === 'PENDING');
  const paid = validPayments.filter((payment) => payment.status === 'PAID');
  const suspended = sanctions.filter((sanction) => Number(sanction.suspensionMatches || 0) > 0).length;
  document.querySelector('#sanction-summary').innerHTML = `<article><span>Pendiente de cobro</span><strong class="danger-value">S/ ${pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2)}</strong><small>${pending.length} multa(s)</small></article><article><span>Total pagado</span><strong class="success-value">S/ ${paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2)}</strong><small>${paid.length} pago(s)</small></article><article><span>Suspensiones</span><strong>${suspended}</strong><small>Registros con fechas de suspensión</small></article><article><span>Sanciones válidas</span><strong>${sanctions.length}</strong><small>Del deporte seleccionado</small></article>`;
}

function sanctionLabel(type) { return type === 'YELLOW_CARD' ? '🟨 Amarilla' : type === 'RED_CARD' ? '🟥 Roja directa' : '⛔ Expulsión'; }
function suspensionText(sanction) {
  const matches = Number(sanction.suspensionMatches || 0);
  if (!matches) return 'Sin suspensión';
  const reason = sanction.reason && sanction.reason !== 'Tarjeta amarilla'
    ? sanction.reason
    : sanction.type === 'YELLOW_CARD'
      ? 'Acumulación de tarjetas amarillas'
      : sanction.type === 'RED_CARD'
        ? 'Tarjeta roja directa'
        : 'Expulsión';
  return `<strong>${matches} fecha${matches === 1 ? '' : 's'}</strong><small>${esc(reason)}</small>`;
}

function renderGroups() {
  const filtered = filteredSanctions();
  const teamGroups = teams.map((team) => ({ team, items: filtered.filter((item) => item.teamId === team.id) })).filter((group) => group.items.length);
  groups.innerHTML = teamGroups.length ? teamGroups.map(({ team, items }) => {
    const pendingTotal = items.reduce((sum, item) => { const payment = paymentFor(item.id); return sum + (payment?.status === 'PENDING' ? Number(payment.amount || 0) : 0); }, 0);
    return `<article class="sanction-management-card"><header><div><small>Equipo</small><h3>${esc(team.name)}</h3></div><div><span>${items.length} sanción(es)</span><strong>S/ ${pendingTotal.toFixed(2)} pendiente</strong></div></header><div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Fecha</th><th>Tarjeta</th><th>Suspensión</th><th>Monto</th><th>Pago</th><th></th></tr></thead><tbody>${items.map((item) => {
      const payment = paymentFor(item.id); const paid = payment?.status === 'PAID'; const round = roundForSanction(item);
      return `<tr><td><strong>${esc(playerName(item.playerId))}</strong></td><td>${round ? `Fecha ${round}` : 'Sin fecha'}</td><td>${sanctionLabel(item.type)}</td><td class="suspension-cell">${suspensionText(item)}</td><td><strong>S/ ${Number(item.amount || 0).toFixed(2)}</strong></td><td><span class="badge ${paid ? 'paid-badge' : 'pending-badge'}">${paid ? 'Pagado' : 'Pendiente'}</span>${paid && payment.date ? `<small class="payment-date">${esc(payment.date)}</small>` : ''}</td><td>${payment ? `<label class="payment-state-editor"><span class="sr-only">Estado de pago de ${esc(playerName(item.playerId))}</span><select data-payment-state="${payment.id}" data-current-state="${payment.status}"><option value="PENDING"${paid ? '' : ' selected'}>Pendiente</option><option value="PAID"${paid ? ' selected' : ''}>Pagado</option></select></label>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div></article>`;
  }).join('') : '<div class="empty-state compact"><strong>No hay sanciones con estos filtros</strong><p>Prueba seleccionando otro equipo, fecha o estado de pago.</p></div>';
  const selectedRound = document.querySelector('#sanction-round').value;
  const pendingInRound = payments.filter((payment) => payment.status === 'PENDING' && sanctions.some((sanction) => sanction.id === payment.sanctionId && String(roundForSanction(sanction)) === selectedRound));
  const markRoundPaid = document.querySelector('#mark-round-paid');
  markRoundPaid.disabled = !selectedRound || !pendingInRound.length;
  markRoundPaid.textContent = selectedRound ? `Marcar Fecha ${selectedRound} como pagada${pendingInRound.length ? ` (${pendingInRound.length})` : ''}` : 'Marcar fecha como pagada';
}

async function savePaymentState(paymentId, paid) {
  const response = await apiPut('/api/payments', { id: paymentId, paid });
  payments = payments.map((item) => item.id === response.data.id ? response.data : item);
}

function fillFilters() {
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
  document.querySelector('#sanction-round').innerHTML = '<option value="">Todas las fechas</option>' + rounds.map((round) => `<option value="${round}">Fecha ${round}</option>`).join('');
  document.querySelector('#sanction-team').innerHTML = '<option value="">Todos los equipos</option>' + teams.map((team) => `<option value="${team.id}">${esc(team.name)}</option>`).join('');
}

async function load() {
  try {
    if (!championshipId || !disciplineId) throw new Error('Selecciona nuevamente el campeonato y el deporte.');
    const response = await apiGet('/api/results-bootstrap', { championshipId, disciplineId }); const data = response.data || {};
    championship = (data.championships || []).find((item) => item.id === championshipId); discipline = (data.disciplines || []).find((item) => item.id === disciplineId);
    teams = data.teams || []; players = data.players || []; matches = data.matches || []; events = data.events || [];
    const playerIds = new Set(players.filter((player) => player.status !== 'INACTIVE').map((player) => player.id));
    sanctions = (data.sanctions || []).filter((sanction) => playerIds.has(sanction.playerId)); const sanctionIds = new Set(sanctions.map((sanction) => sanction.id));
    payments = (data.payments || []).filter((payment) => sanctionIds.has(payment.sanctionId));
    document.querySelector('#sidebar-championship').textContent = championship?.shortName || championship?.name || 'Campeonato'; document.querySelector('#sanctions-context').textContent = `${championship?.name || ''} · ${discipline?.name || ''}`;
    fillFilters(); renderSummary(); renderGroups();
  } catch (error) { groups.innerHTML = `<p class="error-message">${esc(error.message)}</p>`; }
}

document.querySelector('.sanction-filters').addEventListener('change', renderGroups);
document.querySelector('#clear-sanction-filters').addEventListener('click', () => { document.querySelector('#sanction-round').value = ''; document.querySelector('#sanction-team').value = ''; document.querySelector('#sanction-type').value = ''; document.querySelector('#sanction-payment').value = 'PENDING'; renderGroups(); });
groups.addEventListener('change', async (event) => { const select = event.target.closest('[data-payment-state]'); if (!select) return; const previousState = select.dataset.currentState; const nextState = select.value; if (previousState === nextState) return; const label = nextState === 'PAID' ? 'pagada' : 'pendiente'; if (!confirm(`¿Confirmas que deseas marcar esta multa como ${label}?`)) { select.value = previousState; return; } select.disabled = true; try { await savePaymentState(select.dataset.paymentState, nextState === 'PAID'); renderSummary(); renderGroups(); status.textContent = `Multa marcada como ${label}.`; status.className = 'form-status success-message'; } catch (error) { select.value = previousState; select.disabled = false; status.textContent = error.message; status.className = 'form-status error-message'; } });
document.querySelector('#mark-round-paid').addEventListener('click', async (event) => { const round = document.querySelector('#sanction-round').value; if (!round) return; const pending = payments.filter((payment) => payment.status === 'PENDING' && sanctions.some((sanction) => sanction.id === payment.sanctionId && String(roundForSanction(sanction)) === round)); if (!pending.length) return; if (!confirm(`¿Confirmas que todos los pagos pendientes de la Fecha ${round} (${pending.length}) fueron pagados?`)) return; const button = event.currentTarget; button.disabled = true; status.textContent = `Registrando ${pending.length} pagos…`; status.className = 'form-status'; let updated = 0; try { for (const payment of pending) { await savePaymentState(payment.id, true); updated += 1; } renderSummary(); renderGroups(); status.textContent = `Fecha ${round}: ${updated} pago(s) registrados correctamente.`; status.className = 'form-status success-message'; } catch (error) { renderSummary(); renderGroups(); status.textContent = `Se registraron ${updated} de ${pending.length} pagos. ${error.message}`; status.className = 'form-status error-message'; } });
document.querySelector('#recalculate-sanctions').addEventListener('click', async (event) => { const button = event.currentTarget; button.disabled = true; status.textContent = 'Recalculando…'; try { await apiPost('/api/sanctions', { championshipId }); await load(); status.textContent = 'Sanciones actualizadas.'; status.className = 'form-status success-message'; } catch (error) { status.textContent = error.message; status.className = 'form-status error-message'; } finally { button.disabled = false; } });

load();
