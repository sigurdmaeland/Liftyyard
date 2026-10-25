import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';
import { EMPTY_PROFILE, type Profile, type ProfileFields, type UserRole, displayNameOf } from '@/types/profile';

/*
 * Brukerens egen profil på telefonen.
 * - Profilfeltene lagres som JSON i user_settings og synkes til serveren (PUT /api/me).
 * - Brukernavn og bildeadresse er serverens (satt via egne kall) og speiles her.
 * - Et nytt profilbilde kopieres først til appens dokumentmappe og lastes opp ved neste synk.
 *   Vi lagrer filnavnet, ikke hele stien, fordi iOS kan flytte appens mappe ved oppdateringer.
 */

const PROFILE_KEY = 'profile';
/** Fra første versjon, da bare navnet kunne endres. Leses som fornavn hvis profilen ikke finnes. */
const LEGACY_NAME_KEY = 'display_name';
/** Lokal bildefil som venter på opplasting. */
const PHOTO_KEY = 'photo_file';
/** 'upload' eller 'remove' når bildet er endret lokalt og ikke synket. */
const PHOTO_PENDING_KEY = 'photo_pending';
const USERNAME_KEY = 'username';
const AVATAR_URL_KEY = 'avatar_url';
const ROLE_KEY = 'role';
/** Vilkårsversjonen brukeren har godtatt, og den serveren krever nå. */
const TERMS_ACCEPTED_KEY = 'terms_accepted';
const TERMS_CURRENT_KEY = 'terms_current';

