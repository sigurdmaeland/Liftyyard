import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/services/api';
import { isSignedIn } from '@/services/auth-session';
import {
  archiveRemoteExercise,
  fetchExerciseCatalog,
  setRemoteExerciseFavorite,
  uploadCustomExercise,
} from '@/services/exercises';
import {
  deleteRemoteProgram,
  deleteRemoteRoutine,
  setRemoteRoutineFavorite,
  uploadProgram,
  uploadRoutine,
} from '@/services/programs';
import { deleteRemoteMeasurement, saveRemoteSettings, uploadMeasurement } from '@/services/measurements';
import { deleteRemoteAvatar, saveRemoteProfile, uploadAvatar } from '@/services/profile';
import { deleteRemotePhoto, deleteRemoteWorkout, uploadPhoto, uploadWorkout } from '@/services/workouts';
import {
  clearExerciseFavoriteDirty,
  listCustomExercisesToSync,
  listDirtyExerciseFavorites,
  markExerciseFailed,
  markExerciseSynced,
  replaceCatalog,
} from '@/storage/exercise-store';
import {
  clearPendingMeasurementDeletion,
  listMeasurementsToSync,
  listPendingMeasurementDeletions,
  markMeasurementFailed,
  markMeasurementSynced,
} from '@/storage/measurement-store';
import { clearPhotoDeletion, listPhotoDeletions, listPhotosToUpload, markPhotoFailed, markPhotoUploaded } from '@/storage/photo-store';
import { clearProfileDirty, completePendingPhoto, getDirtyProfile, getPendingPhoto, markPendingPhotoFailed } from '@/storage/profile-store';
import {
  clearPendingProgramDeletion,
  clearPendingRoutineDeletion,
  clearRoutineFavoriteDirty,
  listDirtyRoutineFavorites,
  listPendingProgramDeletions,
  listPendingRoutineDeletions,
  listProgramsToSync,
  listRoutinesToSync,
  markProgramFailed,
  markProgramSynced,
  markRoutineFailed,
  markRoutineSynced,
} from '@/storage/program-store';
import {
  clearPendingDeletion,
  listPendingDeletions,
  listWorkoutsToSync,
  markSyncResult,
} from '@/storage/workout-store';
import { clearSettingsDirty, getDirtySettings } from '@/storage/settings-store';

let inFlight: Promise<SyncReport> | null = null;

export type SyncReport = { uploaded: number; pending: number; failed: number };

/** Signal for å avbryte hele synken når nettet er borte (ingen vits å prøve resten nå). */
class Offline extends Error {}

/**
 * Synkroniserer alt som venter, i en rekkefølge som oppfyller avhengighetene på serveren:
 * egne øvelser → programmer → rutiner → favoritter → økter → kroppsmålinger, innstillinger og profil.
 * Slettinger går før opplastinger.
 *
 * Nettverksfeil og serverfeil (5xx) lar objektet stå som «pending» til neste forsøk. Avviser
 * serveren data (4xx), merkes objektet «failed» med feilmeldingen, så det ikke prøves i det uendelige.
 * Bare én synkronisering kjører om gangen. (Navnet er historisk; den synker mer enn økter.)
 */
