var ResultsBootstrapService = {
  get: function (context) {
    var params = context.params || {};
    var championshipId = sanitizeText(params.championshipId || '');
    var disciplineId = sanitizeText(params.disciplineId || '');
    if (!validateUuid(championshipId) || !validateUuid(disciplineId)) throw appError('VALIDATION_ERROR', 'Selecciona nuevamente el campeonato y el deporte.', 400);

    var championships = listSheetRecords(SHEETS.CHAMPIONSHIPS).filter(function (item) { return String(item.id) === championshipId && String(item.estado) !== 'INACTIVE'; }).map(toChampionshipResponse);
    var disciplines = listSheetRecords(SHEETS.DISCIPLINES).filter(function (item) { return String(item.campeonato_id) === championshipId && String(item.estado) !== 'INACTIVE'; }).map(toDisciplineResponse);
    var teams = listSheetRecords(SHEETS.TEAMS).filter(function (item) { return String(item.campeonato_id) === championshipId && String(item.disciplina_id) === disciplineId && String(item.estado) !== 'INACTIVE'; }).map(toTeamResponse);
    var teamIds = teams.map(function (item) { return String(item.id); });
    var matches = listSheetRecords(SHEETS.MATCHES).filter(function (item) { return String(item.campeonato_id) === championshipId && String(item.disciplina_id) === disciplineId && String(item.estado) !== 'INACTIVE'; }).map(toMatchResponse).sort(function (a, b) { return a.round - b.round || a.order - b.order; });
    var matchIds = matches.map(function (item) { return String(item.id); });
    var players = listSheetRecords(SHEETS.PLAYERS).filter(function (item) { return teamIds.indexOf(String(item.equipo_id)) !== -1 && String(item.estado) !== 'INACTIVE'; }).map(toPlayerResponse);
    var events = listSheetRecords(SHEETS.EVENTS).filter(function (item) { return matchIds.indexOf(String(item.partido_id)) !== -1 && String(item.estado) !== 'INACTIVE'; }).map(toEventResponse);
    var minutes = listSheetRecords(SHEETS.MINUTES).filter(function (item) { return matchIds.indexOf(String(item.partido_id)) !== -1 && String(item.estado) !== 'INACTIVE'; }).map(toMinuteResponse);
    var sanctions = listSheetRecords(SHEETS.SANCTIONS).filter(function (item) { return String(item.campeonato_id) === championshipId && String(item.estado) !== 'INACTIVE'; }).map(toSanctionResponse);
    var payments = listSheetRecords(SHEETS.PAYMENTS).filter(function (item) { return String(item.campeonato_id) === championshipId && String(item.estado) !== 'INACTIVE'; }).map(toPaymentResponse);

    return { championships: championships, disciplines: disciplines, teams: teams, matches: matches, players: players, events: events, minutes: minutes, sanctions: sanctions, payments: payments };
  }
};
