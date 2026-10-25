import { describe, expect, it } from '@jest/globals';

import { uuidv7 } from '@/lib/ids';

describe('uuidv7', () => {
  it('har riktig format, versjon og variant', () => {
    const id = uuidv7(1_760_000_000_000, new Uint8Array(16).fill(0xff));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('er sortert etter tid', () => {
    const r = new Uint8Array(16);
    expect(uuidv7(1000, r) < uuidv7(2000, r)).toBe(true);
  });
  it('koder tidsstempelet i de første 48 bitene', () => {
    const id = uuidv7(0x0123456789ab, new Uint8Array(16));
    expect(id.startsWith('01234567-89ab-7')).toBe(true);
  });
});
