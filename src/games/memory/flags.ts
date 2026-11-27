/**
 * Flags for the hard level. The SVGs in ./svg are copied from flag-icons (MIT, licence in ./svg),
 * the same files as in the World Flags game (games must not import each other).
 */

/** [code, English, Slovak] — well-known countries only */
const ROWS: [string, string, string][] = [
  ['sk', 'Slovakia', 'Slovensko'], ['cz', 'Czechia', 'Česko'], ['de', 'Germany', 'Nemecko'],
  ['fr', 'France', 'Francúzsko'], ['it', 'Italy', 'Taliansko'], ['gb', 'United Kingdom', 'Veľká Británia'],
  ['us', 'USA', 'USA'], ['jp', 'Japan', 'Japonsko'], ['pl', 'Poland', 'Poľsko'],
  ['at', 'Austria', 'Rakúsko'], ['ua', 'Ukraine', 'Ukrajina'], ['se', 'Sweden', 'Švédsko'],
  ['ch', 'Switzerland', 'Švajčiarsko'], ['gr', 'Greece', 'Grécko'], ['ca', 'Canada', 'Kanada'],
  ['br', 'Brazil', 'Brazília'], ['cn', 'China', 'Čína'], ['hu', 'Hungary', 'Maďarsko'],
  ['nl', 'Netherlands', 'Holandsko'], ['fi', 'Finland', 'Fínsko'],
];

export const FLAG_CODES = ROWS.map((r) => r[0]);
export const flagName = (code: string, lang: string): string => {
  const r = ROWS.filter((x) => x[0] === code)[0];
  return r ? (lang === 'sk' ? r[2] : r[1]) : code;
};

/** Flags that are easy to mix up never appear in the same game. */
export const LOOKALIKE: string[][] = [
  ['it', 'hu'], ['se', 'ch', 'fi'], ['nl', 'fr'], ['pl', 'at', 'ca'], ['gr', 'fi'],
];

const urls = import.meta.glob<string>('./svg/*.svg', { query: '?url', import: 'default', eager: true });
export const flagUrl = (code: string): string => urls[`./svg/${code}.svg`];
