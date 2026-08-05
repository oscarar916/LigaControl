var EventService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.EVENTS).filter(function (item) {
      return (!params.matchId || String(item.partido_id) === String(params.matchId)) &&
        (!params.type || String(item.tipo) === String(params.type)) && String(item.estado) !== 'INACTIVE';
    }).map(toEventResponse);
    return { items: items, total: items.length };
  },
  post: function (context) {
    var body = context.body || {};
    var matchId = sanitizeText(body.matchId); var teamId = sanitizeText(body.teamId);
    var playerId = sanitizeText(body.playerId); var type = sanitizeText(body.type).toUpperCase();
    if (!validateUuid(matchId) || !validateUuid(teamId) || !validateUuid(playerId)) throw appError('VALIDATION_ERROR', 'Partido, equipo o jugador inválido.', 400);
    if (['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD'].indexOf(type) === -1) throw appError('VALIDATION_ERROR', 'Tipo de evento no permitido.', 400);
    var match = listSheetRecords(SHEETS.MATCHES).find(function (item) { return String(item.id) === matchId && String(item.estado) !== 'INACTIVE'; });
    if (!match || (String(match.local_id) !== teamId && String(match.visitante_id) !== teamId)) throw appError('VALIDATION_ERROR', 'El equipo no participa en este partido.', 400);
    if (isMatchLocked(match)) throw appError('CONFLICT', 'La fecha está cerrada y sus incidencias ya no se pueden editar.', 409);
    var player = listSheetRecords(SHEETS.PLAYERS).find(function (item) { return String(item.id) === playerId && String(item.equipo_id) === teamId && String(item.estado) !== 'INACTIVE'; });
    if (!player) throw appError('VALIDATION_ERROR', 'El jugador no pertenece al equipo seleccionado.', 400);
    var timestamp = nowIso();
    var record = { id: generateUuid(), partido_id: matchId, equipo_id: teamId, jugador_id: playerId, created_by: '', tipo: type, minuto: body.minute === '' || body.minute === undefined ? '' : Number(body.minute), detalle: sanitizeText(body.detail || ''), estado: 'ACTIVE', created_at: timestamp, updated_at: timestamp, observaciones: '' };
    appendSheetRecord(SHEETS.EVENTS, record);
    createSanctionForEvent(record, match);
    return toEventResponse(record);
  },
  put: function () { throw appError('METHOD_NOT_ALLOWED', 'Los eventos no se editan; deben anularse y registrarse nuevamente.', 405); },
  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id del evento no es válido.', 400);
    var current = listSheetRecords(SHEETS.EVENTS).find(function (item) { return String(item.id) === String(id); });
    var match = current && listSheetRecords(SHEETS.MATCHES).find(function (item) { return String(item.id) === String(current.partido_id); });
    if (match && isMatchLocked(match)) throw appError('CONFLICT', 'La fecha está cerrada y sus incidencias ya no se pueden editar.', 409);
    var result = updateSheetRecord(SHEETS.EVENTS, id, { estado: 'INACTIVE', updated_at: nowIso() });
    deactivateSanctionForEvent(id);
    return toEventResponse(result);
  }
};

function toEventResponse(record) {
  return { id: record.id, matchId: record.partido_id, teamId: record.equipo_id, playerId: record.jugador_id, type: record.tipo, minute: record.minuto === '' ? '' : Number(record.minuto), detail: record.detalle || '', status: record.estado, createdAt: record.created_at };
}
