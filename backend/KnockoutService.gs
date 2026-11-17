// Las llaves se guardan aparte del fixture de grupos.
var KnockoutService = {
  get: function (context) {
    var p = context.params || {};
    var record = knockoutRecord(p.championshipId, p.disciplineId);
    return record ? knockoutPlanWithActas(record) : null;
  },
  post: function (context) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw validationError('Otro usuario está guardando las llaves. Intenta nuevamente.');
    try { return KnockoutService.savePlan(context); } finally { lock.releaseLock(); }
  },
  savePlan: function (context) {
    var b = context.body || {}, plan = b.plan;
    if (!validateUuid(b.championshipId) || !validateUuid(b.disciplineId)) throw validationError('Selecciona un campeonato y deporte válidos.');
    var record = knockoutRecord(b.championshipId, b.disciplineId);
    var previous = record ? JSON.parse(record.valor) : null;
    if (b.action === 'syncMatches') return syncKnockoutActaMatches(b.championshipId, b.disciplineId);
    if (previous && String(b.revision || '') !== String(previous.revision || '')) throw validationError('Otro usuario modificó las llaves. Actualiza antes de guardar.');
    if (b.action === 'settings' || b.action === 'schedule') return updateKnockoutOptions(b, previous, record);
    if (b.action === 'result') return saveKnockoutResult(b, previous, record);
    var size = plan && Number(plan.size || 8);
    if (!plan || [4,8,16].indexOf(size) < 0 || ['DRAFT', 'CONFIRMED'].indexOf(plan.status) < 0 || !Array.isArray(plan.pairs) || plan.pairs.length !== size / 2) throw validationError('Completa los cruces para 4, 8 o 16 clasificados.');
    var teams = listSheetRecords(SHEETS.TEAMS).filter(function (t) { return String(t.campeonato_id) === b.championshipId && String(t.disciplina_id) === b.disciplineId && ['INACTIVE', 'ELIMINATED'].indexOf(String(t.estado)) < 0; });
    var ids = [];
    plan.pairs.forEach(function (pair) {
      [pair.homeId, pair.awayId].forEach(function (id) {
        if (!teams.some(function (t) { return String(t.id) === id; }) || ids.indexOf(id) >= 0) throw validationError('Selecciona ' + size + ' equipos distintos de este deporte.');
        ids.push(id);
      });
    });
    var stages = knockoutStages(size), sources = knockoutSources(plan);
    stages.slice(1).forEach(function (stage, stageIndex) {
      var previousStage = stages[stageIndex], used = [];
      for (var i = stage.offset; i < stage.offset + stage.count; i++) {
        var pair = sources[i];
        if (!Array.isArray(pair) || pair.length !== 2) throw validationError('Completa las rutas de las llaves.');
        pair.forEach(function (n) {
          if (!Number.isInteger(n) || n < previousStage.offset || n >= previousStage.offset + previousStage.count || used.indexOf(n) >= 0) throw validationError('Cada cruce debe alimentar una sola llave de la siguiente ronda.');
          used.push(n);
        });
      }
    });
    if (previous && previous.status === 'CONFIRMED') throw validationError('Las llaves ya están confirmadas. Esta versión permite preparar y confirmar los cruces, no modificar los oficiales.');
    if (plan.status === 'CONFIRMED') {
      var group = listSheetRecords(SHEETS.MATCHES).filter(function (m) { return String(m.campeonato_id) === b.championshipId && String(m.disciplina_id) === b.disciplineId && String(m.estado) !== 'INACTIVE' && (!m.fase || String(m.fase) === 'GROUP'); });
      if (!group.length || group.some(function (m) { var meta = {}; try { meta = JSON.parse(m.observaciones || '{}'); } catch(e) {} return !meta.roundLocked; })) throw validationError('Cierra todas las fechas de grupos antes de confirmar.');
      if (['PENALTIES', 'MANUAL'].indexOf(plan.tieRule) < 0) throw validationError('Define cómo se resolverán los empates antes de confirmar.');
      if (plan.tieRule === 'MANUAL' && !String(plan.notes || '').trim()) throw validationError('Escribe el acuerdo de desempate en las observaciones.');
    }
    // Solo se persisten campos previstos; nunca se crean resultados automáticamente.
    var saved = { size: size, sources: sources, status: plan.status, pairs: plan.pairs.map(function (p) { return { homeId: p.homeId, awayId: p.awayId, date: sanitizeText(p.date || ''), time: sanitizeText(p.time || ''), venue: sanitizeText(p.venue || '') }; }), tieRule: plan.tieRule || '', thirdPlace: Boolean(plan.thirdPlace), notes: sanitizeText(plan.notes || ''), revision: generateUuid(), updatedAt: nowIso() };
    var fields = { valor: JSON.stringify(saved), updated_at: nowIso() };
    if (record) updateSheetRecord(SHEETS.CONFIGURATION, record.id, fields);
    else appendSheetRecord(SHEETS.CONFIGURATION, { id: generateUuid(), campeonato_id: b.championshipId, disciplina_id: b.disciplineId, clave: 'KNOCKOUT_PLAN', valor: fields.valor, tipo_dato: 'JSON', descripcion: 'Llaves eliminatorias', estado: 'ACTIVE', created_at: nowIso(), updated_at: nowIso(), observaciones: '' });
    return saved;
  }
};
function knockoutRecord(championshipId, disciplineId) {
  return listSheetRecords(SHEETS.CONFIGURATION).find(function (r) { return String(r.campeonato_id) === String(championshipId) && String(r.disciplina_id) === String(disciplineId) && String(r.clave) === 'KNOCKOUT_PLAN' && String(r.estado) !== 'INACTIVE'; });
}
function updateKnockoutOptions(body, plan, record) {
  if (!plan || !record) throw validationError('Prepara primero las llaves desde Partidos.');
  if (body.action === 'settings') {
    if (['PENALTIES','MANUAL'].indexOf(body.tieRule)<0) throw validationError('Selecciona el desempate.');
    if (body.tieRule === 'MANUAL' && !String(body.notes || '').trim()) throw validationError('Escribe el acuerdo de desempate.');
    if (Boolean(body.thirdPlace)!==Boolean(plan.thirdPlace) && (knockoutActaRecords(record).length || Object.keys(plan.results || {}).length)) throw validationError('El tercer puesto no puede cambiar cuando los partidos ya fueron habilitados.');
    plan.tieRule=body.tieRule; plan.notes=sanitizeText(body.notes || ''); plan.thirdPlace=Boolean(body.thirdPlace);
  } else {
    var valid=knockoutStages(plan.size).some(function (s) { return s.offset===Number(body.stageOffset); }) || (plan.thirdPlace && Number(body.stageOffset)===plan.size-1);
    if (!valid) throw validationError('Ronda inválida.');
    var date=sanitizeText(body.date || ''),time=sanitizeText(body.time || ''),venue=sanitizeText(body.venue || '');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw validationError('Fecha inválida.');
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw validationError('Hora inválida.');
    var offset=Number(body.stageOffset), count=offset===plan.size-1?1:knockoutStages(plan.size).filter(function(s){return s.offset===offset;})[0].count;
    var records=knockoutActaRecords(record).filter(function(m){var n=Number(matchMetadata(m).knockoutIndex);return n>=offset&&n<offset+count;});
    if(records.some(function(m){return matchMetadata(m).roundLocked || knockoutMatchHasActivity(m);})) throw validationError('Esta ronda ya tiene actas o resultados. Su programación no puede cambiar.');
    plan.schedules=plan.schedules || {};plan.schedules[offset]={date:date,time:time,venue:venue};
    records.forEach(function(m){updateSheetRecord(SHEETS.MATCHES,m.id,{fecha:date,hora:Number(matchMetadata(m).knockoutIndex)===offset?time:'',escenario:venue,updated_at:nowIso()});});
    if(offset===0)plan.pairs.forEach(function(p,i){p.date=date;p.time=i===0?time:'';p.venue=venue;});
  }
  plan.revision=generateUuid();plan.updatedAt=nowIso();
  updateSheetRecord(SHEETS.CONFIGURATION,record.id,{valor:JSON.stringify(plan),updated_at:plan.updatedAt});
  return knockoutPlanWithActas(knockoutRecord(body.championshipId,body.disciplineId));
}
function knockoutParticipants(plan, index) {
  var size = Number(plan.size || 8), results = plan.results || {};
  if (index < size / 2) return [plan.pairs[index].homeId, plan.pairs[index].awayId];
  if (index < size - 1) return knockoutSources(plan)[index].map(function (n) { return (results[n] || {}).winnerId || ''; });
  return [size - 4,size - 3].map(function (n) { var winner = (results[n] || {}).winnerId; return winner ? knockoutParticipants(plan, n).filter(function (id) { return id !== winner; })[0] : ''; });
}
function knockoutStages(size) {
  var stages = [], offset = 0;
  for (var count = size / 2; count >= 1; count /= 2) { stages.push({ count: count, offset: offset }); offset += count; }
  return stages;
}
function knockoutSources(plan) {
  if (plan.sources) return plan.sources;
  var result = {}, stages = knockoutStages(Number(plan.size || 8));
  stages.slice(1).forEach(function (stage, index) {
    var previous = stages[index];
    for (var i = 0; i < stage.count; i++) result[stage.offset + i] = index === 0 && plan.semifinals ? plan.semifinals[i] : [previous.offset + i * 2, previous.offset + i * 2 + 1];
  });
  return result;
}
function saveKnockoutResult(body, plan, record) {
  if (knockoutActaRecords(record).length) throw validationError('Registra este resultado desde Resultados y su acta digital.');
  if (!plan || plan.status !== 'CONFIRMED') throw validationError('Confirma primero los cruces.');
  var index = Number(body.matchIndex), result = body.result || {};
  var size = Number(plan.size || 8);
  if (!Number.isInteger(index) || index < 0 || index > (plan.thirdPlace ? size - 1 : size - 2)) throw validationError('Partido inválido.');
  var participants = knockoutParticipants(plan, index);
  if (participants.some(function (id) { return !id; })) throw validationError('Registra primero los ganadores de la ronda anterior.');
  var home = Number(result.homeScore), away = Number(result.awayScore);
  if (result.homeScore === '' || result.awayScore === '' || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) throw validationError('Completa ambos marcadores con enteros no negativos.');
  var winner = home > away ? participants[0] : away > home ? participants[1] : result.winnerId;
  if (participants.indexOf(winner) < 0) throw validationError('Selecciona el ganador del desempate.');
  if (home === away && !String(result.notes || '').trim()) throw validationError('Explica el desempate (por ejemplo: penales 4–3).');
  plan.results = plan.results || {};
  var old = plan.results[index];
  if (old && old.winnerId !== winner) {
    var sources = knockoutSources(plan);
    var dependent = Object.keys(sources).filter(function (key) { return sources[key].indexOf(index) >= 0; }).map(Number);
    if (plan.thirdPlace && [size - 4,size - 3].indexOf(index) >= 0) dependent.push(size - 1);
    if (dependent.some(function (n) { return plan.results[n]; })) throw validationError('No puedes cambiar al ganador: ya hay resultados en la ronda siguiente.');
  }
  plan.results[index] = { homeScore: home, awayScore: away, winnerId: winner, notes: sanitizeText(result.notes || ''), date: sanitizeText(result.date || ''), time: sanitizeText(result.time || ''), venue: sanitizeText(result.venue || '') };
  plan.revision = generateUuid(); plan.updatedAt = nowIso();
  updateSheetRecord(SHEETS.CONFIGURATION, record.id, { valor: JSON.stringify(plan), updated_at: plan.updatedAt });
  return plan;
}

