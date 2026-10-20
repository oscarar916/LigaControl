// Las llaves se guardan aparte del fixture de grupos.
var KnockoutService = {
  get: function (context) {
    var p = context.params || {};
    var record = knockoutRecord(p.championshipId, p.disciplineId);
    return record ? JSON.parse(record.valor) : null;
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
    if (previous && String(b.revision || '') !== String(previous.revision || '')) throw validationError('Otro usuario modificó las llaves. Actualiza antes de guardar.');
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
