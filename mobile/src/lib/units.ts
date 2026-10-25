/*
 * Vektenhet for treningsvekter (sett, rutiner, volum og rekorder). Alt lagres i kg; bare visning
 * og inntasting regnes om. Kroppsvekt vises fortsatt i kg.
 */
export type WeightUnit = 'KG' | 'LB';

export const LB_PER_KG = 2.20462262;

let unit: WeightUnit = 'KG';
const listeners = new Set<() => void>();

export function getWeightUnit(): WeightUnit {
  return unit;
}

export function setWeightUnitInMemory(next: WeightUnit) {
  if (next === unit) return;
  unit = next;
  listeners.forEach((l) => l());
}

export function subscribeWeightUnit(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** «kg» eller «lb». */
export function unitLabel(u: WeightUnit = unit): string {
  return u === 'LB' ? 'lb' : 'kg';
}

/** kg → valgt enhet. Pund avrundes til 0,1. */
export function toDisplay(kg: number, u: WeightUnit = unit): number {
  return u === 'LB' ? Math.round(kg * LB_PER_KG * 10) / 10 : kg;
}

/** Valgt enhet → kg (lagres med tre desimaler så runde pund ikke driver). */
export function fromDisplay(value: number, u: WeightUnit = unit): number {
  return u === 'LB' ? Math.round((value / LB_PER_KG) * 1000) / 1000 : value;
}

/** «82,5 kg» / «181,9 lb». */
export function formatWeight(kg: number, maxDecimals = 1, u: WeightUnit = unit): string {
  return `${toDisplay(kg, u).toLocaleString('nb-NO', { maximumFractionDigits: maxDecimals, useGrouping: false })} ${unitLabel(u)}`;
}
