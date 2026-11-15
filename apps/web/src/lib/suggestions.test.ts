import { describe, expect, it } from 'vitest';
import { normalizeQuery, suggestFor, MAX_SUGGESTIONS } from './suggestions';

describe('suggestFor', () => {
  it('ignores accents, case and spacing', () => {
    expect(normalizeQuery('Próxima  Centauri!')).toBe('proximacentauri');
    expect(suggestFor('andromeda', 'es')[0]?.id).toBe('m31');
    expect(suggestFor('ANDRÓMEDA', 'en')[0]?.id).toBe('m31');
  });

  it('matches aliases and catalogue numbers in either language', () => {
    expect(suggestFor('M 42', 'es')[0]?.id).toBe('m42');
    expect(suggestFor('orion', 'es')[0]?.id).toBe('m42');
    expect(suggestFor('seven sisters', 'es')[0]?.id).toBe('m45');
    expect(suggestFor('pilares', 'en')[0]?.id).toBe('m16');
  });

  it('puts prefix matches before matches inside a word and caps the list', () => {
    const ids = suggestFor('ne', 'es').map((item) => item.id);
    expect(ids.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(suggestFor('nebulosa', 'es').length).toBeGreaterThan(3);
    expect(suggestFor('m', 'es')).toEqual([]);
    expect(suggestFor('zzzz', 'en')).toEqual([]);
  });
});
