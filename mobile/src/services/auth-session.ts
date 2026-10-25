import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { API_URL, ApiError } from '@/services/api-base';

/*
 * Innloggingsøkten på telefonen.
 * - Fornyelsestokenet lagres kryptert i nøkkelringen (expo-secure-store / iOS Keychain).
 * - Tilgangstokenet ligger bare i minnet og fornyes ved behov. Bare én fornyelse kjører om gangen,
 *   fordi serveren tolker gjenbruk av et brukt fornyelsestoken som tyveri og logger ut.
 */

const REFRESH_KEY = 'auth.refreshToken';
const USER_KEY = 'auth.userId';

export type AuthResponse = { accessToken: string; refreshToken: string; expiresIn: number; userId: string | null; newUser: boolean };

export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; userId: string | null };

let state: AuthState = { status: 'loading' };
let currentUserId: string | null = null;
let access: { token: string; expiresAt: number } | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function isSignedIn() {
  return state.status === 'signedIn';
}

/** Gir opp etter `ms` millisekunder, slik at appen aldri blir stående på en tom skjerm. */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} svarte ikke innen ${ms} ms`)), ms)),
  ]);
}

/** Leser lagret økt ved oppstart. */
export async function loadSession() {
  try {
    const refresh = await withTimeout(SecureStore.getItemAsync(REFRESH_KEY), 3000, 'Nøkkelringen');
    const userId = await withTimeout(SecureStore.getItemAsync(USER_KEY), 3000, 'Nøkkelringen');
    currentUserId = userId;
    setState(refresh ? { status: 'signedIn', userId } : { status: 'signedOut' });
  } catch (e) {
    console.warn('[auth] Klarte ikke å lese innloggingen:', e);
    setState({ status: 'signedOut' });
  }
}

/** Lagrer tokens fra innlogging. Appen regnes som innlogget først når markSignedIn() kalles. */
export async function storeTokens(res: AuthResponse) {
  access = { token: res.accessToken, expiresAt: Date.now() + res.expiresIn * 1000 };
  if (res.userId) currentUserId = res.userId;
  await withTimeout(SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken), 5000, 'Nøkkelringen');
  if (res.userId) await withTimeout(SecureStore.setItemAsync(USER_KEY, res.userId), 5000, 'Nøkkelringen');
}

export async function markSignedIn() {
  setState({ status: 'signedIn', userId: currentUserId });
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

/** Glemmer økten på telefonen (tokens). Data slettes av den som kaller (se account.ts). */
export async function clearSession() {
  access = null;
  currentUserId = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  setState({ status: 'signedOut' });
}

/** Serveren avviste et nytt tilgangstoken: kontoen finnes ikke lenger eller økten er trukket tilbake. */
export async function signalUnauthorized() {
  await clearSession();
}

/** Gyldig tilgangstoken, fornyet ved behov. null = ikke innlogget. Kaster ApiError ved nettverksfeil. */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && access && access.expiresAt - 30_000 > Date.now()) return access.token;
  if (!refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function refresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new ApiError(`Fikk ikke kontakt med ${API_URL}`);
  }
  if (response.status === 401) {
    await clearSession();
    return null;
  }
  if (!response.ok) throw new ApiError(`Serveren svarte med status ${response.status}`, response.status);
  const body = (await response.json()) as AuthResponse;
  await storeTokens(body);
  return access?.token ?? null;
}
