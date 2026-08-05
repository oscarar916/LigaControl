var TeamService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.TEAMS).filter(function (item) {
      return (!params.championshipId || String(item.campeonato_id) === String(params.championshipId)) &&
        (!params.disciplineId || String(item.disciplina_id) === String(params.disciplineId)) &&
        (!params.status || String(item.estado) === String(params.status));
    }).map(toTeamResponse);
    return { items: items, total: items.length };
  },

  post: function (context) {
    var input = normalizeTeamInput(context.body || {});
    var required = validateRequiredFields(input, ['campeonato_id', 'disciplina_id', 'nombre']);
    if (!required.valid) throw appError('VALIDATION_ERROR', 'Faltan campos obligatorios: ' + required.missing.join(', ') + '.', 400);
    if (!validateUuid(input.campeonato_id) || !validateUuid(input.disciplina_id)) throw appError('VALIDATION_ERROR', 'El campeonato o la disciplina no son válidos.', 400);
    validateTeamRelations(input.campeonato_id, input.disciplina_id);
    var duplicate = listSheetRecords(SHEETS.TEAMS).some(function (item) {
      return String(item.campeonato_id) === input.campeonato_id && String(item.disciplina_id) === input.disciplina_id &&
        normalizeKey(item.nombre) === normalizeKey(input.nombre) && String(item.estado) !== 'INACTIVE';
    });
    if (duplicate) throw appError('CONFLICT', 'Ya existe un equipo con ese nombre en el campeonato.', 409);
    var timestamp = nowIso();
    var record = {
      id: generateUuid(), campeonato_id: input.campeonato_id, disciplina_id: input.disciplina_id,
      nombre: input.nombre, delegado: input.delegado, telefono: input.telefono,
      uniforme: input.uniforme, logo_url: input.logo_url, estado: 'ACTIVE',
      created_at: timestamp, updated_at: timestamp, observaciones: input.observaciones
    };
    appendSheetRecord(SHEETS.TEAMS, record);
    return toTeamResponse(record);
  },

  put: function (context) {
    var body = context.body || {};
    if (!body.id || !validateUuid(body.id)) throw appError('VALIDATION_ERROR', 'El id del equipo no es válido.', 400);
    var input = normalizeTeamInput(body, true);
    var changes = { updated_at: nowIso() };
    Object.keys(input).forEach(function (key) { if (input[key] !== undefined) changes[key] = input[key]; });
    return toTeamResponse(updateSheetRecord(SHEETS.TEAMS, body.id, changes));
  },

  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id del equipo no es válido.', 400);
    return toTeamResponse(updateSheetRecord(SHEETS.TEAMS, id, { estado: 'INACTIVE', updated_at: nowIso() }));
  }
};

function normalizeTeamInput(body, partial) {
  function value(apiName, sheetName) {
    if (Object.prototype.hasOwnProperty.call(body, apiName)) return body[apiName];
    if (Object.prototype.hasOwnProperty.call(body, sheetName)) return body[sheetName];
    return partial ? undefined : '';
  }
  var result = {
    campeonato_id: value('championshipId', 'campeonato_id'), disciplina_id: value('disciplineId', 'disciplina_id'),
    nombre: value('name', 'nombre'), delegado: value('delegate', 'delegado'), telefono: value('phone', 'telefono'),
    uniforme: value('uniform', 'uniforme'), logo_url: value('logoUrl', 'logo_url'), observaciones: value('notes', 'observaciones')
  };
  Object.keys(result).forEach(function (key) { if (result[key] !== undefined) result[key] = sanitizeText(result[key]); });
  return result;
}

function validateTeamRelations(championshipId, disciplineId) {
  var championshipExists = listSheetRecords(SHEETS.CHAMPIONSHIPS).some(function (item) {
    return String(item.id) === championshipId && String(item.estado) !== 'INACTIVE';
  });
  var disciplineExists = listSheetRecords(SHEETS.DISCIPLINES).some(function (item) {
    return String(item.id) === disciplineId && String(item.campeonato_id) === championshipId && String(item.estado) !== 'INACTIVE';
  });
  if (!championshipExists) throw appError('NOT_FOUND', 'El campeonato seleccionado no existe.', 404);
  if (!disciplineExists) throw appError('NOT_FOUND', 'La disciplina no pertenece al campeonato seleccionado.', 404);
}

function toTeamResponse(record) {
  return {
    id: record.id, championshipId: record.campeonato_id, disciplineId: record.disciplina_id,
    name: record.nombre, delegate: record.delegado || '', phone: record.telefono || '',
    uniform: record.uniforme || '', logoUrl: record.logo_url || '', status: record.estado,
    createdAt: record.created_at, updatedAt: record.updated_at, notes: record.observaciones || ''
  };
}
