/** Standard vektskiver (kg) og fargene de vanligvis har (IWF-farger). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export type Plate = (typeof PLATES)[number];

export const PLATE_COLORS: Record<Plate, string> = {
  25: '#D93636',
  20: '#2A64F0',
  15: '#E0A82E',
  10: '#1F9D55',
  5: '#E8EAED',
  2.5: '#3A3F47',
  1.25: '#A7AFBA',
};

export type PlateResult = {
  /** Skiver på hver side, tyngst først. */
  perSide: Plate[];
  /** Vekten man faktisk får med skivene (kan være lavere enn målet). */
  achieved: number;
  /** Hva som mangler (0 hvis målet nås nøyaktig). */
  remainder: number;
};

/**
 * Hvilke skiver som trengs på hver side av stanga for å nå `target` kg. Bruker de tyngste skivene
 * først (grådig), som gir færrest skiver med vanlige skivesett.
 */
export function platesFor(target: number, bar = 20, available: readonly Plate[] = PLATES): PlateResult {
  if (!Number.isFinite(target) || target <= bar) return { perSide: [], achieved: bar, remainder: Math.max(0, target - bar) };
  let side = Math.round(((target - bar) / 2) * 1000) / 1000;
  const perSide: Plate[] = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side = Math.round((side - p) * 1000) / 1000;
    }
  }
  const achieved = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, achieved, remainder: Math.round((target - achieved) * 1000) / 1000 };
}
