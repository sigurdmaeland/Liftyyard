import type { BodyCrop, MuscleLoad } from '@/components/body-map';
import type { Exercise } from '@/types/workout';

/**
 * Øvelseskategorier i Utforsk og øvelsesbiblioteket. En øvelse hører til en kategori når en av
 * de primære musklene er med i kategorien. «Cardio» er øvelser med distanse og tid.
 * «Nakke» bruker trapezius (nakke-/kappemuskelen), som er det nærmeste i muskellisten vår.
 */
export type Category = {
  key: string;
  label: string;
  muscles: string[];
  side: 'front' | 'back';
  crop: BodyCrop;
};

export const CATEGORIES: Category[] = [
  { key: 'CHEST', label: 'Bryst', muscles: ['CHEST'], side: 'front', crop: 'upper' },
  { key: 'BICEPS', label: 'Biceps', muscles: ['BICEPS'], side: 'front', crop: 'upper' },
  { key: 'TRICEPS', label: 'Triceps', muscles: ['TRICEPS'], side: 'back', crop: 'upper' },
  { key: 'BACK', label: 'Rygg', muscles: ['LATS', 'UPPER_BACK', 'LOWER_BACK'], side: 'back', crop: 'upper' },
  { key: 'SHOULDERS', label: 'Skuldre', muscles: ['SHOULDERS'], side: 'front', crop: 'upper' },
  { key: 'ABS', label: 'Mage', muscles: ['ABS', 'OBLIQUES'], side: 'front', crop: 'upper' },
  { key: 'QUADS', label: 'Quadriceps', muscles: ['QUADS', 'ADDUCTORS'], side: 'front', crop: 'lower' },
  { key: 'HAMSTRINGS', label: 'Hamstrings', muscles: ['HAMSTRINGS'], side: 'back', crop: 'lower' },
  { key: 'GLUTES', label: 'Rumpe', muscles: ['GLUTES', 'ABDUCTORS'], side: 'back', crop: 'lower' },
  { key: 'CALVES', label: 'Legger', muscles: ['CALVES'], side: 'back', crop: 'lower' },
  { key: 'FOREARMS', label: 'Underarmer', muscles: ['FOREARMS'], side: 'front', crop: 'upper' },
  { key: 'NECK', label: 'Nakke', muscles: ['TRAPS'], side: 'back', crop: 'upper' },
  { key: 'CARDIO', label: 'Cardio', muscles: [], side: 'front', crop: 'full' },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function inCategory(e: Pick<Exercise, 'primaryMuscles' | 'exerciseType'>, category: Category): boolean {
  if (category.key === 'CARDIO') return e.exerciseType === 'DISTANCE_DURATION';
  return e.primaryMuscles.some((m) => category.muscles.includes(m));
}

/** Kategorien som vises under navnet på et øvelseskort (første treff i rekkefølgen over). */
export function primaryCategory(e: Pick<Exercise, 'primaryMuscles' | 'exerciseType'>): Category | null {
  return CATEGORIES.find((c) => inCategory(e, c)) ?? null;
}

/** Muskelbelastning for å fargelegge kategorifiguren. */
export function categoryLoad(category: Category): MuscleLoad {
  return new Map(category.muscles.map((m) => [m, 'PRIMARY' as const]));
}

/** Figurside for et øvelseskort: der flest av de primære musklene sitter. */
export function exerciseFigure(e: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>): { side: 'front' | 'back'; load: MuscleLoad } {
  const BACK = new Set(['LATS', 'UPPER_BACK', 'LOWER_BACK', 'TRAPS', 'TRICEPS', 'GLUTES', 'HAMSTRINGS', 'CALVES', 'ABDUCTORS']);
  const backCount = e.primaryMuscles.filter((m) => BACK.has(m)).length;
  const load: MuscleLoad = new Map();
  e.secondaryMuscles.forEach((m) => load.set(m, 'SECONDARY'));
  e.primaryMuscles.forEach((m) => load.set(m, 'PRIMARY'));
  return { side: backCount > e.primaryMuscles.length / 2 ? 'back' : 'front', load };
}
