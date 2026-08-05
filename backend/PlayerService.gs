var PlayerService = {
  get: function (context) {
    var params = context.params || {};
    var items = listSheetRecords(SHEETS.PLAYERS).filter(function (item) {
      return (!params.teamId || String(item.equipo_id) === String(params.teamId)) &&
        (!params.status || String(item.estado) === String(params.status));
    }).map(toPlayerResponse);
    return { items: items, total: items.length };
  },

  post: function (context) {
    var input = normalizePlayerInput(context.body || {});
    var required = validateRequiredFields(input, ['equipo_id', 'nombre_completo']);
    if (!required.valid) throw appError('VALIDATION_ERROR', 'Faltan campos obligatorios: ' + required.missing.join(', ') + '.', 400);
    if (!validateUuid(input.equipo_id)) throw appError('VALIDATION_ERROR', 'El equipo seleccionado no es válido.', 400);
    var teamExists = listSheetRecords(SHEETS.TEAMS).some(function (item) { return String(item.id) === input.equipo_id && String(item.estado) !== 'INACTIVE'; });
    if (!teamExists) throw appError('NOT_FOUND', 'El equipo seleccionado no existe.', 404);
    if (input.dni && !/^\d{8}$/.test(input.dni)) throw appError('VALIDATION_ERROR', 'El DNI debe tener exactamente 8 números.', 400);
    if (input.numero_camiseta !== '' && (!Number.isInteger(input.numero_camiseta) || input.numero_camiseta < 0 || input.numero_camiseta > 99)) throw appError('VALIDATION_ERROR', 'El número de camiseta debe estar entre 0 y 99.', 400);
    var duplicate = input.dni && listSheetRecords(SHEETS.PLAYERS).some(function (item) { return String(item.dni) === input.dni && String(item.estado) !== 'INACTIVE'; });
    if (duplicate) throw appError('CONFLICT', 'Ya existe un jugador activo con ese DNI.', 409);
    if (input.numero_camiseta !== '' && hasDuplicateShirtNumber(input.equipo_id, input.numero_camiseta)) {
      throw appError('CONFLICT', 'Ese número de camiseta ya está asignado a otro jugador del equipo.', 409);
    }
    var timestamp = nowIso();
    var record = {
      id: generateUuid(), equipo_id: input.equipo_id, dni: input.dni,
      nombre_completo: input.nombre_completo, numero_camiseta: input.numero_camiseta,
      posicion: input.posicion, foto_url: input.foto_url, fecha_nacimiento: input.fecha_nacimiento,
      estado: 'ACTIVE', created_at: timestamp, updated_at: timestamp, observaciones: input.observaciones
    };
    appendSheetRecord(SHEETS.PLAYERS, record);
    return toPlayerResponse(record);
  },

  put: function (context) {
    var body = context.body || {};
    if (!body.id || !validateUuid(body.id)) throw appError('VALIDATION_ERROR', 'El id del jugador no es válido.', 400);
    var input = normalizePlayerInput(body, true);
    var current = listSheetRecords(SHEETS.PLAYERS).find(function (item) { return String(item.id) === String(body.id); });
    if (!current || String(current.estado) === 'INACTIVE') throw appError('NOT_FOUND', 'El jugador no existe o fue retirado.', 404);
    var effectiveTeamId = input.equipo_id !== undefined ? input.equipo_id : String(current.equipo_id);
    var effectiveDni = input.dni !== undefined ? input.dni : String(current.dni);
    var effectiveShirtNumber = input.numero_camiseta !== undefined ? input.numero_camiseta : current.numero_camiseta;
    if (effectiveDni && !/^\d{8}$/.test(effectiveDni)) throw appError('VALIDATION_ERROR', 'El DNI debe tener exactamente 8 números.', 400);
    if (effectiveShirtNumber !== '' && (!Number.isInteger(Number(effectiveShirtNumber)) || Number(effectiveShirtNumber) < 0 || Number(effectiveShirtNumber) > 99)) {
      throw appError('VALIDATION_ERROR', 'El número de camiseta debe estar entre 0 y 99.', 400);
    }
    var duplicateDni = effectiveDni && listSheetRecords(SHEETS.PLAYERS).some(function (item) {
      return String(item.id) !== String(body.id) && String(item.dni) === effectiveDni && String(item.estado) !== 'INACTIVE';
    });
    if (duplicateDni) throw appError('CONFLICT', 'Ya existe otro jugador activo con ese DNI.', 409);
    if (effectiveShirtNumber !== '' && hasDuplicateShirtNumber(effectiveTeamId, Number(effectiveShirtNumber), body.id)) {
      throw appError('CONFLICT', 'Ese número de camiseta ya está asignado a otro jugador del equipo.', 409);
    }
    var changes = { updated_at: nowIso() };
    Object.keys(input).forEach(function (key) { if (input[key] !== undefined) changes[key] = input[key]; });
    return toPlayerResponse(updateSheetRecord(SHEETS.PLAYERS, body.id, changes));
  },

  delete: function (context) {
    var id = context.body && context.body.id;
    if (!id || !validateUuid(id)) throw appError('VALIDATION_ERROR', 'El id del jugador no es válido.', 400);
    return toPlayerResponse(updateSheetRecord(SHEETS.PLAYERS, id, { estado: 'INACTIVE', updated_at: nowIso() }));
  }
};

function hasDuplicateShirtNumber(teamId, shirtNumber, excludedId) {
  return listSheetRecords(SHEETS.PLAYERS).some(function (item) {
    return String(item.id) !== String(excludedId || '') && String(item.equipo_id) === String(teamId) &&
      item.numero_camiseta !== '' && Number(item.numero_camiseta) === Number(shirtNumber) && String(item.estado) !== 'INACTIVE';
  });
}

function normalizePlayerInput(body, partial) {
  function value(apiName, sheetName) {
    if (Object.prototype.hasOwnProperty.call(body, apiName)) return body[apiName];
    if (Object.prototype.hasOwnProperty.call(body, sheetName)) return body[sheetName];
    return partial ? undefined : '';
  }
  var result = {
    equipo_id: value('teamId', 'equipo_id'), dni: value('dni', 'dni'), nombre_completo: value('fullName', 'nombre_completo'),
    numero_camiseta: value('shirtNumber', 'numero_camiseta'), posicion: value('position', 'posicion'),
    foto_url: value('photoUrl', 'foto_url'), fecha_nacimiento: value('birthDate', 'fecha_nacimiento'), observaciones: value('notes', 'observaciones')
  };
  Object.keys(result).forEach(function (key) { if (result[key] !== undefined) result[key] = sanitizeText(result[key]); });
  if (result.numero_camiseta !== undefined && result.numero_camiseta !== '') result.numero_camiseta = Number(result.numero_camiseta);
  return result;
}

function toPlayerResponse(record) {
  return {
    id: record.id, teamId: record.equipo_id, dni: String(record.dni || ''), fullName: record.nombre_completo,
    shirtNumber: record.numero_camiseta === '' ? '' : Number(record.numero_camiseta), position: record.posicion || '',
    photoUrl: record.foto_url || '', birthDate: record.fecha_nacimiento || '', status: record.estado,
    createdAt: record.created_at, updatedAt: record.updated_at, notes: record.observaciones || ''
  };
}
