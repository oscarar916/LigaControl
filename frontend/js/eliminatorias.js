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
function orderedSeededPlan(plan, automatic) {
  const key = (p) => `${p.homeId}:${p.awayId}`;
  const canonical = automatic.pairs.map(key), previous = plan.pairs.map(key);
  const valid = previous.length === canonical.length && new Set(previous).size === canonical.length && previous.every((k)=>canonical.includes(k));
  const order = valid ? previous.map((k)=>canonical.indexOf(k)) : canonical.map((_,i)=>i);
  const remap = Object.fromEntries(order.map((original,index)=>[original,index]));
  const sources = Object.fromEntries(Object.entries(automatic.sources).map(([index,pair])=>[index,pair.map((n)=>n<automatic.pairs.length?remap[n]:n)]));
  return {...plan,sources,pairs:order.map((original,i)=>({...plan.pairs[i],...automatic.pairs[original]}))};
}
function moveOpeningMatch(plan, from, to) {
  if (from<0 || to<0 || from>=plan.pairs.length || to>=plan.pairs.length) return plan;
  const pairs=plan.pairs.slice(),time=plan.pairs[0].time || '';
  [pairs[from],pairs[to]]=[pairs[to],pairs[from]];
  return {...plan,pairs:pairs.map((p,i)=>({...p,time:i===0?time:''})),sources:Object.fromEntries(Object.entries(plan.sources).map(([index,pair])=>[index,pair.map((n)=>n===from?to:n===to?from:n)]))};
}
function renderEditor(plan) {
  plan.size ||= 8; plan.sources = sourcesFor(plan); $('#knockout-size').value = plan.size;
  if (!confirmed) {
    const automatic = seeded(plan.size);
    plan = orderedSeededPlan(plan, automatic);
  }
  savedPlan = plan;
  const label = (id) => { const position = ranked.findIndex((r) => r.team.id === id); return `${position+1}. ${teamName(id)}`; };
  $('#knockout-pairs').innerHTML = plan.pairs.map((p,i) => `<div class="knockout-pair knockout-fixed-pair"><span class="knockout-pair-number" title="Orden de juego">${i+1}</span><strong>${esc(label(p.homeId))}</strong><span class="knockout-vs">vs.</span><strong>${esc(label(p.awayId))}</strong>${confirmed?'':`<div class="knockout-order-actions"><button type="button" data-move="${i}" data-direction="-1" aria-label="Subir partido ${i+1}" ${i===0?'disabled':''}>↑</button><button type="button" data-move="${i}" data-direction="1" aria-label="Bajar partido ${i+1}" ${i===plan.pairs.length-1?'disabled':''}>↓</button></div>`}</div>`).join('');
  $('#knockout-common-date').value = plan.pairs[0].date || ''; $('#knockout-common-venue').value = plan.pairs[0].venue || ''; $('#knockout-common-time').value = plan.pairs[0].time || '';
  const rounds = stages(plan.size);
  $('#bracket-context').textContent = `${plan.size} clasificados · ${rounds.map((r) => r.name).join(' → ')}`;
  $('#knockout-tie').value = plan.tieRule || ''; $('#knockout-third').checked = plan.thirdPlace;
  $('#knockout-notes').value = plan.notes || '';
  $('#knockout-state').textContent = confirmed ? 'Cruces oficiales confirmados. Solo consulta.' : 'Borrador editable · pendiente de aprobación de delegados';
  $('#knockout-form').querySelectorAll('input,select,textarea,button').forEach((el) => { el.disabled = confirmed; });
  if(!confirmed) $('#knockout-pairs').querySelectorAll('[data-move]').forEach((button)=>{const destination=Number(button.dataset.move)+Number(button.dataset.direction);button.disabled=destination<0||destination>=plan.pairs.length;});
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
    return `<form data-result="${i}" class="knockout-pair"><h3>${label}: ${esc(teamName(ids[0]))} vs. ${esc(teamName(ids[1]))}</h3><fieldset ${ready ? '' : 'disabled'}><div class="knockout-options"><label class="field"><span>Marcador A</span><input name="homeScore" type="number" min="0" step="1" required value="${esc(r.homeScore ?? '')}"></label><label class="field"><span>Marcador B</span><input name="awayScore" type="number" min="0" step="1" required value="${esc(r.awayScore ?? '')}"></label><label class="field"><span>Ganador si hay empate</span><select name="winnerId"><option value="">Seleccionar</option>${ids.filter(Boolean).map((id) => `<option value="${esc(id)}" ${r.winnerId === id ? 'selected' : ''}>${esc(teamName(id))}</option>`).join('')}</select></label></div><label class="field"><span>Observaciones / resultado del desempate</span><input name="notes" maxlength="2000" value="${esc(r.notes || '')}"></label><button class="secondary-button">${plan.results?.[i] ? 'Corregir resultado' : 'Guardar resultado'}</button></fieldset>${ready ? '' : '<p>Esperando ganadores de la ronda anterior.</p>'}</form>`;
  }).join('');
}
function readPlan() {
  const date = $('#knockout-common-date').value, venue = $('#knockout-common-venue').value.trim(), time = $('#knockout-common-time').value;
  const pairs = savedPlan.pairs.map((pair,i) => ({ ...pair, date, venue, time: i === 0 ? time : '' }));
  const sources = savedPlan.sources;
  return { size: Number($('#knockout-size').value), sources, status: confirmed ? 'CONFIRMED' : 'DRAFT', pairs, tieRule: $('#knockout-tie').value, thirdPlace: $('#knockout-third').checked, notes: $('#knockout-notes').value };
}
function bracketLayout(plan) {
  const rounds = stages(plan.size), final = plan.size-2, sources = sourcesFor(plan);
  const columns = rounds.length*2-1, step = 260, width = columns*step, height = Math.max(460,plan.size/4*112+250);
  const nodes = [], edges = [];
  function branch(index, side, depth, leaf) {
    let y;
    if (index < plan.size/2) y = 70 + leaf.value++*112;
    else {
      const a=branch(sources[index][0],side,depth+1,leaf), b=branch(sources[index][1],side,depth+1,leaf);
      y=(a.y+b.y)/2; edges.push({from:a.index,to:index},{from:b.index,to:index});
    }
    const column = side === 'left' ? rounds.length-2-depth : rounds.length+depth;
    const node={index,x:column*step+12,y}; nodes.push(node); return node;
  }
  const left=branch(sources[final][0],'left',0,{value:0}),right=branch(sources[final][1],'right',0,{value:0});
  nodes.push({index:final,x:(rounds.length-1)*step+12,y:(left.y+right.y)/2});
  edges.push({from:left.index,to:final},{from:right.index,to:final});
  if(plan.thirdPlace) nodes.push({index:plan.size-1,x:(rounds.length-1)*step+12,y:height-80});
  return {nodes,edges,width,height,cardWidth:236};
}
function updatePreview() {
  const p = readPlan(), layout=bracketLayout(p);
  const name = (index) => { const round=stages(p.size).find((r)=>index>=r.offset&&index<r.offset+r.count); return round ? `${round.count===8?'O':round.count===4?'C':round.count===2?'S':'F'}${index-round.offset+1}` : '3.º'; };
  const lines=layout.edges.map((edge)=>{
    const a=layout.nodes.find((n)=>n.index===edge.from),b=layout.nodes.find((n)=>n.index===edge.to),right=a.x<b.x;
    const x1=a.x+(right?layout.cardWidth:0),x2=b.x+(right?0:layout.cardWidth),mid=(x1+x2)/2;
    return `<path d="M${x1},${a.y+35} H${mid} V${b.y+35} H${x2}"/>`;
  }).join('');
  const finalNode=layout.nodes.find((n)=>n.index===p.size-2);
  const headings=[...new Set(layout.nodes.filter((n)=>n.index<p.size-2).map((n)=>n.x))].map((x)=>{
    const node=layout.nodes.find((n)=>n.x===x&&n.index<p.size-2),round=stages(p.size).find((r)=>node.index>=r.offset&&node.index<r.offset+r.count);
    return `<div class="knockout-stage-label" style="left:${x/layout.width*100}%;width:${layout.cardWidth/layout.width*100}%">${round.name}</div>`;
  }).join('');
  const winner=confirmed?savedPlan.results?.[p.size-2]?.winnerId:'';
  const centerpiece=`<div class="knockout-final-title" style="left:${finalNode.x/layout.width*100}%;top:${finalNode.y-42}px;width:${layout.cardWidth/layout.width*100}%">FINAL</div><div class="knockout-champion" style="left:${finalNode.x/layout.width*100}%;top:${finalNode.y+110}px;width:${layout.cardWidth/layout.width*100}%"><svg viewBox="0 0 100 115" aria-hidden="true"><path d="M27 10H73V38Q73 63 50 69Q27 63 27 38Z" fill="#edc75b"/><path d="M27 20H12V35Q12 55 32 55M73 20H88V35Q88 55 68 55" fill="none" stroke="#d6a632" stroke-width="7"/><path d="M50 68V92M32 97H68M25 106H75" stroke="#d6a632" stroke-width="9"/><path d="M35 18V38Q35 49 41 52" fill="none" stroke="#fff3b7" stroke-width="4"/></svg><small>${winner?'CAMPEÓN':'RUMBO AL TÍTULO'}</small><strong>${winner?esc(teamName(winner)):'Campeón por definir'}</strong></div>`;
  $('#bracket-label').textContent = confirmed ? 'CRUCES OFICIALES' : 'BORRADOR · NO OFICIAL';
  $('#knockout-bracket').classList.add('knockout-tree-scroll');
  const cards = {};
  layout.nodes.forEach((node)=>{
    const index=node.index,r=confirmed?savedPlan.results?.[index]:null,ids=confirmed?participants(savedPlan,index):index<p.size/2?[p.pairs[index].homeId,p.pairs[index].awayId]:['',''];
    const placeholders=index===p.size-1?['Perdedor S1','Perdedor S2']:index<p.size/2?['Por definir','Por definir']:p.sources[index].map((n)=>`Ganador ${name(n)}`);
    cards[index] = `<article class="knockout-tree-match ${index===p.size-2?'knockout-tree-final':''}" style="left:${node.x/layout.width*100}%;top:${node.y}px;width:${layout.cardWidth/layout.width*100}%"><small>${esc(matchLabel(p.size,index))}</small>${ids.map((id,i)=>`<div class="knockout-tree-team"><strong>${esc(id?teamName(id):placeholders[i])}</strong><b>${r?(i===0?r.homeScore:r.awayScore):'–'}</b></div>`).join('')}${r&&r.homeScore===r.awayScore?`<small>Avanza: ${esc(teamName(r.winnerId))}</small>`:''}</article>`;
  });
  const compact = stages(p.size).map((round)=>`<section><h3>${round.name}</h3>${Array.from({length:round.count},(_,j)=>cards[round.offset+j]).join('')}</section>`).join('')+(p.thirdPlace?`<section><h3>Tercer puesto</h3>${cards[p.size-1]}</section>`:'');
  $('#knockout-bracket').innerHTML = `<div class="knockout-tree" style="--tree-width:${layout.width}px;--tree-height:${layout.height}px"><svg viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${headings}${centerpiece}${Object.values(cards).join('')}</div><div class="knockout-tree-compact">${compact}</div>`;
  const first=p.pairs[0];
  $('#bracket-context').textContent = `${p.size} clasificados · ${[first.date,first.time?`Inicio ${first.time}`:'',first.venue].filter(Boolean).join(' · ') || 'Programación por definir'}`;
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
      if (!plan.tieRule) { $('#knockout-rules').open = true; $('#knockout-tie').focus(); throw new Error('Elige el desempate en «Reglas y opciones» antes de confirmar.'); }
      if (plan.tieRule === 'MANUAL' && !plan.notes.trim()) { $('#knockout-rules').open = true; $('#knockout-notes').focus(); throw new Error('Escribe el acuerdo de desempate en las observaciones.'); }
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
$('#knockout-pairs').addEventListener('click', (e)=>{
  const button=e.target.closest('[data-move]'); if(!button||confirmed||busy) return;
  const from=Number(button.dataset.move),to=from+Number(button.dataset.direction);
  renderEditor(moveOpeningMatch(readPlan(),from,to));
  message('Orden de juego actualizado. Guarda el borrador para conservarlo.');
});
$('#knockout-form').addEventListener('input', (e) => { if (e.target.id !== 'knockout-size') updatePreview(); });
$('#knockout-size').addEventListener('change', () => { try { const p = readPlan(), next = seeded(); next.pairs=next.pairs.map((pair,i)=>({...pair,date:p.pairs[0].date,venue:p.pairs[0].venue,time:i===0?p.pairs[0].time:''})); renderEditor({...p,...next,tieRule:p.tieRule,thirdPlace:p.thirdPlace,notes:p.notes}); } catch(e) { $('#knockout-size').value = savedPlan.size; message(e.message,true); } });
$('#print-knockout').addEventListener('click', () => window.print());
$('#knockout-result-forms').addEventListener('submit', async (e) => {
  e.preventDefault(); if (busy) return;
  const form = e.target, result = Object.fromEntries(new FormData(form));
  result.date = savedPlan.pairs[0].date || ''; result.venue = savedPlan.pairs[0].venue || '';
  result.time = Number(form.dataset.result) === 0 ? savedPlan.pairs[0].time || '' : '';
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
