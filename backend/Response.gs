function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function successResponse(data, message) { return jsonResponse({ success: true, message: message || 'OK', data: data, meta: { timestamp: new Date().toISOString() } }); }
function errorResponse(code, message, status) { return jsonResponse({ success: false, error: { code: code, message: message, status: status || 400 }, meta: { timestamp: new Date().toISOString() } }); }
