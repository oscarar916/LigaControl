import { API_BASE_URL } from './config.js';

async function request(method, path, body) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) { return handleApiError(error); }
}
export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPut = (path, body) => request('PUT', path, body);
export const apiDelete = (path) => request('DELETE', path);
export function handleApiError(error) { console.error('LigaControl API:', error); throw new Error('No se pudo completar la solicitud.'); }
