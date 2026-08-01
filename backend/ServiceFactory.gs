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
