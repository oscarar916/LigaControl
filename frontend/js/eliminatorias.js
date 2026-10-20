import { apiGetFresh, apiPost } from './api.js';

const championshipId = localStorage.getItem('ligaControlChampionshipId') || '';
const disciplineId = localStorage.getItem('ligaControlDisciplineId') || '';
const $ = (selector) => document.querySelector(selector);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let teams = [], matches = [], ranked = [], revision = '', confirmed = false, busy = false, savedPlan = null;
const teamName = (id) => teams.find((t) => t.id === id)?.name || 'Por definir';
const message = (text, error = false) => { $('#knockout-status').textContent = text; $('#knockout-status').className = `form-status ${error ? 'error-message' : 'success-message'}`; };
function stages(size) {
  const result = []; let offset = 0;
  for (let count = size/2; count >= 1; count /= 2) { result.push({count,offset,name: count === 8 ? 'Octavos de final' : count === 4 ? 'Cuartos de final' : count === 2 ? 'Semifinales' : 'Final'}); offset += count; }
  return result;
}
function sourcesFor(plan) {
  if (plan.sources) return plan.sources;
  const result = {}, rounds = stages(plan.size || 8);
  rounds.slice(1).forEach((round,i) => { for(let j=0;j<round.count;j++) result[round.offset+j] = i === 0 && plan.semifinals ? plan.semifinals[j] : [rounds[i].offset+j*2,rounds[i].offset+j*2+1]; });
  return result;
}
function matchLabel(size, index) {
  const stage = stages(size).find((s) => index >= s.offset && index < s.offset+s.count);
  return stage ? `${stage.name}${stage.count > 1 ? ` ${index-stage.offset+1}` : ''}` : 'Tercer puesto';
}

