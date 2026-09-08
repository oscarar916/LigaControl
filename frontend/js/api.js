import { API_BASE_URL } from './config.js';

async function request(method, path, body, params = {}) {
  try {
    const tunneledMethod = method === 'PUT' || method === 'DELETE' ? method : '';
    const query = Object.entries(params).map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('');
    const url = `${API_BASE_URL}?path=${encodeURIComponent(path)}${tunneledMethod ? `&_method=${tunneledMethod}` : ''}${query}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const requestBody = method === 'GET'
      ? undefined
      : { ...(body || {}), _adminKey: localStorage.getItem('ligaControlAdminKey') || '' };
    const response = await fetch(url, {
      method: tunneledMethod ? 'POST' : method,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.success) {
      if (payload.error?.code === 'UNAUTHORIZED') {
        throw new Error('Configura la clave de administracion en Configuracion antes de guardar cambios.');
      }
      if (payload.error?.code === 'SECURITY_NOT_CONFIGURED') {
        throw new Error('Falta configurar ADMIN_API_KEY en Google Apps Script y publicar una nueva version.');
      }
      if (payload.error?.code === 'NOT_IMPLEMENTED' || (payload.error?.code === 'NOT_FOUND' && ['/api/minutes', '/api/configuration', '/api/results-bootstrap'].includes(path))) {
        throw new Error('El backend de Google Apps Script está desactualizado. Debes publicar una nueva versión.');
      }
      throw new Error(payload.error?.message || 'La API rechazó la solicitud.');
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Google Apps Script tardó más de 60 segundos en responder. Presiona Actualizar e inténtalo nuevamente.');
    return handleApiError(error);
  }
}

export const apiGet = (path, params) => request('GET', path, undefined, params);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiDelete = (path, body) => request('DELETE', path, body);
export function handleApiError(error) {
  console.error('LigaControl API:', error);
  throw new Error(error.message || 'No se pudo completar la solicitud.');
}
