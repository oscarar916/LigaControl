var DisciplineService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.DISCIPLINES).filter(function (item) {
      return (!params.championshipId || String(item.campeonato_id) === String(params.championshipId)) &&
        (!params.status || String(item.estado) === String(params.status));
    }).map(toDisciplineResponse);
    return { items: items, total: items.length };
  },

  post: function (context) {
    var input = normalizeDisciplineInput(context.body || {});
    validateDiscipline(input);
    var championship = findActiveChampionship(input.campeonato_id);
    var duplicate = listSheetRecords(SHEETS.DISCIPLINES).some(function (item) {
      return String(item.campeonato_id) === String(input.campeonato_id) &&
        (normalizeKey(item.nombre) === normalizeKey(input.nombre) || normalizeKey(item.codigo) === normalizeKey(input.codigo)) &&
        String(item.estado) !== 'INACTIVE';
    });
    if (duplicate) throw appError('CONFLICT', 'Esta disciplina ya está registrada en el campeonato.', 409);
    var timestamp = nowIso();
    var record = {
      id: generateUuid(), campeonato_id: championship.id, nombre: input.nombre,
      codigo: input.codigo, tipo: input.tipo, reglamento_url: input.reglamento_url,
      configuracion: input.configuracion, estado: 'ACTIVE', created_at: timestamp,
      updated_at: timestamp, observaciones: input.observaciones
    };
    appendSheetRecord(SHEETS.DISCIPLINES, record);
    return toDisciplineResponse(record);
  },

  put: function (context) {
    var body = context.body || {};
    if (!body.id || !validateUuid(body.id)) throw appError('VALIDATION_ERROR', 'El id de la disciplina no es válido.', 400);
    var input = normalizeDisciplineInput(body, true);
    if (input.campeonato_id !== undefined) findActiveChampionship(input.campeonato_id);
    var changes = { updated_at: nowIso() };
    Object.keys(input).forEach(function (key) {
      if (input[key] !== undefined) changes[key] = input[key];
    });
    return toDisciplineResponse(updateSheetRecord(SHEETS.DISCIPLINES, body.id, changes));
  },

  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id de la disciplina no es válido.', 400);
    return toDisciplineResponse(updateSheetRecord(SHEETS.DISCIPLINES, id, {
      estado: 'INACTIVE', updated_at: nowIso()
    }));
  }
};

function normalizeDisciplineInput(body, partial) {
  function value(apiName, sheetName) {
    if (Object.prototype.hasOwnProperty.call(body, apiName)) return body[apiName];
    if (Object.prototype.hasOwnProperty.call(body, sheetName)) return body[sheetName];
    return partial ? undefined : '';
  }
  var configuration = value('configuration', 'configuracion');
  if (configuration !== undefined && typeof configuration !== 'string') configuration = JSON.stringify(configuration);
  var result = {
    campeonato_id: value('championshipId', 'campeonato_id'),
    nombre: value('name', 'nombre'), codigo: value('code', 'codigo'),
    tipo: value('type', 'tipo'), reglamento_url: value('rulesUrl', 'reglamento_url'),
    configuracion: configuration, observaciones: value('notes', 'observaciones')
  };
  Object.keys(result).forEach(function (key) {
    if (result[key] !== undefined) result[key] = sanitizeText(result[key]);
  });
  return result;
}

function validateDiscipline(input) {
  var required = validateRequiredFields(input, ['campeonato_id', 'nombre', 'codigo', 'tipo']);
  if (!required.valid) throw appError('VALIDATION_ERROR', 'Faltan campos obligatorios: ' + required.missing.join(', ') + '.', 400);
  if (!validateUuid(input.campeonato_id)) throw appError('VALIDATION_ERROR', 'El campeonato seleccionado no es válido.', 400);
}

function findActiveChampionship(id) {
  var championship = listSheetRecords(SHEETS.CHAMPIONSHIPS).find(function (item) {
    return String(item.id) === String(id) && String(item.estado) !== 'INACTIVE';
  });
  if (!championship) throw appError('NOT_FOUND', 'El campeonato seleccionado no existe o está inactivo.', 404);
  return championship;
}

function toDisciplineResponse(record) {
  var configuration = record.configuracion || '';
  if (configuration) {
    try { configuration = JSON.parse(configuration); } catch (error) { /* Se conserva como texto. */ }
  }
  return {
    id: record.id, championshipId: record.campeonato_id, name: record.nombre,
    code: record.codigo, type: record.tipo, rulesUrl: record.reglamento_url || '',
    configuration: configuration, status: record.estado,
    createdAt: record.created_at, updatedAt: record.updated_at,
    notes: record.observaciones || ''
  };
}
