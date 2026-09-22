import { API_BASE_URL } from './config.js';

const API_CACHE_PREFIX = 'ligaControlApiCache:';
const API_CACHE_TTL = 300000;
const apiCacheStorage = localStorage;

function clearApiCache() {
  try {
    Object.keys(apiCacheStorage).filter(key => key.startsWith(API_CACHE_PREFIX)).forEach(key => apiCacheStorage.removeItem(key));
  } catch (error) { /* La navegación continúa si el almacenamiento no está disponible. */ }
}

async function request(method, path, body, params = {}) {
  try {
    const fresh = Boolean(params.__fresh);
    const effectiveParams = Object.fromEntries(Object.entries(params).filter(([key]) => key !== '__fresh'));
    const tunneledMethod = method === 'PUT' || method === 'DELETE' ? method : '';
    const query = Object.entries(effectiveParams).map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('');
    const freshness = fresh ? `&_fresh=${Date.now()}` : '';
    const url = `${API_BASE_URL}?path=${encodeURIComponent(path)}${tunneledMethod ? `&_method=${tunneledMethod}` : ''}${query}${freshness}`;
    const cacheKey = `${API_CACHE_PREFIX}${url}`;

    if (method === 'GET' && !fresh) {
      try {
        const cached = JSON.parse(apiCacheStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.savedAt < API_CACHE_TTL) return cached.payload;
      } catch (error) { apiCacheStorage.removeItem(cacheKey); }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const requestBody = method === 'GET'
      ? undefined
      : { ...(body || {}), _adminKey: localStorage.getItem('ligaControlAdminKey') || '' };
    const response = await fetch(url, {
      method: tunneledMethod ? 'POST' : method,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      cache: method === 'GET' && fresh ? 'no-store' : 'default',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.success) {
      if (payload.error?.code === 'UNAUTHORIZED') throw new Error('Configura la clave de administracion en Configuracion antes de guardar cambios.');
      if (payload.error?.code === 'SECURITY_NOT_CONFIGURED') throw new Error('Falta configurar ADMIN_API_KEY en Google Apps Script y publicar una nueva version.');
      if (payload.error?.code === 'NOT_IMPLEMENTED' || (payload.error?.code === 'NOT_FOUND' && ['/api/minutes', '/api/configuration', '/api/results-bootstrap'].includes(path))) throw new Error('El backend de Google Apps Script está desactualizado. Debes publicar una nueva versión.');
      throw new Error(payload.error?.message || 'La API rechazó la solicitud.');
    }
    if (method === 'GET') {
      try { apiCacheStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload })); } catch (error) { /* La respuesta puede superar la cuota. */ }
    } else {
      clearApiCache();
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Google Apps Script tardó más de 60 segundos en responder. Presiona Actualizar e inténtalo nuevamente.');
    return handleApiError(error);
  }
}

export const apiGet = (path, params) => request('GET', path, undefined, params);
export const apiGetFresh = (path, params = {}) => request('GET', path, undefined, { ...params, __fresh: true });
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiDelete = (path, body) => request('DELETE', path, body);
export function handleApiError(error) {
  console.error('LigaControl API:', error);
  throw new Error(error.message || 'No se pudo completar la solicitud.');
}
