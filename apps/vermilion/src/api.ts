const API_BASE =
  import.meta.env.VITE_VERMILION_API_BASE ||
  (import.meta.env.PROD ? 'https://api-vermilion.jeffersonwm.com' : '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
  });
}

export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path), { withCredentials: true });
}
