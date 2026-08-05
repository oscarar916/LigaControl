var MinuteService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.MINUTES).filter(function (item) {
      return (!params.matchId || String(item.partido_id) === String(params.matchId)) &&
        String(item.estado) !== 'INACTIVE';
    }).map(toMinuteResponse);
    return { items: items, total: items.length };
  },

  post: function (context) {
    var body = context.body || {};
    var matchId = sanitizeText(body.matchId || body.partido_id || '');
    var observations = sanitizeText(body.observations || body.observaciones || '');
    if (!matchId || !validateUuid(matchId)) throw appError('VALIDATION_ERROR', 'El partido no es válido.', 400);
    if (observations.length > 2000) throw appError('VALIDATION_ERROR', 'La observación no puede superar 2000 caracteres.', 400);
    var matchExists = listSheetRecords(SHEETS.MATCHES).some(function (item) {
      return String(item.id) === matchId && String(item.estado) !== 'INACTIVE';
    });
    if (!matchExists) throw appError('NOT_FOUND', 'El partido seleccionado no existe.', 404);
    var match = listSheetRecords(SHEETS.MATCHES).find(function (item) { return String(item.id) === matchId; });
    if (isMatchLocked(match)) throw appError('CONFLICT', 'La fecha está cerrada y el acta ya no se puede editar.', 409);
    var homeLineup = normalizeLineup(body.homeLineup, String(match.local_id || ''));
    var awayLineup = normalizeLineup(body.awayLineup, String(match.visitante_id || ''));
    var current = listSheetRecords(SHEETS.MINUTES).find(function (item) {
      return String(item.partido_id) === matchId && String(item.estado) !== 'INACTIVE';
    });
    var timestamp = nowIso();
    if (current) {
      var nextVersion = Number(current.version || 1) + 1;
      var changes = { observaciones: observations, version: nextVersion, updated_at: timestamp };
      if (homeLineup !== null) changes.alineacion_local = JSON.stringify(homeLineup);
      if (awayLineup !== null) changes.alineacion_visitante = JSON.stringify(awayLineup);
      return toMinuteResponse(updateSheetRecord(SHEETS.MINUTES, current.id, changes));
    }
    var record = {
      id: generateUuid(), partido_id: matchId, archivo_url: '', version: 1,
      firma_local_url: '', firma_visitante_url: '', created_by: '', estado: 'ACTIVE',
      created_at: timestamp, updated_at: timestamp, observaciones: observations,
      alineacion_local: JSON.stringify(homeLineup || []), alineacion_visitante: JSON.stringify(awayLineup || [])
    };
    appendSheetRecord(SHEETS.MINUTES, record);
    return toMinuteResponse(record);
  }
};

function toMinuteResponse(record) {
  return {
    id: record.id, matchId: record.partido_id, observations: record.observaciones || '',
    homeLineup: parseLineup(record.alineacion_local), awayLineup: parseLineup(record.alineacion_visitante),
    version: Number(record.version || 1), status: record.estado,
    createdAt: record.created_at, updatedAt: record.updated_at
  };
}

function normalizeLineup(value, teamId) {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw appError('VALIDATION_ERROR', 'La alineación no es válida.', 400);
  var seen = {}, usedSlots = {};
  var activePlayers = listSheetRecords(SHEETS.PLAYERS).filter(function (item) {
    return String(item.equipo_id) === teamId && String(item.estado) !== 'INACTIVE';
  });
  var result = value.map(function (item) {
    var playerId = sanitizeText(item.playerId || '');
    var role = sanitizeText(item.role || '').toUpperCase();
    var slot = Number(item.slot);
    if (!playerId || seen[playerId] || ['TITULAR', 'SUPLENTE'].indexOf(role) === -1) throw appError('VALIDATION_ERROR', 'Hay jugadores repetidos o con una condición inválida.', 400);
    var maxSlots = role === 'TITULAR' ? 6 : 4;
    if (!Number.isInteger(slot) || slot < 1 || slot > maxSlots || usedSlots[role + slot]) throw appError('VALIDATION_ERROR', 'Hay una posición de alineación inválida o repetida.', 400);
    if (!activePlayers.some(function (player) { return String(player.id) === playerId; })) throw appError('VALIDATION_ERROR', 'Un jugador no pertenece al equipo del partido.', 400);
    seen[playerId] = true; usedSlots[role + slot] = true;
    return { playerId: playerId, role: role, slot: slot };
  });
  if (result.filter(function (item) { return item.role === 'TITULAR'; }).length > 6) throw appError('VALIDATION_ERROR', 'Fulbito permite como máximo 6 titulares.', 400);
  if (result.filter(function (item) { return item.role === 'SUPLENTE'; }).length > 4) throw appError('VALIDATION_ERROR', 'El acta permite como máximo 4 suplentes.', 400);
  return result;
}

function parseLineup(value) {
  if (!value) return [];
  try { var parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : []; }
  catch (error) { return []; }
}
