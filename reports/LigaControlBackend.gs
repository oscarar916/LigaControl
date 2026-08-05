/**
 * LigaControl Backend - bundle generado automáticamente.
 * No edite este archivo directamente; modifique backend/*.gs y regenere.
 */
// ===== Config.gs =====
const APP_CONFIG = Object.freeze({ VERSION: '0.1.0', SPREADSHEET_ID: 'REPLACE_WITH_SCRIPT_PROPERTY' });
const SHEETS = Object.freeze({ CHAMPIONSHIPS: 'CAMPEONATOS', DISCIPLINES: 'DISCIPLINAS', CONFIGURATION: 'CONFIGURACION', TEAMS: 'EQUIPOS', PLAYERS: 'JUGADORES', MATCHES: 'PARTIDOS', EVENTS: 'EVENTOS', SANCTIONS: 'SANCIONES', PAYMENTS: 'PAGOS', MINUTES: 'ACTAS', USERS: 'USUARIOS', AUDIT: 'AUDITORIA' });

// ===== Utils.gs =====
function generateUuid() { return Utilities.getUuid(); }
function nowIso() { return new Date().toISOString(); }
function getSpreadsheetId() { return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || APP_CONFIG.SPREADSHEET_ID; }

// ===== Response.gs =====
function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function successResponse(data, message) { return jsonResponse({ success: true, message: message || 'OK', data: data, meta: { timestamp: new Date().toISOString() } }); }
function errorResponse(code, message, status) { return jsonResponse({ success: false, error: { code: code, message: message, status: status || 400 }, meta: { timestamp: new Date().toISOString() } }); }

// ===== Validation.gs =====
function validateRequiredFields(data, fields) { var missing = fields.filter(function(field) { return data[field] === undefined || data[field] === null || data[field] === ''; }); return { valid: !missing.length, missing: missing }; }
function validateUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)); }
function sanitizeText(value) { return String(value == null ? '' : value).replace(/[<>]/g, '').trim(); }

// ===== ServiceFactory.gs =====
function createServiceContract(entity) {
  return {
    get: function () {
      return { entity: entity, items: [], total: 0 };
    },
    post: function () {
      throw appError('NOT_IMPLEMENTED', 'El módulo ' + entity + ' todavía no está implementado.', 501);
    },
    put: function () {
      throw appError('NOT_IMPLEMENTED', 'El módulo ' + entity + ' todavía no está implementado.', 501);
    },
    delete: function () {
      throw appError('NOT_IMPLEMENTED', 'El módulo ' + entity + ' todavía no está implementado.', 501);
    }
  };
}

function appError(code, message, status) {
  var error = new Error(message);
  error.code = code;
  error.status = status || 400;
  return error;
}

function getDatabase() {
  var spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId || spreadsheetId === 'REPLACE_WITH_SCRIPT_PROPERTY') {
    throw appError('CONFIGURATION_ERROR', 'Falta configurar la propiedad SPREADSHEET_ID.', 500);
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getDatabaseSheet(sheetName) {
  var sheet = getDatabase().getSheetByName(sheetName);
  if (!sheet) throw appError('CONFIGURATION_ERROR', 'No existe la hoja ' + sheetName + '.', 500);
  return sheet;
}

function getSheetHeaders(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw appError('CONFIGURATION_ERROR', 'La hoja ' + sheet.getName() + ' no tiene encabezados.', 500);
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
}

function listSheetRecords(sheetName) {
  var sheet = getDatabaseSheet(sheetName);
  var headers = getSheetHeaders(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().map(function (row) {
    var record = {};
    headers.forEach(function (header, index) { record[header] = row[index]; });
    return record;
  }).filter(function (record) { return Boolean(record.id); });
}

function appendSheetRecord(sheetName, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getDatabaseSheet(sheetName);
    var headers = getSheetHeaders(sheet);
    sheet.appendRow(headers.map(function (header) {
      return record[header] === undefined || record[header] === null ? '' : record[header];
    }));
    return record;
  } finally {
    lock.releaseLock();
  }
}

function appendSheetRecords(sheetName, records) {
  if (!records.length) return records;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getDatabaseSheet(sheetName);
    var headers = getSheetHeaders(sheet);
    var values = records.map(function (record) {
      return headers.map(function (header) { return record[header] === undefined || record[header] === null ? '' : record[header]; });
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
    return records;
  } finally { lock.releaseLock(); }
}

function updateSheetRecord(sheetName, id, changes) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getDatabaseSheet(sheetName);
    var headers = getSheetHeaders(sheet);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw appError('NOT_FOUND', 'Registro no encontrado.', 404);
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var idIndex = headers.indexOf('id');
    var offset = values.findIndex(function (row) { return String(row[idIndex]) === String(id); });
    if (offset === -1) throw appError('NOT_FOUND', 'Registro no encontrado.', 404);
    var row = values[offset];
    headers.forEach(function (header, index) {
      if (Object.prototype.hasOwnProperty.call(changes, header)) row[index] = changes[header];
    });
    sheet.getRange(offset + 2, 1, 1, headers.length).setValues([row]);
    var result = {};
    headers.forEach(function (header, index) { result[header] = row[index]; });
    return result;
  } finally {
    lock.releaseLock();
  }
}

