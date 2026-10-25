import { afterEach, describe, expect, it } from '@jest/globals';

import { formatWeight, fromDisplay, setWeightUnitInMemory, toDisplay } from '@/lib/units';
import { fromMeasurementDisplay, measurementLimits, measurementUnit, toMeasurementDisplay } from '@/types/measurement';

describe('vektenheter', () => {
  it('regner mellom kg og lb', () => {
    expect(toDisplay(100, 'LB')).toBe(220.5);
    expect(fromDisplay(225, 'LB')).toBeCloseTo(102.058, 3);
    expect(toDisplay(80, 'KG')).toBe(80);
  });
  it('runde pund overlever tur-retur', () => {
    expect(toDisplay(fromDisplay(135, 'LB'), 'LB')).toBe(135);
  });
  it('formaterer med enhet', () => {
    expect(formatWeight(82.5, 1, 'KG')).toBe('82,5 kg');
    expect(formatWeight(100, 0, 'LB')).toBe('221 lb');
  });
});

describe('kroppsvekt i valgt enhet', () => {
  afterEach(() => setWeightUnitInMemory('KG'));

  it('viser og lagrer kg uendret', () => {
    expect(measurementUnit('WEIGHT')).toBe('kg');
    expect(toMeasurementDisplay('WEIGHT', 82.5)).toBe(82.5);
    expect(fromMeasurementDisplay('WEIGHT', 82.5)).toBe(82.5);
    expect(measurementLimits('WEIGHT')).toEqual({ min: 20, max: 400 });
  });

  it('viser pund, men lagrer kg', () => {
    setWeightUnitInMemory('LB');
    expect(measurementUnit('WEIGHT')).toBe('lb');
    expect(toMeasurementDisplay('WEIGHT', 100)).toBe(220.5);
    expect(fromMeasurementDisplay('WEIGHT', 220.5)).toBe(100.02);
    expect(measurementLimits('WEIGHT')).toEqual({ min: 45, max: 881 });
  });

  it('rører ikke cm og prosent', () => {
    setWeightUnitInMemory('LB');
    expect(measurementUnit('WAIST')).toBe('cm');
    expect(toMeasurementDisplay('WAIST', 80)).toBe(80);
    expect(fromMeasurementDisplay('BODY_FAT', 15.555)).toBe(15.56);
  });
});
