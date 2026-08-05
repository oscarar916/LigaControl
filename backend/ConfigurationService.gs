var SANCTION_DEFAULTS = { YELLOW_CARD_COST: 10, RED_CARD_COST: 20, YELLOW_CARDS_FOR_SUSPENSION: 2, YELLOW_SUSPENSION_MATCHES: 1, RED_SUSPENSION_MATCHES: 2, RED_CARDS_FOR_EXPULSION: 2 };
var ConfigurationService = {
  get: function (context) {
    var params = context.params || {}, items = listSheetRecords(SHEETS.CONFIGURATION).filter(function (item) { return (!params.championshipId || String(item.campeonato_id) === String(params.championshipId)) && (!params.disciplineId || !item.disciplina_id || String(item.disciplina_id) === String(params.disciplineId)) && String(item.estado) !== 'INACTIVE'; }), settings = {};
    Object.keys(SANCTION_DEFAULTS).forEach(function (key) { settings[key] = SANCTION_DEFAULTS[key]; });
    items.forEach(function (item) { settings[String(item.clave)] = Number(item.valor); });
    return { settings: settings, items: items, total: items.length };
  },
  post: function (context) {
    var body = context.body || {}, championshipId = sanitizeText(body.championshipId || ''), disciplineId = sanitizeText(body.disciplineId || ''), incoming = body.settings || {}, timestamp = nowIso();
    if (!validateUuid(championshipId)) throw appError('VALIDATION_ERROR', 'El campeonato no es válido.', 400);
    Object.keys(SANCTION_DEFAULTS).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(incoming, key)) return;
      var value = Number(incoming[key]);
      if (!isFinite(value) || value < 0) throw appError('VALIDATION_ERROR', 'La regla ' + key + ' no es válida.', 400);
      var current = listSheetRecords(SHEETS.CONFIGURATION).find(function (item) { return String(item.campeonato_id) === championshipId && String(item.disciplina_id || '') === disciplineId && String(item.clave) === key && String(item.estado) !== 'INACTIVE'; });
      if (current) updateSheetRecord(SHEETS.CONFIGURATION, current.id, { valor: value, updated_at: timestamp });
      else appendSheetRecord(SHEETS.CONFIGURATION, { id: generateUuid(), campeonato_id: championshipId, disciplina_id: disciplineId, clave: key, valor: value, tipo_dato: 'NUMBER', descripcion: sanctionSettingDescription(key), estado: 'ACTIVE', created_at: timestamp, updated_at: timestamp, observaciones: '' });
    });
    return ConfigurationService.get({ params: { championshipId: championshipId, disciplineId: disciplineId } });
  }
};
function sanctionSettingDescription(key) { return ({ YELLOW_CARD_COST: 'Costo por tarjeta amarilla', RED_CARD_COST: 'Costo por tarjeta roja', YELLOW_CARDS_FOR_SUSPENSION: 'Amarillas acumuladas para suspensión', YELLOW_SUSPENSION_MATCHES: 'Fechas de suspensión por amarillas', RED_SUSPENSION_MATCHES: 'Fechas de suspensión por roja directa', RED_CARDS_FOR_EXPULSION: 'Rojas acumuladas para expulsión' })[key] || key; }
function getSanctionSettings(championshipId, disciplineId) { return ConfigurationService.get({ params: { championshipId: championshipId, disciplineId: disciplineId } }).settings; }
