import { describe, expect, it } from 'vitest';
import { detectLang, MESSAGES } from './i18n';

function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'fn';
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  return typeof value;
}

describe('i18n', () => {
  it('has the same keys in every language', () => {
    expect(shape(MESSAGES.en)).toEqual(shape(MESSAGES.es));
  });

  it('prefers the URL, then the stored choice, then English', () => {
    expect(detectLang('?lang=es', 'en')).toBe('es');
    expect(detectLang('?lang=en', 'es')).toBe('en');
    expect(detectLang('', 'es')).toBe('es');
    expect(detectLang('', null)).toBe('en');
    expect(detectLang('?lang=de', null)).toBe('en');
  });
});
