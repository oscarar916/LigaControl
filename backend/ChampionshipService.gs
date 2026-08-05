var ChampionshipService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.CHAMPIONSHIPS).filter(function (item) {
      if (params.status) return String(item.estado) === String(params.status);
      return String(item.estado) !== 'INACTIVE';
    }).map(toChampionshipResponse);
    return { items: items, total: items.length };
  },

  post: function (context) {
    var input = normalizeChampionshipInput(context.body || {});
    validateChampionship(input);
    var duplicate = listSheetRecords(SHEETS.CHAMPIONSHIPS).some(function (item) {
      return normalizeKey(item.nombre) === normalizeKey(input.nombre) &&
        Number(item.anio) === input.anio && String(item.estado) !== 'INACTIVE';
    });
    if (duplicate) throw appError('CONFLICT', 'Ya existe un campeonato con ese nombre y año.', 409);
    var timestamp = nowIso();
    var record = {
      id: generateUuid(), nombre: input.nombre, nombre_corto: input.nombre_corto,
      anio: input.anio, organizador: input.organizador, fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin, logo_url: input.logo_url, estado: 'DRAFT',
      created_at: timestamp, updated_at: timestamp, observaciones: input.observaciones
    };
    appendSheetRecord(SHEETS.CHAMPIONSHIPS, record);
    return toChampionshipResponse(record);
  },

  put: function (context) {
    var body = context.body || {};
    if (!body.id || !validateUuid(body.id)) throw appError('VALIDATION_ERROR', 'El id del campeonato no es válido.', 400);
    var input = normalizeChampionshipInput(body, true);
    var changes = { updated_at: nowIso() };
    Object.keys(input).forEach(function (key) {
      if (input[key] !== undefined) changes[key] = input[key];
    });
    if (changes.anio !== undefined && (!Number.isInteger(changes.anio) || changes.anio < 2000 || changes.anio > 2100)) {
      throw appError('VALIDATION_ERROR', 'El año debe estar entre 2000 y 2100.', 400);
    }
    return toChampionshipResponse(updateSheetRecord(SHEETS.CHAMPIONSHIPS, body.id, changes));
  },

  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id del campeonato no es válido.', 400);
    return toChampionshipResponse(updateSheetRecord(SHEETS.CHAMPIONSHIPS, id, {
      estado: 'INACTIVE', updated_at: nowIso()
    }));
  }
};

function normalizeChampionshipInput(body, partial) {
  function value(apiName, sheetName) {
    if (Object.prototype.hasOwnProperty.call(body, apiName)) return body[apiName];
    if (Object.prototype.hasOwnProperty.call(body, sheetName)) return body[sheetName];
    return partial ? undefined : '';
  }
  var result = {
    nombre: value('name', 'nombre'), nombre_corto: value('shortName', 'nombre_corto'),
    anio: value('year', 'anio'), organizador: value('organizer', 'organizador'),
    fecha_inicio: value('startDate', 'fecha_inicio'), fecha_fin: value('endDate', 'fecha_fin'),
    logo_url: value('logoUrl', 'logo_url'), observaciones: value('notes', 'observaciones')
  };
  ['nombre', 'nombre_corto', 'organizador', 'fecha_inicio', 'fecha_fin', 'logo_url', 'observaciones'].forEach(function (key) {
    if (result[key] !== undefined) result[key] = sanitizeText(result[key]);
  });
  if (result.anio !== undefined && result.anio !== '') result.anio = Number(result.anio);
  return result;
}

function validateChampionship(input) {
  var required = validateRequiredFields(input, ['nombre', 'anio', 'organizador']);
  if (!required.valid) throw appError('VALIDATION_ERROR', 'Faltan campos obligatorios: ' + required.missing.join(', ') + '.', 400);
  if (!Number.isInteger(input.anio) || input.anio < 2000 || input.anio > 2100) {
    throw appError('VALIDATION_ERROR', 'El año debe estar entre 2000 y 2100.', 400);
  }
  if (input.fecha_inicio && input.fecha_fin && input.fecha_inicio > input.fecha_fin) {
    throw appError('VALIDATION_ERROR', 'La fecha de inicio no puede ser posterior a la fecha de fin.', 400);
  }
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function toChampionshipResponse(record) {
  return {
    id: record.id, name: record.nombre, shortName: record.nombre_corto,
    year: Number(record.anio), organizer: record.organizador,
    startDate: record.fecha_inicio || '', endDate: record.fecha_fin || '',
    logoUrl: record.logo_url || '', status: record.estado,
    createdAt: record.created_at, updatedAt: record.updated_at,
    notes: record.observaciones || ''
  };
}