function standings() {
  const rows = Object.fromEntries(teams.map((t) => [t.id, { team: t, pts: 0, gf: 0, gc: 0, pg: 0 }]));
  matches.filter((m) => m.closed || m.status === 'FINISHED').forEach((m) => {
    const h = rows[m.homeId], a = rows[m.awayId];
    if (!h || !a || m.homeScore === '' || m.awayScore === '') return;
    const hs = Number(m.homeScore), as = Number(m.awayScore);
    h.gf += hs; h.gc += as; a.gf += as; a.gc += hs;
    if (hs > as) { h.pts += 3; h.pg++; } else if (as > hs) { a.pts += 3; a.pg++; } else { h.pts++; a.pts++; }
  });
  return Object.values(rows).sort((a,b) => b.pts-a.pts || (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf || b.pg-a.pg || a.team.name.localeCompare(b.team.name));
}
function options(selected) {
  return '<option value="">Seleccionar equipo</option>' + ranked.filter((r) => r.team.status !== 'ELIMINATED').map((r,i) => `<option value="${esc(r.team.id)}" ${r.team.id === selected ? 'selected' : ''}>${i+1}. ${esc(r.team.name)} · ${r.pts} pts.</option>`).join('');
}
function renderEditor(plan) {
  plan.size ||= 8; plan.sources = sourcesFor(plan); $('#knockout-size').value = plan.size;
  savedPlan = plan;
  $('#knockout-pairs').innerHTML = plan.pairs.map((p,i) => `<fieldset class="knockout-pair"><legend>${matchLabel(plan.size,i)}</legend><div class="knockout-options"><label class="field"><span>Equipo A</span><select data-home>${options(p.homeId)}</select></label><strong>vs.</strong><label class="field"><span>Equipo B</span><select data-away>${options(p.awayId)}</select></label></div><div class="knockout-options"><label class="field"><span>Fecha</span><input data-date type="date" value="${esc(p.date || '')}"></label><label class="field"><span>Hora</span><input data-time type="time" value="${esc(p.time || '')}"></label><label class="field"><span>Cancha</span><input data-venue maxlength="200" value="${esc(p.venue || '')}"></label></div></fieldset>`).join('');
  const rounds = stages(plan.size);
  $('#knockout-routes').innerHTML = rounds.slice(1).map((round,i) => Array.from({length:round.count},(_,j) => { const index = round.offset+j; return `<fieldset><legend>${matchLabel(plan.size,index)}</legend>${plan.sources[index].map((n) => `<label class="field"><span>Ganador de</span><select data-route="${index}">${Array.from({length:rounds[i].count},(_,k) => rounds[i].offset+k).map((x) => `<option value="${x}" ${x === n ? 'selected' : ''}>${matchLabel(plan.size,x)}</option>`).join('')}</select></label>`).join('')}</fieldset>`; }).join('')).join('');
  $('#bracket-context').textContent = `${plan.size} clasificados · ${rounds.map((r) => r.name).join(' → ')}`;
  $('#knockout-tie').value = plan.tieRule || ''; $('#knockout-third').checked = plan.thirdPlace;
  $('#knockout-notes').value = plan.notes || '';
  $('#knockout-state').textContent = confirmed ? 'Cruces oficiales confirmados. Solo consulta.' : 'Borrador editable · pendiente de aprobación de delegados';
  $('#knockout-form').querySelectorAll('input,select,textarea,button').forEach((el) => { el.disabled = confirmed; });
  updatePreview();
  renderResults(plan);
}
function participants(plan, index) {
  const size = plan.size || 8;
  if (index < size/2) return [plan.pairs[index].homeId, plan.pairs[index].awayId];
  const results = plan.results || {};
  if (index < size-1) return sourcesFor(plan)[index].map((n) => results[n]?.winnerId || '');
  return [size-4,size-3].map((n) => results[n]?.winnerId ? participants(plan,n).find((id) => id !== results[n].winnerId) : '');
}
function renderResults(plan) {
  $('#knockout-results').hidden = !confirmed;
  if (!confirmed) return;
  $('#knockout-result-forms').innerHTML = Array.from({length: plan.thirdPlace ? plan.size : plan.size-1}, (_,i) => {
    const ids = participants(plan,i), r = plan.results?.[i] || plan.pairs[i] || {}, ready = ids.every(Boolean);
    const label = matchLabel(plan.size,i);
    return `<form data-result="${i}" class="knockout-pair"><h3>${label}: ${esc(teamName(ids[0]))} vs. ${esc(teamName(ids[1]))}</h3><fieldset ${ready ? '' : 'disabled'}><div class="knockout-options"><label class="field"><span>Marcador A</span><input name="homeScore" type="number" min="0" step="1" required value="${esc(r.homeScore ?? '')}"></label><label class="field"><span>Marcador B</span><input name="awayScore" type="number" min="0" step="1" required value="${esc(r.awayScore ?? '')}"></label><label class="field"><span>Ganador si hay empate</span><select name="winnerId"><option value="">Seleccionar</option>${ids.filter(Boolean).map((id) => `<option value="${esc(id)}" ${r.winnerId === id ? 'selected' : ''}>${esc(teamName(id))}</option>`).join('')}</select></label><label class="field"><span>Fecha</span><input name="date" type="date" value="${esc(r.date || '')}"></label><label class="field"><span>Hora</span><input name="time" type="time" value="${esc(r.time || '')}"></label><label class="field"><span>Cancha</span><input name="venue" value="${esc(r.venue || '')}"></label></div><label class="field"><span>Observaciones / resultado del desempate</span><input name="notes" maxlength="2000" value="${esc(r.notes || '')}"></label><button class="secondary-button">${plan.results?.[i] ? 'Corregir resultado' : 'Guardar resultado'}</button></fieldset>${ready ? '' : '<p>Esperando ganadores de la ronda anterior.</p>'}</form>`;
  }).join('');
}
function readPlan() {
  const pairs = [...document.querySelectorAll('#knockout-pairs .knockout-pair')].map((row) => ({ homeId: row.querySelector('[data-home]').value, awayId: row.querySelector('[data-away]').value, date: row.querySelector('[data-date]').value, time: row.querySelector('[data-time]').value, venue: row.querySelector('[data-venue]').value }));
  const sources = {};
  document.querySelectorAll('[data-route]').forEach((el) => { (sources[el.dataset.route] ||= []).push(Number(el.value)); });
  return { size: Number($('#knockout-size').value), sources, status: confirmed ? 'CONFIRMED' : 'DRAFT', pairs, tieRule: $('#knockout-tie').value, thirdPlace: $('#knockout-third').checked, notes: $('#knockout-notes').value };
}
function updatePreview() {
  const p = readPlan();
  const card = (label, a, b, detail = '', index) => {
    const r = savedPlan?.results?.[index];
    if (r && confirmed) { const ids = participants(savedPlan,index); a = teamName(ids[0]); b = teamName(ids[1]); }
    return `<article class="bracket-match"><small>${esc(label)}</small><strong>${esc(a)}</strong><span>${r && confirmed ? `${r.homeScore} – ${r.awayScore}` : 'vs.'}</span><strong>${esc(b)}</strong>${r && confirmed ? `<small>Avanza: ${esc(teamName(r.winnerId))}</small>` : ''}${detail ? `<small>${esc(detail)}</small>` : ''}</article>`;
  };
  $('#bracket-label').textContent = confirmed ? 'CRUCES OFICIALES' : 'BORRADOR · NO OFICIAL';
  const rounds = stages(p.size);
  $('#knockout-bracket').style.setProperty('--bracket-columns', rounds.length);
  $('#knockout-bracket').innerHTML = rounds.map((round) => `<div><h3>${round.name}</h3>${Array.from({length:round.count},(_,j) => { const i=round.offset+j, r=p.pairs[i]; return r ? card(matchLabel(p.size,i),teamName(r.homeId),teamName(r.awayId),[r.date,r.time,r.venue].filter(Boolean).join(' · '),i) : card(matchLabel(p.size,i),`Ganador ${matchLabel(p.size,p.sources[i][0])}`,`Ganador ${matchLabel(p.size,p.sources[i][1])}`,'',i); }).join('')}${round.count === 1 && p.thirdPlace ? card('Tercer puesto', 'Perdedor semifinal 1','Perdedor semifinal 2','',p.size-1) : ''}</div>`).join('');
  $('#bracket-notes').textContent = `Desempate: ${p.tieRule === 'PENALTIES' ? 'Penales' : p.tieRule === 'MANUAL' ? 'Según acuerdo de delegados' : 'Pendiente de reunión'}. ${p.notes}`;
}
function seeded(size = Number($('#knockout-size').value)) {
  const selected = ranked.filter((r) => r.team.status !== 'ELIMINATED').slice(0,size);
  if (selected.length < size) throw new Error(`Se necesitan al menos ${size} equipos habilitados.`);
  const plan = { size, pairs: Array.from({length:size/2},(_,i) => ({ homeId: selected[i].team.id, awayId: selected[size-1-i].team.id })), tieRule: '', thirdPlace: false, notes: '' };
  const order = (n) => n === 2 ? [1,2] : order(n/2).flatMap((x) => [x,n+1-x]);
  const positions = order(size);
  plan.sources = sourcesFor(plan);
  // Acomoda las llaves para que los cabezas 1 y 2 solo se crucen en la final.
  for(let j=0;j<size/4;j++) plan.sources[size/2+j] = [Math.min(positions[j*4],positions[j*4+1])-1,Math.min(positions[j*4+2],positions[j*4+3])-1];
  return plan;
}
function validate(plan) {
  const ids = plan.pairs.flatMap((p) => [p.homeId,p.awayId]);
  if (ids.some((id) => !id) || new Set(ids).size !== plan.size) throw new Error(`Selecciona ${plan.size} equipos distintos, sin repetirlos.`);
  stages(plan.size).slice(1).forEach((round) => { const used = Array.from({length:round.count},(_,j) => plan.sources[round.offset+j]).flat(); if(new Set(used).size !== used.length) throw new Error('Cada cruce debe aparecer una sola vez en la siguiente ronda.'); });
}
async function save(confirmPlan) {
  if (busy || confirmed) return;
  try {
    const plan = readPlan(); validate(plan);
    if (confirmPlan) {
      if (!matches.length || matches.some((m) => !m.roundLocked)) throw new Error('Primero cierra todas las fechas de grupos.');
      if (!plan.tieRule) throw new Error('Define el desempate acordado en la reunión.');
      if (plan.tieRule === 'MANUAL' && !plan.notes.trim()) throw new Error('Escribe el acuerdo de desempate en las observaciones.');
      if (!confirm('¿Confirmar estos cruces como oficiales? Dejarán de ser editables en este módulo.')) return;
      plan.status = 'CONFIRMED';
    }
    busy = true; $('#save-knockout').disabled = true; $('#confirm-knockout').disabled = true;
    const response = await apiPost('/api/knockouts', { championshipId, disciplineId, revision, plan });
    revision = response.data.revision; confirmed = response.data.status === 'CONFIRMED'; renderEditor(response.data);
    message(confirmed ? 'Cruces oficiales confirmados.' : 'Borrador guardado. Puedes modificarlo después de la reunión.');
  } catch(e) { message(e.message, true); }
  finally { busy = false; $('#save-knockout').disabled = confirmed; $('#confirm-knockout').disabled = confirmed; }
}
$('#knockout-form').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
$('#confirm-knockout').addEventListener('click', () => save(true));
$('#knockout-form').addEventListener('input', (e) => { if (e.target.id !== 'knockout-size') updatePreview(); });
$('#knockout-pairs').addEventListener('change', () => { $('#knockout-method').value = 'manual'; });
$('#seed-knockout').addEventListener('click', () => { try { const p = readPlan(), next = seeded(); renderEditor({ ...p, size: next.size, pairs: next.pairs, sources: next.sources }); $('#knockout-method').value = 'seeded'; message('Propuesta regenerada. Guarda el borrador para conservarla.'); } catch(e) { message(e.message,true); } });
$('#knockout-size').addEventListener('change', () => { try { const p = readPlan(), next = seeded(); renderEditor({...p,...next,tieRule:p.tieRule,thirdPlace:p.thirdPlace,notes:p.notes}); } catch(e) { $('#knockout-size').value = savedPlan.size; message(e.message,true); } });
$('#knockout-method').addEventListener('change', () => { if ($('#knockout-method').value === 'seeded') $('#seed-knockout').click(); });
$('#print-knockout').addEventListener('click', () => window.print());
$('#knockout-result-forms').addEventListener('submit', async (e) => {
  e.preventDefault(); if (busy) return;
  const form = e.target, result = Object.fromEntries(new FormData(form));
  if (!confirm('¿Guardar este resultado oficial y actualizar el avance de las llaves?')) return;
  busy = true; const button = form.querySelector('button'); button.disabled = true;
  try {
    const response = await apiPost('/api/knockouts', { championshipId, disciplineId, revision, action: 'result', matchIndex: Number(form.dataset.result), result });
    revision = response.data.revision; renderEditor(response.data); message('Resultado guardado y llaves actualizadas.');
  } catch(e) { message(e.message,true); button.disabled = false; }
  finally { busy = false; }
});
async function load() {
  try {
    if (!championshipId || !disciplineId) throw new Error('Selecciona un campeonato y deporte.');
    const bootstrap = await apiGetFresh('/api/results-bootstrap', { championshipId, disciplineId, publicOnly: true });
    const d = bootstrap.data; teams = d.teams || []; matches = (d.matches || []).filter((m) => !m.phase || m.phase === 'GROUP'); ranked = standings();
    const title = `${d.championships.find((c) => c.id === championshipId)?.name || 'Campeonato'} · ${d.disciplines.find((c) => c.id === disciplineId)?.name || ''}`;
    $('#knockout-context').textContent = title; $('#bracket-championship').textContent = title;
    $('#group-completion').textContent = matches.length && matches.every((m) => m.roundLocked) ? 'Fase de grupos cerrada' : 'Grupos pendientes de cierre';
    let plan;
    try { plan = (await apiGetFresh('/api/knockouts', { championshipId, disciplineId })).data; }
    catch(e) { throw new Error('Publica el backend actualizado con KnockoutService.gs para habilitar el guardado de eliminatorias. ' + e.message); }
    revision = plan?.revision || ''; confirmed = plan?.status === 'CONFIRMED';
    renderEditor(plan || seeded()); $('#knockout-editor').hidden = false;
    message(plan ? 'Llaves recuperadas.' : 'Propuesta inicial sin guardar. Revisa los cruces antes de guardar el borrador.');
  } catch(e) { message(e.message, true); }
}
load();
