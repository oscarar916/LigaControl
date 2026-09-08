var SanctionService = {
  get: function (context) {
    var p = context.params || {};
    var items = listSheetRecords(SHEETS.SANCTIONS).filter(function (x) { return (!p.championshipId || String(x.campeonato_id) === String(p.championshipId)) && (!p.teamId || String(x.equipo_id) === String(p.teamId)) && (!p.playerId || String(x.jugador_id) === String(p.playerId)) && String(x.estado) !== 'INACTIVE'; }).map(toSanctionResponse);
    return { items: items, total: items.length };
  },
  post: function (context) {
    var championshipId = sanitizeText((context.body || {}).championshipId || '');
    if (!championshipId) throw validationError('El campeonato es obligatorio.');
    var matches = listSheetRecords(SHEETS.MATCHES);
    listSheetRecords(SHEETS.EVENTS).filter(function (event) {
      return ['YELLOW_CARD', 'RED_CARD'].indexOf(String(event.tipo)) !== -1 && String(event.estado) !== 'INACTIVE';
    }).forEach(function (event) {
      var match = matches.find(function (candidate) { return String(candidate.id) === String(event.partido_id); });
      if (match && String(match.campeonato_id) === String(championshipId)) createSanctionForEvent(event, match);
    });
    return SanctionService.get({ params: { championshipId: championshipId } });
  }
};
function createSanctionForEvent(eventRecord, match) {
  if (['YELLOW_CARD', 'RED_CARD'].indexOf(String(eventRecord.tipo)) === -1) return null;
  var settings = getSanctionSettings(String(match.campeonato_id), String(match.disciplina_id));
  var matches = listSheetRecords(SHEETS.MATCHES), playerCards = listSheetRecords(SHEETS.EVENTS).filter(function (x) { if (String(x.jugador_id) !== String(eventRecord.jugador_id) || String(x.tipo) !== String(eventRecord.tipo) || String(x.estado) === 'INACTIVE') return false; var m = matches.find(function (candidate) { return String(candidate.id) === String(x.partido_id); }); return m && String(m.campeonato_id) === String(match.campeonato_id) && String(m.disciplina_id) === String(match.disciplina_id); }).sort(function (a, b) { return String(a.created_at || '').localeCompare(String(b.created_at || '')); });
  var eventIndex = playerCards.findIndex(function (x) { return String(x.id) === String(eventRecord.id); });
  var yellow = eventRecord.tipo === 'YELLOW_CARD';
  var count = yellow ? consecutiveYellowRounds(match, playerCards, matches) : eventIndex >= 0 ? eventIndex + 1 : playerCards.length;
  var suspension = yellow && count % Number(settings.YELLOW_CARDS_FOR_SUSPENSION || 2) === 0 ? Number(settings.YELLOW_SUSPENSION_MATCHES || 1) : yellow ? 0 : Number(settings.RED_SUSPENSION_MATCHES || 2), expelled = !yellow && count >= Number(settings.RED_CARDS_FOR_EXPULSION || 2), amount = Number(yellow ? settings.YELLOW_CARD_COST : settings.RED_CARD_COST), timestamp = nowIso();
  var reason = expelled ? 'Expulsión por acumulación de tarjetas rojas' : yellow && suspension ? 'Acumulación de tarjetas amarillas' : yellow ? 'Tarjeta amarilla' : 'Tarjeta roja directa';
  var metadata = yellow ? { consecutiveCards: count } : { accumulatedCards: count };
  var duplicate = listSheetRecords(SHEETS.SANCTIONS).find(function (x) { return String(x.evento_id) === String(eventRecord.id) && String(x.estado) !== 'INACTIVE'; });
  if (duplicate) {
    var effectiveType = expelled ? 'EXPULSION' : eventRecord.tipo;
    var unchanged = String(duplicate.tipo) === String(effectiveType) && String(duplicate.motivo) === String(reason) && Number(duplicate.fechas_suspension || 0) === Number(suspension) && Number(duplicate.monto || 0) === Number(amount);
    if (unchanged) return duplicate;
    return updateSheetRecord(SHEETS.SANCTIONS, duplicate.id, { tipo: effectiveType, motivo: reason, fechas_suspension: suspension, monto: amount, observaciones: JSON.stringify(metadata), updated_at: timestamp });
  }
  var record = { id: generateUuid(), campeonato_id: match.campeonato_id, evento_id: eventRecord.id, equipo_id: eventRecord.equipo_id, jugador_id: eventRecord.jugador_id, tipo: expelled ? 'EXPULSION' : eventRecord.tipo, motivo: reason, fechas_suspension: suspension, monto: amount, fecha_inicio: match.fecha || '', fecha_fin: '', estado: 'ACTIVE', created_at: timestamp, updated_at: timestamp, observaciones: JSON.stringify(metadata) };
  appendSheetRecord(SHEETS.SANCTIONS, record); createPendingPayment(record); return record;
}
function consecutiveYellowRounds(currentMatch, playerCards, matches) {
  var currentRound = Number(currentMatch.jornada || 0);
  var rounds = playerCards.map(function (card) {
    var cardMatch = matches.find(function (candidate) { return String(candidate.id) === String(card.partido_id); });
    return cardMatch ? Number(cardMatch.jornada || 0) : 0;
  }).filter(function (round) { return round > 0 && round <= currentRound; }).filter(function (round, index, values) { return values.indexOf(round) === index; }).sort(function (a, b) { return a - b; });
  if (rounds.indexOf(currentRound) === -1) rounds.push(currentRound);
  var streak = 1;
  for (var index = rounds.length - 1; index > 0 && rounds[index - 1] === rounds[index] - 1; index -= 1) streak += 1;
  return streak;
}
function deactivateSanctionForEvent(eventId) { listSheetRecords(SHEETS.SANCTIONS).filter(function (x) { return String(x.evento_id) === String(eventId) && String(x.estado) !== 'INACTIVE'; }).forEach(function (sanction) { updateSheetRecord(SHEETS.SANCTIONS, sanction.id, { estado: 'INACTIVE', updated_at: nowIso() }); listSheetRecords(SHEETS.PAYMENTS).filter(function (p) { return String(p.sancion_id) === String(sanction.id) && String(p.estado) !== 'INACTIVE'; }).forEach(function (p) { updateSheetRecord(SHEETS.PAYMENTS, p.id, { estado: 'INACTIVE', updated_at: nowIso() }); }); }); }
function toSanctionResponse(x) { return { id: x.id, championshipId: x.campeonato_id, eventId: x.evento_id, teamId: x.equipo_id, playerId: x.jugador_id, type: x.tipo, reason: x.motivo, suspensionMatches: Number(x.fechas_suspension || 0), amount: Number(x.monto || 0), startDate: x.fecha_inicio || '', endDate: x.fecha_fin || '', status: x.estado, createdAt: x.created_at }; }
