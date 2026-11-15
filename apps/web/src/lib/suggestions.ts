import { SUGGESTIONS, type Suggestion } from '../data/suggestions';
import type { Lang } from './i18n';

export const MAX_SUGGESTIONS = 6;

export function normalizeQuery(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9*]/g, '');
}

function terms(item: Suggestion): string[] {
  return [item.name.es, item.name.en, ...item.aliases].map(normalizeQuery);
}

/** Matches typed text against names and aliases: prefix matches first, then matches anywhere. */
export function suggestFor(query: string, lang: Lang): Suggestion[] {
  const wanted = normalizeQuery(query);
  if (wanted.length < 2) return [];
  const scored = SUGGESTIONS.map((item) => {
    const words = terms(item);
    const score = words.some((w) => w.startsWith(wanted))
      ? 2
      : words.some((w) => w.includes(wanted))
        ? 1
        : 0;
    return { item, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name[lang].localeCompare(b.item.name[lang]));
  return scored.slice(0, MAX_SUGGESTIONS).map(({ item }) => item);
}
