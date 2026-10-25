/**
 * Supersett: øvelser som står etter hverandre med samme supersetGroup tas annenhver gang,
 * uten pause mellom dem. Hvilen kommer først etter siste øvelse i supersettet.
 */
type Item = { id: string; supersetGroup: number | null };

/** Skal hviletimeren starte når et sett på denne øvelsen fullføres? */
export function restsAfterSet(exercises: Item[], exerciseId: string): boolean {
  const i = exercises.findIndex((e) => e.id === exerciseId);
  if (i < 0) return true;
  const group = exercises[i].supersetGroup;
  if (group === null) return true;
  const next = exercises[i + 1];
  return !next || next.supersetGroup !== group;
}