// Adaptación de las llaves a PARTIDOS: se reutilizan EVENTOS y ACTAS habituales.
function knockoutActaRecords(record) {
  if (!record) return [];
  return listSheetRecords(SHEETS.MATCHES).filter(function (m) { return String(m.estado) !== 'INACTIVE' && String(m.fase) === 'KNOCKOUT' && String(matchMetadata(m).knockoutPlanId) === String(record.id); });
}
function knockoutPlanWithActas(record) {
  var plan = JSON.parse(record.valor), records = knockoutActaRecords(record);
  plan.results = plan.results || {}; plan.matchIds = {};
  records.sort(function (a,b) { return Number(matchMetadata(a).knockoutIndex) - Number(matchMetadata(b).knockoutIndex); }).forEach(function (m) {
    var meta = matchMetadata(m), index = Number(meta.knockoutIndex);
    plan.matchIds[index] = m.id;
    delete plan.results[index];
    var ids = knockoutParticipants(plan,index);
    if ((m.cerrado === true || String(m.cerrado) === 'true') && m.ganador_id && ids[0] === String(m.local_id) && ids[1] === String(m.visitante_id)) {
      plan.results[index] = { homeScore: Number(m.marcador_local), awayScore: Number(m.marcador_visitante), winnerId: String(m.ganador_id), notes: meta.knockoutTieNotes || '', date: formatMatchDate(m.fecha), time: formatMatchTime(m.hora), venue: m.escenario || '' };
    }
  });
  return plan;
}
function knockoutStageDetails(size,index) {
  var rounds = knockoutStages(size), round = rounds.find(function (r) { return index >= r.offset && index < r.offset+r.count; });
  if (!round) return { name: 'Tercer puesto', stage: rounds.length, order: 1, count: 1 };
  return { name: round.count === 8 ? 'Octavos de final' : round.count === 4 ? 'Cuartos de final' : round.count === 2 ? 'Semifinales' : 'Final', stage: rounds.indexOf(round), order: index-round.offset+1, count: round.count };
}
function syncKnockoutActaMatches(championshipId,disciplineId) {
  var record = knockoutRecord(championshipId,disciplineId);
  if (!record) throw validationError('No hay llaves preparadas.');
  var plan = knockoutPlanWithActas(record);
  if (plan.status !== 'CONFIRMED') throw validationError('Confirma primero las eliminatorias.');
  var records = knockoutActaRecords(record), size = Number(plan.size || 8), created = [];
  var group = listSheetRecords(SHEETS.MATCHES).filter(function (m) { return String(m.campeonato_id) === String(championshipId) && String(m.disciplina_id) === String(disciplineId) && (!m.fase || String(m.fase) === 'GROUP') && String(m.estado) !== 'INACTIVE'; });
  if (!group.length || group.some(function (m) { return !matchMetadata(m).roundLocked; })) throw validationError('Cierra todas las fechas de grupos antes de habilitar las actas de eliminatorias.');
  var baseRound = group.reduce(function (max,m) { return Math.max(max,Number(m.jornada || 0)); },0)+1;
  for(var index=0;index<(plan.thirdPlace?size:size-1);index++) {
    var ids = knockoutParticipants(plan,index);
    if (ids.some(function (id) { return !id; })) continue;
    var current = records.find(function (m) { return Number(matchMetadata(m).knockoutIndex) === index; });
    if (current) {
      if (String(current.local_id) !== ids[0] || String(current.visitante_id) !== ids[1]) {
        if (knockoutMatchHasActivity(current)) throw validationError('La siguiente ronda ya tiene un acta registrada. No se pueden cambiar sus equipos.');
        updateSheetRecord(SHEETS.MATCHES,current.id,{local_id:ids[0],visitante_id:ids[1],updated_at:nowIso()});
      }
      continue;
    }
    var stage=knockoutStageDetails(size,index), offset=index-stage.order+1, schedule=(plan.schedules || {})[offset] || (stage.stage===0?plan.pairs[0]:{}) || {}, old=plan.results[index], timestamp=nowIso();
    var item={id:generateUuid(),campeonato_id:championshipId,disciplina_id:disciplineId,fase:'KNOCKOUT',jornada:baseRound+stage.stage,fecha:schedule.date || '',hora:stage.order===1?schedule.time || '':'',escenario:schedule.venue || '',local_id:ids[0],visitante_id:ids[1],marcador_local:old?old.homeScore:'',marcador_visitante:old?old.awayScore:'',ganador_id:old?old.winnerId:'',cerrado:Boolean(old),estado:old?'FINISHED':'SCHEDULED',created_at:timestamp,updated_at:timestamp,observaciones:JSON.stringify({knockoutPlanId:record.id,knockoutIndex:index,roundLabel:stage.name,order:stage.order,orderConfirmed:true,knockoutTieNotes:old?old.notes || '':'',legacyScore:Boolean(old)})};
    appendSheetRecord(SHEETS.MATCHES,item); records.push(item); created.push(item.id);
  }
  return { plan: knockoutPlanWithActas(record), createdIds:created, items:knockoutActaRecords(record).map(toMatchResponse) };
}
function knockoutMatchHasActivity(match) {
  if (match.marcador_local !== '' || match.marcador_visitante !== '' || match.cerrado === true || String(match.cerrado) === 'true') return true;
  return listSheetRecords(SHEETS.EVENTS).some(function (e) { return String(e.partido_id) === String(match.id) && String(e.estado) !== 'INACTIVE'; }) || listSheetRecords(SHEETS.MINUTES).some(function (a) { return String(a.partido_id) === String(match.id) && String(a.estado) !== 'INACTIVE'; });
}
function assertKnockoutCanEdit(match) {
  if (String(match.fase) !== 'KNOCKOUT') return;
  var record=knockoutRecord(match.campeonato_id,match.disciplina_id), plan=record && knockoutPlanWithActas(record), index=Number(matchMetadata(match).knockoutIndex);
  if (!plan) throw validationError('No se encontró la llave del partido.');
  var ids=knockoutParticipants(plan,index);
  if (ids[0] !== String(match.local_id) || ids[1] !== String(match.visitante_id)) throw validationError('Cierra la ronda anterior para habilitar este partido.');
  var dependencies=knockoutSources(plan), dependent=Object.keys(dependencies).filter(function (key) { return dependencies[key].indexOf(index) >= 0; }).map(Number), size=Number(plan.size || 8);
  if (plan.thirdPlace && [size-4,size-3].indexOf(index)>=0) dependent.push(size-1);
  if (knockoutActaRecords(record).some(function (m) { return dependent.indexOf(Number(matchMetadata(m).knockoutIndex))>=0 && knockoutMatchHasActivity(m); })) throw validationError('La siguiente ronda ya tiene registros. No se puede modificar el acta de origen.');
}
function updateKnockoutMatch(current,body) {
  if (body.lockRound) return lockMatchRound(current);
  if (body.unlockRound) return unlockMatchRound(current);
  assertKnockoutCanEdit(current);
  if (isMatchLocked(current)) throw validationError('Reabre la ronda para corregir su acta.');
  var metadata=matchMetadata(current), changes={updated_at:nowIso()};
  var home=body.homeScore !== undefined?Number(body.homeScore):current.marcador_local, away=body.awayScore !== undefined?Number(body.awayScore):current.marcador_visitante;
  if (body.walkoverTeamId) {
    if ([String(current.local_id),String(current.visitante_id)].indexOf(String(body.walkoverTeamId))<0) throw validationError('El equipo ausente no participa en este partido.');
    home=String(body.walkoverTeamId)===String(current.local_id)?0:3; away=3-home;
    metadata.walkover={absentTeamId:body.walkoverTeamId,registeredAt:nowIso()};
  } else if (body.walkoverTeamId !== undefined) delete metadata.walkover;
  if (body.homeScore !== undefined || body.awayScore !== undefined || body.walkoverTeamId) {
    if (home === '' || away === '' || !Number.isInteger(home) || !Number.isInteger(away) || home<0 || away<0) throw validationError('Completa el marcador con enteros no negativos.');
    var winner=home>away?String(current.local_id):away>home?String(current.visitante_id):String(body.knockoutWinnerId || '');
    var notes=sanitizeText(body.knockoutTieNotes || '');
    if (home===away && ([String(current.local_id),String(current.visitante_id)].indexOf(winner)<0 || !notes.trim())) throw validationError('Indica el ganador y explica el desempate.');
    changes.marcador_local=home; changes.marcador_visitante=away; changes.ganador_id=winner;
    metadata.knockoutTieNotes=notes;
  }
  if (body.date !== undefined) changes.fecha=sanitizeText(body.date);
  if (body.time !== undefined) changes.hora=sanitizeText(body.time);
  if (body.venue !== undefined) changes.escenario=sanitizeText(body.venue);
  if (body.closed === true && (home === '' || away === '' || (Number(home)===Number(away) && !(changes.ganador_id || current.ganador_id)))) throw validationError('Completa el marcador y el ganador antes de finalizar.');
  if (body.closed !== undefined) {changes.cerrado=Boolean(body.closed);changes.estado=body.closed?'FINISHED':'SCHEDULED';}
  changes.observaciones=JSON.stringify(metadata);
  return toMatchResponse(updateSheetRecord(SHEETS.MATCHES,current.id,changes));
}
