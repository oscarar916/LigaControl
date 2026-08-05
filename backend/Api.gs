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
