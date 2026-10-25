export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const GENDER_LABELS: Record<Gender, string> = { MALE: 'Mann', FEMALE: 'Kvinne', OTHER: 'Annet' };

/** Profilfeltene brukeren redigerer. Speiler backend ProfileDto. Tomme felt er null. */
export type ProfileFields = {
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  /** ÅÅÅÅ-MM-DD */
  birthDate: string | null;
  gender: Gender | null;
  /** Brukernavn uten «@». */
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  /** Offentlig profil (standard) eller privat. Private profiler viser bare navn, bilde og bio til andre. */
  visibility: Visibility | null;
};

export type Visibility = 'PUBLIC' | 'PRIVATE';

export const EMPTY_PROFILE: ProfileFields = {
  firstName: null,
  lastName: null,
  bio: null,
  birthDate: null,
  gender: null,
  instagram: null,
  tiktok: null,
  youtube: null,
  website: null,
  visibility: null,
};

export type Profile = ProfileFields & {
  /** Unikt @brukernavn (uten «@»). null = velkomstflyten er ikke fullført. */
  username: string | null;
  displayName: string | null;
  /** Profilbildet: lokal fil som venter på opplasting, ellers adressen på serveren. */
  photoUri: string | null;
  /** USER, MODERATOR eller ADMIN (fra serveren). Moderatorer får Moderering i innstillingene. */
  role: UserRole;
  /** Gjeldende vilkår er ikke godtatt ennå (eller er endret siden sist). */
  mustAcceptTerms: boolean;
};

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

/** Siste dag man kan være født for å ha fylt 13 år (aldersgrensen). */
export function latestAllowedBirthDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
}

/** Lokale regler for brukernavn (serveren avgjør til slutt, inkludert reserverte navn). */
export function usernameProblem(username: string): string | null {
  if (username.length < 3) return 'Minst 3 tegn';
  if (username.length > 30) return 'Maks 30 tegn';
  if (!/^[a-z0-9._]+$/.test(username)) return 'Bare bokstavene a–z, tall, punktum og understrek';
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) return 'Punktum kan ikke stå først, sist eller to på rad';
  return null;
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, '');
}

/** Forslag til brukernavn ut fra navnet: «Sigurd Mæland» → «sigurd.maeland». */
export function suggestUsername(first: string, last: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'a')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  return [clean(first), clean(last)].filter(Boolean).join('.').slice(0, 30);
}

export function displayNameOf(p: Pick<ProfileFields, 'firstName' | 'lastName'>): string | null {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

/** Fjerner «@», mellomrom og en eventuell lenke foran brukernavnet. */
export function normalizeHandle(input: string): string | null {
  const v = input.trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/^@+/, '').replace(/\/$/, '');
  return v || null;
}
