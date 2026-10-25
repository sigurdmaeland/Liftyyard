/**
 * Adressen til backend settes med EXPO_PUBLIC_API_URL (se .env.example). Verdien bygges inn i
 * appen og er derfor offentlig — legg aldri hemmeligheter i EXPO_PUBLIC_-variabler.
 * iOS Simulator når Mac-ens localhost direkte. Android Emulator må bruke 10.0.2.2.
 */
const DEFAULT_API_URL = 'http://localhost:8080';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

/**
 * status undefined = nettverksfeil/timeout (prøv igjen senere).
 * 401 = ikke innlogget. Andre 4xx = serveren avviste forespørselen. 5xx = feil på serveren.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === undefined;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isClientError() {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }
}
