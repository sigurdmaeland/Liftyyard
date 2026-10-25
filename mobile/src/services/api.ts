import { getAccessToken, signalUnauthorized } from '@/services/auth-session';
import { API_URL, ApiError } from '@/services/api-base';

export { API_URL, ApiError } from '@/services/api-base';

/** Endepunkter som ikke skal ha tilgangstoken (innlogging og helsesjekk). */
function isPublic(path: string) {
  return path === '/api/health' || (path.startsWith('/api/auth/') && path !== '/api/auth/claim-dev-data');
}

async function send(method: string, path: string, body: unknown, timeoutMs: number, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(`Fikk ikke kontakt med ${API_URL}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sender en forespørsel med tilgangstoken. Svarer serveren 401, fornyes tokenet én gang og
 * forespørselen prøves igjen. Uten gyldig innlogging sendes ingenting (401 lokalt).
 */
async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<T> {
  let response: Response;
  if (isPublic(path)) {
    response = await send(method, path, body, timeoutMs, null);
  } else {
    let token = await getAccessToken();
    if (!token) throw new ApiError('Du er ikke logget inn', 401);
    response = await send(method, path, body, timeoutMs, token);
    if (response.status === 401) {
      token = await getAccessToken(true);
      if (!token) throw new ApiError('Du er ikke logget inn', 401);
      response = await send(method, path, body, timeoutMs, token);
      if (response.status === 401) await signalUnauthorized();
    }
  }
  if (!response.ok) {
    // Backend svarer med Problem Details (RFC 9457); bruk «detail» når den finnes.
    let detail = `Serveren svarte med status ${response.status}`;
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem.detail) detail = problem.detail;
    } catch {
      // Ikke JSON – behold standardmeldingen.
    }
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getJson<T>(path: string, timeoutMs?: number): Promise<T> {
  return request<T>('GET', path, undefined, timeoutMs);
}

export function putJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function deleteRequest(path: string): Promise<void> {
  return request<void>('DELETE', path);
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

/**
 * Laster opp en fil fra telefonen som multipart (felt «file»), med tilgangstoken og samme
 * fornyelse ved 401 som andre kall.
 */
export async function uploadFile<T>(method: 'PUT' | 'POST', path: string, fileUri: string, mimeType: string): Promise<T> {
  const sendForm = async (token: string) => {
    const form = new FormData();
    // React Native tar imot { uri, name, type } som en fil i FormData.
    form.append('file', { uri: fileUri, name: 'upload.jpg', type: mimeType } as unknown as Blob);
    try {
      return await fetch(`${API_URL}${path}`, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, body: form });
    } catch {
      throw new ApiError(`Fikk ikke kontakt med ${API_URL}`);
    }
  };
  let token = await getAccessToken();
  if (!token) throw new ApiError('Du er ikke logget inn', 401);
  let response = await sendForm(token);
  if (response.status === 401) {
    token = await getAccessToken(true);
    if (!token) throw new ApiError('Du er ikke logget inn', 401);
    response = await sendForm(token);
  }
  if (!response.ok) {
    let detail = `Serveren svarte med status ${response.status}`;
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem.detail) detail = problem.detail;
    } catch {
      // Ikke JSON.
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}
