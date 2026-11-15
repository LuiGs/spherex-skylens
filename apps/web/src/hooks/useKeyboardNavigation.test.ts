import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW } from '../lib/urlState';
import { keyToAction, keyToViewPatch } from './useKeyboardNavigation';

const view = { ...DEFAULT_VIEW, ra: 10, dec: 0, fov: 1 };

describe('keyToViewPatch', () => {
  it('pans with WASD and arrows, east to the left', () => {
    expect(keyToViewPatch('w', view, true)).toEqual({ dec: 0.15 });
    expect(keyToViewPatch('ArrowDown', view, true)).toEqual({ dec: -0.15 });
    expect(keyToViewPatch('a', view, true)?.ra).toBeCloseTo(10.15);
    expect(keyToViewPatch('D', view, true)?.ra).toBeCloseTo(9.85);
  });

  it('ignores arrows while another panel owns them', () => {
    expect(keyToViewPatch('ArrowLeft', view, false)).toBeNull();
    expect(keyToViewPatch('a', view, false)).not.toBeNull();
  });

  it('zooms with +/- and Q/E and clamps the poles', () => {
    expect(keyToViewPatch('+', view, true)?.fov).toBeCloseTo(1 / 1.4);
    expect(keyToViewPatch('q', view, true)?.fov).toBeCloseTo(1.4);
    expect(keyToViewPatch('w', { ...view, dec: 89.95 }, true)).toEqual({ dec: 90 });
    expect(keyToViewPatch('x', view, true)).toBeNull();
  });
});

describe('keyToAction', () => {
  it('maps H, ? and Space to the panel, help and timelapse', () => {
    const actions = { togglePanel: () => {}, help: () => {}, timelapse: () => {} };
    expect(keyToAction('h', actions)).toBe(actions.togglePanel);
    expect(keyToAction('H', actions)).toBe(actions.togglePanel);
    expect(keyToAction('?', actions)).toBe(actions.help);
    expect(keyToAction(' ', actions)).toBe(actions.timelapse);
    expect(keyToAction(' ', {})).toBeUndefined();
    expect(keyToAction('w', actions)).toBeUndefined();
  });
});