// ===== ChampionshipService.gs =====
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

// ===== DisciplineService.gs =====
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

// ===== ConfigurationService.gs =====
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

// ===== TeamService.gs =====
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

// ===== PlayerService.gs =====
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

// ===== MatchService.gs =====
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

// ===== EventService.gs =====
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

// ===== MinuteService.gs =====
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

// ===== SanctionService.gs =====
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
  var duplicate = listSheetRecords(SHEETS.SANCTIONS).find(function (x) { return String(x.evento_id) === String(eventRecord.id) && String(x.estado) !== 'INACTIVE'; }); if (duplicate) return duplicate;
  var settings = getSanctionSettings(String(match.campeonato_id), String(match.disciplina_id));
  var matches = listSheetRecords(SHEETS.MATCHES), playerCards = listSheetRecords(SHEETS.EVENTS).filter(function (x) { if (String(x.jugador_id) !== String(eventRecord.jugador_id) || String(x.tipo) !== String(eventRecord.tipo) || String(x.estado) === 'INACTIVE') return false; var m = matches.find(function (candidate) { return String(candidate.id) === String(x.partido_id); }); return m && String(m.campeonato_id) === String(match.campeonato_id) && String(m.disciplina_id) === String(match.disciplina_id); }).sort(function (a, b) { return String(a.created_at || '').localeCompare(String(b.created_at || '')); });
  var eventIndex = playerCards.findIndex(function (x) { return String(x.id) === String(eventRecord.id); });
  var count = eventIndex >= 0 ? eventIndex + 1 : playerCards.length;
  var yellow = eventRecord.tipo === 'YELLOW_CARD', suspension = yellow && count % Number(settings.YELLOW_CARDS_FOR_SUSPENSION || 2) === 0 ? Number(settings.YELLOW_SUSPENSION_MATCHES || 1) : yellow ? 0 : Number(settings.RED_SUSPENSION_MATCHES || 2), expelled = !yellow && count >= Number(settings.RED_CARDS_FOR_EXPULSION || 2), amount = Number(yellow ? settings.YELLOW_CARD_COST : settings.RED_CARD_COST), timestamp = nowIso();
  var record = { id: generateUuid(), campeonato_id: match.campeonato_id, evento_id: eventRecord.id, equipo_id: eventRecord.equipo_id, jugador_id: eventRecord.jugador_id, tipo: expelled ? 'EXPULSION' : eventRecord.tipo, motivo: expelled ? 'Expulsión por acumulación de tarjetas rojas' : yellow ? 'Tarjeta amarilla' : 'Tarjeta roja directa', fechas_suspension: suspension, monto: amount, fecha_inicio: match.fecha || '', fecha_fin: '', estado: 'ACTIVE', created_at: timestamp, updated_at: timestamp, observaciones: JSON.stringify({ accumulatedCards: count }) };
  appendSheetRecord(SHEETS.SANCTIONS, record); createPendingPayment(record); return record;
}
function deactivateSanctionForEvent(eventId) { listSheetRecords(SHEETS.SANCTIONS).filter(function (x) { return String(x.evento_id) === String(eventId) && String(x.estado) !== 'INACTIVE'; }).forEach(function (sanction) { updateSheetRecord(SHEETS.SANCTIONS, sanction.id, { estado: 'INACTIVE', updated_at: nowIso() }); listSheetRecords(SHEETS.PAYMENTS).filter(function (p) { return String(p.sancion_id) === String(sanction.id) && String(p.estado) !== 'INACTIVE'; }).forEach(function (p) { updateSheetRecord(SHEETS.PAYMENTS, p.id, { estado: 'INACTIVE', updated_at: nowIso() }); }); }); }
function toSanctionResponse(x) { return { id: x.id, championshipId: x.campeonato_id, eventId: x.evento_id, teamId: x.equipo_id, playerId: x.jugador_id, type: x.tipo, reason: x.motivo, suspensionMatches: Number(x.fechas_suspension || 0), amount: Number(x.monto || 0), startDate: x.fecha_inicio || '', endDate: x.fecha_fin || '', status: x.estado, createdAt: x.created_at }; }

