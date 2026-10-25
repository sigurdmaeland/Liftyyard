import type { SQLiteDatabase } from 'expo-sqlite';

import { refreshProfile } from '@/hooks/use-profile';
import { ApiError, getJson } from '@/services/api';
import { claimDevData, deleteAccountRemote, logoutRemote } from '@/services/auth';
import { fetchMyProfile } from '@/services/profile';
import { type AuthResponse, clearSession, getRefreshToken, markSignedIn, storeTokens } from '@/services/auth-session';
import { refreshExerciseCatalog, syncPendingWorkouts } from '@/services/sync';
import {
  type RemoteProgramMeta,
  type RemoteRoutine,
  type RemoteWorkout,
  getDataOwner,
  hasLocalUserData,
  insertRemoteMeasurements,
  insertRemoteProgram,
  insertRemoteRoutine,
  insertRemoteWorkout,
  setDataOwner,
  wipeLocalData,
} from '@/storage/account-store';
import { applyServerProfile, deleteLocalProfilePhoto } from '@/storage/profile-store';
import type { Measurement } from '@/types/measurement';
import { setSettingsFromServer } from '@/storage/settings-store';

/**
 * Gjør klar telefonen etter innlogging, før appen åpnes:
 * - Data fra før innlogging (første gang på denne telefonen) beholdes og blir kontoens. Lokalt flyttes
 *   også det utviklingsbrukeren har lagret på serveren.
 * - Er telefonen tom (ny telefon eller etter utlogging), hentes alt fra serveren.
 */
export async function completeLogin(db: SQLiteDatabase, res: AuthResponse) {
  await storeTokens(res);
  const owner = await getDataOwner(db);
  if (owner && res.userId && owner !== res.userId) {
    // Data fra en annen konto skal aldri blandes inn (skal ikke skje, siden utlogging tømmer telefonen).
    await deleteLocalProfilePhoto(db);
    await wipeLocalData(db);
  }
  const hasLocal = await hasLocalUserData(db);
  if (hasLocal && !owner) {
    await claimDevData().catch(() => {}); // 404 i drift: finnes bare lokalt.
  }
  await refreshExerciseCatalog(db);
  // Brukernavn og profilbilde kommer alltid fra serveren (avgjør om velkomstflyten skal vises).
  await refreshServerProfile(db);
  if (!hasLocal) {
    try {
      await pullFromServer(db);
    } catch (e) {
      // Halvveis hentet er verre enn ingenting: tøm og la brukeren prøve igjen.
      await wipeLocalData(db);
      throw e;
    }
  }
  if (res.userId) await setDataOwner(db, res.userId);
  await refreshProfile(db);
  await markSignedIn();
  syncPendingWorkouts(db).catch(() => {});
}

/** Henter brukernavn, bilde og (hvis ikke endret lokalt) profilfeltene fra serveren. */
export async function refreshServerProfile(db: SQLiteDatabase) {
  await applyServerProfile(db, await fetchMyProfile());
}

/** Henter profil, målinger, programmer, rutiner og økter fra serveren. */
export async function pullFromServer(db: SQLiteDatabase) {
  await refreshServerProfile(db);
  const settings = await getJson<{ goalWeightKg: number | null; weeklyWorkoutGoal?: number | null; weightUnit?: 'KG' | 'LB' }>(
    '/api/settings',
  );
  await setSettingsFromServer(db, settings);
  await insertRemoteMeasurements(db, await getJson<Measurement[]>('/api/measurements'));

  for (const summary of await getJson<{ id: string }[]>('/api/programs')) {
    await insertRemoteProgram(db, await getJson<RemoteProgramMeta>(`/api/programs/${summary.id}`));
  }
  for (const routine of await getJson<RemoteRoutine[]>('/api/routines')) {
    await insertRemoteRoutine(db, routine);
  }

  for (let page = 0; ; page += 1) {
    const result = await getJson<{ items: { id: string }[]; totalPages: number }>(`/api/workouts?page=${page}&size=100`);
    for (const item of result.items) {
      await insertRemoteWorkout(db, await getJson<RemoteWorkout>(`/api/workouts/${item.id}`, 15000));
    }
    if (page + 1 >= result.totalPages) break;
  }
}

/** Sletter alt lokalt og glemmer økten. */
async function forgetDevice(db: SQLiteDatabase) {
  await deleteLocalProfilePhoto(db);
  await wipeLocalData(db);
  await refreshProfile(db);
  await clearSession();
}

/** Logger ut: trekker tilbake økten på serveren (hvis mulig) og tømmer telefonen. Kall syncPendingWorkouts først. */
export async function logout(db: SQLiteDatabase) {
  const refreshToken = await getRefreshToken();
  if (refreshToken) await logoutRemote(refreshToken).catch(() => {});
  await forgetDevice(db);
}

/** Sletter kontoen på serveren (krever nett) og deretter alt på telefonen. */
export async function deleteAccount(db: SQLiteDatabase) {
  try {
    await deleteAccountRemote();
  } catch (e) {
    if (e instanceof ApiError && e.isNetworkError) throw new Error('Krever nett. Prøv igjen når du er tilkoblet.');
    throw e;
  }
  await forgetDevice(db);
}