async function read(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function write(db: SQLiteDatabase, key: string, value: string | null, dirty: boolean) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, dirty = excluded.dirty`,
    key,
    value,
    dirty ? 1 : 0,
  );
}

async function readFields(db: SQLiteDatabase): Promise<ProfileFields> {
  const json = await read(db, PROFILE_KEY);
  if (json) return { ...EMPTY_PROFILE, ...(JSON.parse(json) as Partial<ProfileFields>) };
  const legacy = await read(db, LEGACY_NAME_KEY);
  return { ...EMPTY_PROFILE, firstName: legacy };
}

function localPhoto(fileName: string | null): string | null {
  if (!fileName) return null;
  const file = new File(Paths.document, fileName);
  return file.exists ? file.uri : null;
}

export async function getProfile(db: SQLiteDatabase): Promise<Profile> {
  const fields = await readFields(db);
  const pending = await read(db, PHOTO_PENDING_KEY);
  const photoUri = pending === 'remove' ? null : (localPhoto(await read(db, PHOTO_KEY)) ?? (await read(db, AVATAR_URL_KEY)));
  const current = await read(db, TERMS_CURRENT_KEY);
  return {
    ...fields,
    username: await read(db, USERNAME_KEY),
    displayName: displayNameOf(fields),
    photoUri,
    role: ((await read(db, ROLE_KEY)) ?? 'USER') as UserRole,
    // Vet vi ikke hva serveren krever (f.eks. uten nett), slipper vi brukeren inn.
    mustAcceptTerms: current !== null && current !== (await read(db, TERMS_ACCEPTED_KEY)),
  };
}

export async function saveProfileFields(db: SQLiteDatabase, fields: ProfileFields) {
  await write(db, PROFILE_KEY, JSON.stringify(fields), true);
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', LEGACY_NAME_KEY);
}

/** Brukernavnet er satt på serveren (PUT /api/me/username). */
export async function setLocalUsername(db: SQLiteDatabase, username: string | null) {
  await write(db, USERNAME_KEY, username, false);
}

/**
 * Nytt profilbilde (eller null for å fjerne). Bildet kopieres inn i appens dokumentmappe og
 * lastes opp ved neste synk, slik at det virker uten nett.
 */
export async function setProfilePhoto(db: SQLiteDatabase, sourceUri: string | null) {
  await deleteLocalPhotoFile(db);
  if (sourceUri) {
    const name = `profile-${uuidv7()}.jpg`;
    new File(sourceUri).copy(new File(Paths.document, name));
    await write(db, PHOTO_KEY, name, false);
    await write(db, PHOTO_PENDING_KEY, 'upload', false);
  } else {
    await write(db, PHOTO_KEY, null, false);
    await write(db, PHOTO_PENDING_KEY, 'remove', false);
  }
}

async function deleteLocalPhotoFile(db: SQLiteDatabase) {
  const previous = await read(db, PHOTO_KEY);
  if (previous) {
    const old = new File(Paths.document, previous);
    if (old.exists) old.delete();
  }
}

// ---------- Fra serveren ----------

export type ServerProfile = ProfileFields & {
  username: string | null;
  avatarUrl: string | null;
  role?: UserRole;
  acceptedTermsVersion?: string | null;
  currentTermsVersion?: string | null;
};

/**
 * Lagrer profilen slik serveren har den. Brukernavn og bilde oppdateres alltid; profilfeltene bare
 * hvis de ikke er endret lokalt (ellers vinner den lokale endringen ved neste synk).
 */
export async function applyServerProfile(db: SQLiteDatabase, p: ServerProfile) {
  const { username, avatarUrl, role, acceptedTermsVersion, currentTermsVersion, ...fields } = p;
  await setLocalUsername(db, username);
  await write(db, ROLE_KEY, role ?? 'USER', false);
  await write(db, TERMS_ACCEPTED_KEY, acceptedTermsVersion ?? null, false);
  if (currentTermsVersion) await write(db, TERMS_CURRENT_KEY, currentTermsVersion, false);
  if (!(await read(db, PHOTO_PENDING_KEY))) await write(db, AVATAR_URL_KEY, avatarUrl, false);
  const dirty = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM user_settings WHERE key = ? AND dirty = 1', PROFILE_KEY);
  if (!dirty?.n) await write(db, PROFILE_KEY, JSON.stringify({ ...EMPTY_PROFILE, ...fields }), false);
}

/** Sletter profilbildet fra telefonen (ved utlogging). */
export async function deleteLocalProfilePhoto(db: SQLiteDatabase) {
  await deleteLocalPhotoFile(db);
}

// ---------- Synk ----------

/** Profilen hvis den er endret lokalt og ikke sendt ennå. `raw` brukes for å fjerne flagget trygt. */
export async function getDirtyProfile(db: SQLiteDatabase): Promise<{ fields: ProfileFields; raw: string } | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ? AND dirty = 1', PROFILE_KEY);
  if (!row?.value) return null;
  return { fields: { ...EMPTY_PROFILE, ...(JSON.parse(row.value) as Partial<ProfileFields>) }, raw: row.value };
}

/** Fjerner dirty-flagget bare hvis profilen ikke er endret igjen mens opplastingen pågikk. */
export async function clearProfileDirty(db: SQLiteDatabase, raw: string) {
  await db.runAsync('UPDATE user_settings SET dirty = 0 WHERE key = ? AND value = ?', PROFILE_KEY, raw);
}

/** Bildeendring som venter: opplasting av en lokal fil, eller fjerning. */
export async function getPendingPhoto(db: SQLiteDatabase): Promise<{ action: 'upload'; uri: string; fileName: string } | { action: 'remove' } | null> {
  let pending = await read(db, PHOTO_PENDING_KEY);
  // Bilder valgt før profilbilder ble lagret på serveren, ligger bare på telefonen: last dem opp.
  if (pending === 'failed') return null;
  if (!pending && (await read(db, PHOTO_KEY)) && !(await read(db, AVATAR_URL_KEY))) pending = 'upload';
  if (pending === 'remove') return { action: 'remove' };
  if (pending === 'upload') {
    const fileName = await read(db, PHOTO_KEY);
    const uri = localPhoto(fileName);
    if (fileName && uri) return { action: 'upload', uri, fileName };
    await write(db, PHOTO_PENDING_KEY, null, false);
  }
  return null;
}

/** Serveren avviste profilbildet: behold det lokalt, men slutt å prøve. */
export async function markPendingPhotoFailed(db: SQLiteDatabase) {
  await write(db, PHOTO_PENDING_KEY, 'failed', false);
}

/**
 * Bildeendringen er synket. Lokal fil slettes og serverens adresse brukes, men bare hvis brukeren
 * ikke har valgt et nytt bilde mens opplastingen pågikk.
 */
export async function completePendingPhoto(db: SQLiteDatabase, handledFile: string | null, avatarUrl: string | null) {
  if ((await read(db, PHOTO_KEY)) !== handledFile) return;
  await deleteLocalPhotoFile(db);
  await write(db, PHOTO_KEY, null, false);
  await write(db, PHOTO_PENDING_KEY, null, false);
  await write(db, AVATAR_URL_KEY, avatarUrl, false);
}
