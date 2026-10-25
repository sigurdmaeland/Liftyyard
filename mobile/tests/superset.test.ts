import { describe, expect, it } from '@jest/globals';

import { restsAfterSet } from '@/lib/superset';

const ex = (id: string, supersetGroup: number | null) => ({ id, supersetGroup });

describe('restsAfterSet', () => {
  const list = [ex('a', null), ex('b', 1), ex('c', 1), ex('d', 1), ex('e', null), ex('f', 2), ex('g', 2)];

  it('hviler etter vanlige øvelser', () => {
    expect(restsAfterSet(list, 'a')).toBe(true);
    expect(restsAfterSet(list, 'e')).toBe(true);
  });

  it('hviler ikke mellom øvelsene i et supersett', () => {
    expect(restsAfterSet(list, 'b')).toBe(false);
    expect(restsAfterSet(list, 'c')).toBe(false);
    expect(restsAfterSet(list, 'f')).toBe(false);
  });

  it('hviler etter siste øvelse i supersettet, også når den er sist i økten', () => {
    expect(restsAfterSet(list, 'd')).toBe(true);
    expect(restsAfterSet(list, 'g')).toBe(true);
  });

  it('ukjent øvelse gir vanlig hvile', () => {
    expect(restsAfterSet(list, 'x')).toBe(true);
  });
});
