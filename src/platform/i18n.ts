import { storage } from './storage';

/**
 * Languages. To add one: extend `Lang`, add it to LANGS, then add its
 * strings next to the `en` ones (platform config + each game).
 * Missing translations fall back to English.
 */
export type Lang = 'en' | 'sk';

/** A piece of text in several languages. English is required. */
export type Text = { en: string } & Partial<Record<Lang, string>>;

/** A dictionary of strings/functions per language. English is required. */
export type Dict<T> = { en: T } & Partial<Record<Lang, T>>;

const FLAG_SK = `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#EE1C25"/><rect width="30" height="13.33" fill="#0B4EA2"/><rect width="30" height="6.67" fill="#fff"/><path d="M7 4.5h8v6c0 4-2.5 5.6-4 6.3-1.5-.7-4-2.3-4-6.3z" fill="#EE1C25" stroke="#fff" stroke-width="1"/><path d="M11 6.5v8M9 8.5h4M8.6 11h4.8" stroke="#fff" stroke-width="1.1"/><path d="M7.6 13.4q1.7-1.6 3.4 0 1.7-1.6 3.4 0-1 2.4-3.4 3.4-2.4-1-3.4-3.4z" fill="#0B4EA2"/></svg>`;
const FLAG_EN = `<svg viewBox="0 0 60 30"><clipPath id="ukc"><rect width="60" height="30"/></clipPath><g clip-path="url(#ukc)"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" stroke-width="2.4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`;

export const LANGS: { id: Lang; name: string; flag: string }[] = [
  { id: 'sk', name: 'Slovenčina', flag: FLAG_SK },
  { id: 'en', name: 'English', flag: FLAG_EN },
];

function detect(): Lang {
  const saved = storage.get('lang');
  if (LANGS.some((l) => l.id === saved)) return saved as Lang;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('sk') || nav.startsWith('cs') ? 'sk' : 'en';
}

let lang: Lang = detect();
document.documentElement.lang = lang;

export const getLang = (): Lang => lang;

export function setLang(l: Lang): void {
  lang = l;
  storage.set('lang', l);
  document.documentElement.lang = l;
}

/** Resolve a Text (or plain string) in the current language. */
export function tx(t: Text | string): string {
  return typeof t === 'string' ? t : (t[lang] ?? t.en);
}

/** Pick the current language's entry from a dictionary. */
export function pickLang<T>(dict: Dict<T>): T {
  return dict[lang] ?? dict.en;
}
