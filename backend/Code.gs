function doGet(e) { return routeRequest('GET', e); }
function doPost(e) {
  var method = (e && e.parameter && e.parameter._method || 'POST').toUpperCase();
  return routeRequest(method, e);
}
