function generateUuid() { return Utilities.getUuid(); }
function nowIso() { return new Date().toISOString(); }
function getSpreadsheetId() { return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || APP_CONFIG.SPREADSHEET_ID; }
