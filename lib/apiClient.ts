export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export async function apiFetch(inputPath: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(inputPath);
  return fetch(url, init);
}
