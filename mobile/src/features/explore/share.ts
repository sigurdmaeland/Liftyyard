import type { Author } from '@/types/explore';
import type { ShareVisibility } from '@/types/program';

/** Tekster for deling av programmer og rutiner (i velgeren og på kortene). */
export const SHARE_DESCRIPTIONS: Record<ShareVisibility, string> = {
  PUBLIC: 'Alle kan finne og laste ned',
  FOLLOWERS: 'Følgerne dine kan finne og laste ned',
  PRIVATE: 'Bare deg',
};

/** Rekkefølgen i velgeren: privat først, siden det er standard for nye programmer og rutiner. */
export const SHARE_ORDER: ShareVisibility[] = ['PRIVATE', 'FOLLOWERS', 'PUBLIC'];

/** «@brukernavn», eller visningsnavnet for appens egne programmer. */
export function authorLabel(a: Author): string {
  return a.username ? `@${a.username}` : a.displayName;
}
