var MatchService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.MATCHES).filter(function (item) {
      return (!params.championshipId || String(item.campeonato_id) === String(params.championshipId)) &&
        (!params.disciplineId || String(item.disciplina_id) === String(params.disciplineId)) &&
        (!params.status || String(item.estado) === String(params.status)) && String(item.estado) !== 'INACTIVE';
    }).map(toMatchResponse).sort(function (a, b) { return a.round - b.round || a.order - b.order; });
    return { items: items, total: items.length };
  },

  post: function (context) {
    var body = context.body || {};
    if (Array.isArray(body.matches)) return createFixture(body);
    return createSingleMatch(body);
  },

  put: function (context) {
    var body = context.body || {};
    if (!body.id || !validateUuid(body.id)) throw appError('VALIDATION_ERROR', 'El id del partido no es válido.', 400);
    var changes = { updated_at: nowIso() };
    var current = listSheetRecords(SHEETS.MATCHES).find(function (item) { return String(item.id) === String(body.id); });
    if (!current) throw appError('NOT_FOUND', 'El partido no existe.', 404);
    if (body.lockRound) return lockMatchRound(current);
    if (isMatchLocked(current)) throw appError('CONFLICT', 'La fecha está cerrada y sus partidos ya no se pueden editar.', 409);
    if (body.walkoverTeamId) {
      if ([String(current.local_id), String(current.visitante_id)].indexOf(String(body.walkoverTeamId)) === -1) throw appError('VALIDATION_ERROR', 'El equipo ausente no pertenece a este partido.', 400);
      body.homeScore = String(body.walkoverTeamId) === String(current.local_id) ? 0 : 3;
      body.awayScore = String(body.walkoverTeamId) === String(current.visitante_id) ? 0 : 3;
      body.closed = false;
    }
    if (body.date !== undefined) changes.fecha = sanitizeText(body.date);
    if (body.time !== undefined) changes.hora = sanitizeText(body.time);
    if (body.venue !== undefined) changes.escenario = sanitizeText(body.venue);
    if (body.homeScore !== undefined && (!Number.isInteger(Number(body.homeScore)) || Number(body.homeScore) < 0)) throw appError('VALIDATION_ERROR', 'El marcador local debe ser un número entero mayor o igual a cero.', 400);
    if (body.awayScore !== undefined && (!Number.isInteger(Number(body.awayScore)) || Number(body.awayScore) < 0)) throw appError('VALIDATION_ERROR', 'El marcador visitante debe ser un número entero mayor o igual a cero.', 400);
    if (body.homeScore !== undefined) changes.marcador_local = Number(body.homeScore);
    if (body.awayScore !== undefined) changes.marcador_visitante = Number(body.awayScore);
    if (body.closed !== undefined) {
      changes.cerrado = Boolean(body.closed); changes.estado = body.closed ? 'FINISHED' : 'SCHEDULED';
      if (body.closed) {
        var homeScore = body.homeScore !== undefined ? Number(body.homeScore) : Number(current.marcador_local);
        var awayScore = body.awayScore !== undefined ? Number(body.awayScore) : Number(current.marcador_visitante);
        changes.ganador_id = homeScore === awayScore ? '' : homeScore > awayScore ? current.local_id : current.visitante_id;
      } else changes.ganador_id = '';
    }
    var metadata = {};
    try { metadata = JSON.parse(current.observaciones || '{}'); } catch (error) { metadata = {}; }
    if (body.order !== undefined) metadata.order = Number(body.order);
    if (body.orderConfirmed !== undefined) metadata.orderConfirmed = Boolean(body.orderConfirmed);
    if (body.walkoverTeamId !== undefined) {
      if (body.walkoverTeamId) metadata.walkover = { absentTeamId: String(body.walkoverTeamId), score: '3-0', registeredAt: nowIso() };
      else delete metadata.walkover;
    }
    if (body.order !== undefined || body.orderConfirmed !== undefined || body.walkoverTeamId !== undefined) changes.observaciones = JSON.stringify(metadata);
    return toMatchResponse(updateSheetRecord(SHEETS.MATCHES, body.id, changes));
  },

  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id del partido no es válido.', 400);
    var current = listSheetRecords(SHEETS.MATCHES).find(function (item) { return String(item.id) === String(id); });
    if (current && isMatchLocked(current)) throw appError('CONFLICT', 'La fecha está cerrada y sus partidos ya no se pueden eliminar.', 409);
    return toMatchResponse(updateSheetRecord(SHEETS.MATCHES, id, { estado: 'INACTIVE', updated_at: nowIso() }));
  }
};

