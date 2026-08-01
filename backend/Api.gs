function routeRequest(method, e) {
  try {
    var path = '/' + String(e && e.pathInfo || '').replace(/^\/+/, '');
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return resolveRoute(method, path, e && e.parameter || {}, body);
  } catch (error) {
    return errorResponse(error.code || 'INTERNAL_ERROR', error.message || 'Error interno.', error.status || 500);
  }
}
function resolveRoute(method, path, params, body) {
  var routes = { '/api/championships': ChampionshipService, '/api/disciplines': DisciplineService, '/api/teams': TeamService, '/api/players': PlayerService, '/api/matches': MatchService, '/api/events': EventService, '/api/sanctions': SanctionService, '/api/payments': PaymentService, '/api/reports': ReportService, '/api/audit': AuditService };
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
