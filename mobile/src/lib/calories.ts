/**
 * Anslått energiforbruk for en styrkeøkt: MET × kroppsvekt (kg) × timer. Styrketrening ligger
 * rundt 3,5 (rolig) til 6 (hardt) MET; vi bruker 5 som et nøkternt middel. Dette er et grovt
 * anslag og vises alltid som det.
 */
export const STRENGTH_MET = 5;

export function estimateCalories(bodyWeightKg: number | null, seconds: number): number | null {
  if (!bodyWeightKg || bodyWeightKg <= 0 || seconds <= 0) return null;
  return Math.round(STRENGTH_MET * bodyWeightKg * (seconds / 3600));
}