function createFixture(body) {
  if (!validateUuid(body.championshipId) || !validateUuid(body.disciplineId)) throw appError('VALIDATION_ERROR', 'Campeonato o disciplina inválidos.', 400);
  var existing = listSheetRecords(SHEETS.MATCHES).some(function (item) {
    return String(item.campeonato_id) === String(body.championshipId) && String(item.disciplina_id) === String(body.disciplineId) && String(item.estado) !== 'INACTIVE';
  });
  if (existing) throw appError('CONFLICT', 'Esta disciplina ya tiene un fixture guardado.', 409);
  var activeTeamIds = listSheetRecords(SHEETS.TEAMS).filter(function (item) {
    return String(item.campeonato_id) === String(body.championshipId) && String(item.disciplina_id) === String(body.disciplineId) && String(item.estado) !== 'INACTIVE';
  }).map(function (item) { return String(item.id); });
  var timestamp = nowIso();
  var seen = {};
  var records = body.matches.map(function (match) {
    if (!validateUuid(match.homeId) || !validateUuid(match.awayId) || match.homeId === match.awayId) throw appError('VALIDATION_ERROR', 'Hay un enfrentamiento inválido.', 400);
    if (activeTeamIds.indexOf(String(match.homeId)) === -1 || activeTeamIds.indexOf(String(match.awayId)) === -1) throw appError('VALIDATION_ERROR', 'Un equipo del fixture no pertenece a la disciplina.', 400);
    var pairKey = [match.homeId, match.awayId].sort().join('|');
    if (seen[pairKey]) throw appError('VALIDATION_ERROR', 'Hay un enfrentamiento repetido en el fixture.', 400);
    seen[pairKey] = true;
    return {
      id: generateUuid(), campeonato_id: body.championshipId, disciplina_id: body.disciplineId,
      fase: 'GROUP', jornada: Number(match.round), fecha: sanitizeText(match.date || ''), hora: sanitizeText(match.time || ''),
      escenario: sanitizeText(match.venue || ''), local_id: match.homeId, visitante_id: match.awayId,
      marcador_local: '', marcador_visitante: '', ganador_id: '', cerrado: false, estado: 'SCHEDULED',
      created_at: timestamp, updated_at: timestamp, observaciones: JSON.stringify({ order: Number(match.order) || 1 })
    };
  });
  var expected = activeTeamIds.length * (activeTeamIds.length - 1) / 2;
  if (records.length !== expected) throw appError('VALIDATION_ERROR', 'El fixture no contiene todos los enfrentamientos. Se esperaban ' + expected + '.', 400);
  appendSheetRecords(SHEETS.MATCHES, records);
  return { items: records.map(toMatchResponse), total: records.length };
}

function createSingleMatch(body) {
  return createFixture({ championshipId: body.championshipId, disciplineId: body.disciplineId, matches: [body] }).items[0];
}

function toMatchResponse(record) {
  var metadata = {};
  try { metadata = JSON.parse(record.observaciones || '{}'); } catch (error) { metadata = {}; }
  return {
    id: record.id, championshipId: record.campeonato_id, disciplineId: record.disciplina_id,
    phase: record.fase, round: Number(record.jornada), order: Number(metadata.order) || 1, orderConfirmed: Boolean(metadata.orderConfirmed), roundLocked: Boolean(metadata.roundLocked),
    date: formatMatchDate(record.fecha), time: formatMatchTime(record.hora), venue: record.escenario || '',
    homeId: record.local_id, awayId: record.visitante_id,
    homeScore: record.marcador_local === '' ? '' : Number(record.marcador_local), awayScore: record.marcador_visitante === '' ? '' : Number(record.marcador_visitante),
    winnerId: record.ganador_id || '', closed: record.cerrado === true || String(record.cerrado).toLowerCase() === 'true',
    status: record.estado, isWalkover: Boolean(metadata.walkover), walkoverTeamId: metadata.walkover && metadata.walkover.absentTeamId || '', createdAt: record.created_at, updatedAt: record.updated_at
  };
}

function isMatchLocked(record) {
  var metadata = {};
  try { metadata = JSON.parse(record.observaciones || '{}'); } catch (error) { metadata = {}; }
  return Boolean(metadata.roundLocked);
}

function lockMatchRound(current) {
  var roundMatches = listSheetRecords(SHEETS.MATCHES).filter(function (item) {
    return String(item.campeonato_id) === String(current.campeonato_id) && String(item.disciplina_id) === String(current.disciplina_id) && Number(item.jornada) === Number(current.jornada) && String(item.estado) !== 'INACTIVE';
  });
  var incomplete = roundMatches.some(function (item) { return item.marcador_local === '' || item.marcador_visitante === ''; });
  if (incomplete) throw appError('VALIDATION_ERROR', 'Todos los partidos de la fecha deben tener un marcador guardado antes de cerrarla.', 400);
  var timestamp = nowIso();
  var updated = roundMatches.map(function (item) {
    var metadata = {};
    try { metadata = JSON.parse(item.observaciones || '{}'); } catch (error) { metadata = {}; }
    metadata.roundLocked = true;
    metadata.roundLockedAt = timestamp;
    var homeScore = Number(item.marcador_local), awayScore = Number(item.marcador_visitante);
    return updateSheetRecord(SHEETS.MATCHES, item.id, { cerrado: true, estado: 'FINISHED', ganador_id: homeScore === awayScore ? '' : homeScore > awayScore ? item.local_id : item.visitante_id, observaciones: JSON.stringify(metadata), updated_at: timestamp });
  });
  return { items: updated.map(toMatchResponse), total: updated.length, round: Number(current.jornada), locked: true };
}

function formatMatchDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value).slice(0, 10);
}

function formatMatchTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  var text = String(value);
  var isoMatch = text.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return isoMatch[1] + ':' + isoMatch[2];
  return text.slice(0, 5);
}