export function syncPendingWorkouts(db: SQLiteDatabase): Promise<SyncReport> {
  if (!isSignedIn()) return Promise.resolve({ uploaded: 0, pending: 0, failed: 0 });
  if (!inFlight) {
    inFlight = run(db).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Kjører ett kall; returnerer 4xx-feilmeldingen, ellers null. Kaster Offline ved nettverksfeil. */
async function attempt(op: () => Promise<void>): Promise<string | null | 'retry'> {
  try {
    await op();
    return null;
  } catch (error) {
    // Uten nett eller innlogging stopper vi hele synken; alt blir liggende til neste forsøk.
    if (error instanceof ApiError && (error.isNetworkError || error.isUnauthorized)) throw new Offline();
    if (error instanceof ApiError && error.isClientError) return error.message;
    return 'retry';
  }
}

async function run(db: SQLiteDatabase): Promise<SyncReport> {
  const report: SyncReport = { uploaded: 0, pending: 0, failed: 0 };
  try {
    // 1. Egne øvelser (må finnes før rutiner og økter som bruker dem).
    for (const { exercise, deleted, version } of await listCustomExercisesToSync(db)) {
      const result = await attempt(() => (deleted ? archiveRemoteExercise(exercise.id) : uploadCustomExercise(exercise)));
      if (result === null) await markExerciseSynced(db, exercise.id, deleted, version);
      else if (result !== 'retry') await markExerciseFailed(db, exercise.id);
    }
    for (const f of await listDirtyExerciseFavorites(db)) {
      const result = await attempt(() => setRemoteExerciseFavorite(f.id, f.favorite));
      if (result === null || result !== 'retry') await clearExerciseFavoriteDirty(db, f.id, f.favorite);
    }

    // 2. Programmer: slettinger, deretter endringer.
    for (const id of await listPendingProgramDeletions(db)) {
      if ((await attempt(() => deleteRemoteProgram(id))) !== 'retry') await clearPendingProgramDeletion(db, id);
    }
    for (const p of await listProgramsToSync(db)) {
      const result = await attempt(() => uploadProgram(p));
      if (result === null) await markProgramSynced(db, p.id, p.updated_at);
      else if (result !== 'retry') await markProgramFailed(db, p.id, result);
    }

    // 3. Rutiner og favoritter.
    for (const id of await listPendingRoutineDeletions(db)) {
      if ((await attempt(() => deleteRemoteRoutine(id))) !== 'retry') await clearPendingRoutineDeletion(db, id);
    }
    for (const r of await listRoutinesToSync(db)) {
      const result = await attempt(() => uploadRoutine(r));
      if (result === null) await markRoutineSynced(db, r.id, r.updatedAt);
      else if (result !== 'retry') await markRoutineFailed(db, r.id, result);
    }
    for (const f of await listDirtyRoutineFavorites(db)) {
      if ((await attempt(() => setRemoteRoutineFavorite(f.id, f.favorite))) !== 'retry') {
        await clearRoutineFavoriteDirty(db, f.id, f.favorite);
      }
    }

    // 4. Økter: slettinger først, slik at en slettet økt aldri lastes opp igjen.
    for (const id of await listPendingDeletions(db)) {
      if ((await attempt(() => deleteRemoteWorkout(id))) !== 'retry') await clearPendingDeletion(db, id);
    }
    for (const w of await listWorkoutsToSync(db)) {
      const result = await attempt(() => uploadWorkout(w));
      if (result === null) {
        await markSyncResult(db, w.id, 'synced', null);
        report.uploaded += 1;
      } else if (result === 'retry') {
        report.pending += 1;
      } else {
        await markSyncResult(db, w.id, 'failed', result);
        report.failed += 1;
      }
    }

    // 5. Kroppsmålinger og innstillinger (vektmål).
    for (const id of await listPendingMeasurementDeletions(db)) {
      if ((await attempt(() => deleteRemoteMeasurement(id))) !== 'retry') await clearPendingMeasurementDeletion(db, id);
    }
    for (const m of await listMeasurementsToSync(db)) {
      const result = await attempt(() => uploadMeasurement(m));
      if (result === null) await markMeasurementSynced(db, m.id, m.updatedAt);
      else if (result !== 'retry') await markMeasurementFailed(db, m.id, result);
    }
    const dirtySettings = await getDirtySettings(db);
    if (dirtySettings && (await attempt(() => saveRemoteSettings(dirtySettings.settings))) !== 'retry') {
      await clearSettingsDirty(db, dirtySettings.raw);
    }
    const profile = await getDirtyProfile(db);
    if (profile) {
      // Uten fornavn godtar ikke serveren profilen; da venter vi til brukeren har fylt det ut.
      const result = profile.fields.firstName ? await attempt(() => saveRemoteProfile(profile.fields)) : null;
      if (profile.fields.firstName && result !== 'retry') await clearProfileDirty(db, profile.raw);
    }

    // 6. Profilbilde: last opp nytt bilde eller fjern det.
    const photo = await getPendingPhoto(db);
    if (photo?.action === 'upload') {
      let url: string | null = null;
      const result = await attempt(async () => {
        url = await uploadAvatar(photo.uri);
      });
      if (result === null) await completePendingPhoto(db, photo.fileName, url);
      else if (result !== 'retry') {
        // Avvist bilde prøves ikke igjen automatisk; det vises lokalt til brukeren velger et nytt.
        console.warn('[synk] Profilbildet ble avvist av serveren:', result);
        await markPendingPhotoFailed(db);
      }
    } else if (photo?.action === 'remove') {
      if ((await attempt(() => deleteRemoteAvatar())) !== 'retry') await completePendingPhoto(db, null, null);
    }

    // 7. Bilder på økter (etter at øktene er lastet opp).
    for (const p of await listPhotoDeletions(db)) {
      if ((await attempt(() => deleteRemotePhoto(p.workoutId, p.id))) !== 'retry') await clearPhotoDeletion(db, p.id);
    }
    for (const p of await listPhotosToUpload(db)) {
      let url = '';
      const result = await attempt(async () => {
        url = await uploadPhoto(p.workoutId, p.id, p.uri);
      });
      if (result === null) await markPhotoUploaded(db, p.id, url);
      else if (result !== 'retry') {
        console.warn('[synk] Bildet ble avvist av serveren:', result);
        await markPhotoFailed(db, p.id, result);
      }
    }
  } catch (error) {
    if (!(error instanceof Offline)) throw error;
  }
  return report;
}

/** Henter øvelseskatalogen og lagrer den lokalt. Feiler stille offline; da brukes forrige kopi. */
export async function refreshExerciseCatalog(db: SQLiteDatabase): Promise<boolean> {
  try {
    const exercises = await fetchExerciseCatalog();
    if (exercises.length > 0) await replaceCatalog(db, exercises);
    return true;
  } catch {
    return false;
  }
}