// ===== PaymentService.gs =====
var PaymentService = {
  get: function (context) { var p = context.params || {}; var items = listSheetRecords(SHEETS.PAYMENTS).filter(function (x) { return (!p.championshipId || String(x.campeonato_id) === String(p.championshipId)) && String(x.estado) !== 'INACTIVE'; }).map(toPaymentResponse); return { items: items, total: items.length }; },
  put: function (context) { var b = context.body || {}; if (!b.id || !validateUuid(b.id)) throw appError('VALIDATION_ERROR', 'El pago no es válido.', 400); var paid = Boolean(b.paid); return toPaymentResponse(updateSheetRecord(SHEETS.PAYMENTS, b.id, { estado: paid ? 'PAID' : 'PENDING', fecha: paid ? nowIso().slice(0, 10) : '', referencia: sanitizeText(b.reference || ''), updated_at: nowIso() })); }
};
function createPendingPayment(s) { var t = nowIso(), r = { id: generateUuid(), campeonato_id: s.campeonato_id, equipo_id: s.equipo_id, jugador_id: s.jugador_id, sancion_id: s.id, created_by: '', concepto: s.motivo, monto: s.monto, moneda: 'PEN', fecha: '', comprobante_url: '', referencia: '', estado: 'PENDING', created_at: t, updated_at: t, observaciones: '' }; appendSheetRecord(SHEETS.PAYMENTS, r); return r; }
function toPaymentResponse(x) { return { id: x.id, championshipId: x.campeonato_id, teamId: x.equipo_id, playerId: x.jugador_id, sanctionId: x.sancion_id, concept: x.concepto, amount: Number(x.monto || 0), currency: x.moneda || 'PEN', date: x.fecha || '', reference: x.referencia || '', status: x.estado }; }

// ===== ResultsBootstrapService.gs =====
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

// ===== ReportService.gs =====
var ReportService = createServiceContract('REPORTES');

// ===== AuditService.gs =====
var AuditService = createServiceContract('AUDITORIA');
function logAudit(action, entity, entityId, user, details) { /* TODO: persistir en AUDITORIA. */ return { id: generateUuid(), action: action, entity: entity, entityId: entityId, user: user, details: details, createdAt: nowIso() }; }

// ===== Api.gs =====
function routeRequest(method, e) {
  try {
    var requestedPath = e && e.parameter && e.parameter.path || e && e.pathInfo || '';
    var path = '/' + String(requestedPath).replace(/^\/+/, '');
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    authorizeRequest(method, body);
    return resolveRoute(method, path, e && e.parameter || {}, body);
  } catch (error) {
    return errorResponse(error.code || 'INTERNAL_ERROR', error.message || 'Error interno.', error.status || 500);
  }
}

function authorizeRequest(method, body) {
  if (String(method).toUpperCase() === 'GET') return;

  var configuredKey = PropertiesService.getScriptProperties().getProperty('ADMIN_API_KEY');
  if (!configuredKey) {
    throw appError('SECURITY_NOT_CONFIGURED', 'Falta configurar ADMIN_API_KEY en las propiedades de Apps Script.', 503);
  }

  var suppliedKey = body && body._adminKey ? String(body._adminKey) : '';
  if (suppliedKey !== configuredKey) {
    throw appError('UNAUTHORIZED', 'Clave de administracion incorrecta o no configurada en este navegador.', 401);
  }

  delete body._adminKey;
}
function resolveRoute(method, path, params, body) {
  var routes = { '/api/championships': ChampionshipService, '/api/disciplines': DisciplineService, '/api/configuration': ConfigurationService, '/api/teams': TeamService, '/api/players': PlayerService, '/api/matches': MatchService, '/api/events': EventService, '/api/minutes': MinuteService, '/api/sanctions': SanctionService, '/api/payments': PaymentService, '/api/results-bootstrap': ResultsBootstrapService, '/api/reports': ReportService, '/api/audit': AuditService };
  var service = routes[path];
  if (!service) return errorResponse('NOT_FOUND', 'Ruta no encontrada', 404);
  var handler = service[method.toLowerCase()];
  if (!handler) return errorResponse('METHOD_NOT_ALLOWED', 'Método no permitido', 405);
  try {
    return successResponse(handler({ params: params, body: body }));
  } catch (error) {
    return errorResponse(error.code || 'INTERNAL_ERROR', error.message || 'Error interno.', error.status || 500);
  }
}

// ===== Code.gs =====
function doGet(e) { return routeRequest('GET', e); }
function doPost(e) {
  var method = (e && e.parameter && e.parameter._method || 'POST').toUpperCase();
  return routeRequest(method, e);
}
