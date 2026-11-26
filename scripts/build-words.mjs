#!/usr/bin/env node
/**
 * Builds the word data for the Word Grid game (src/games/words/data/).
 * Not part of the site build; run by hand when the word lists change:
 *
 *   node scripts/build-words.mjs
 *
 * - <lang>-accept.txt: every dictionary base form of 3–7 tiles. Any of these found on a board
 *   counts as a "bonus word". Generated from the Hunspell dictionaries (see data/LICENSE-*.txt).
 * - <lang>-target.tsv: the hand-curated list of words children know ("word<TAB>tier").
 *   It is edited by hand; this script only checks it, normalises it and sorts it.
 *
 * Downloads are cached in node_modules/.cache/words.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'src/games/words/data');
const CACHE = path.join(ROOT, 'node_modules/.cache/words');
const LO = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master';

const LANGS = {
  en: { dic: `${LO}/en/en_US.dic`, nosuggest: '!', letters: /^[a-z]+$/ },
  sk: { dic: `${LO}/sk_SK/sk_SK.dic`, nosuggest: '$', letters: /^[a-záäčďéíľĺňóôŕšťúýž]+$/ },
};

/**
 * Vulgar or hurtful words that must never count, even as bonus words:
 * `stems` match the start of a word (only stems that don't start ordinary words), `words` match exactly.
 */
const BLOCK_RULES = {
  en: {
    stems: ['fuck', 'shit', 'cunt', 'nigg', 'whore', 'porn', 'wank', 'slut', 'bitch', 'pussy', 'bastard', 'twat', 'dildo', 'penis', 'vagin', 'boob', 'horny'],
    words: ['ass', 'arse', 'arsed', 'crap', 'cum', 'damn', 'dick', 'dyke', 'fag', 'faggot', 'hell', 'homo', 'kike', 'piss', 'prick', 'queer', 'rape', 'raped', 'rapist', 'sex', 'sexy', 'spic', 'tit', 'tits', 'titty', 'cock', 'jizz', 'turd', 'nazi', 'retard'],
  },
  sk: {
    stems: ['kurv', 'jeb', 'pič', 'kokot', 'chuj', 'čurák', 'sráč', 'srat', 'srať', 'hovn', 'zasran', 'prdel', 'kund', 'buzer', 'šuk', 'mrd', 'debil', 'kretén', 'idiot', 'cigán', 'negr', 'porn', 'sex', 'drog', 'vagín', 'penis'],
    words: ['riť', 'sral', 'sraľ', 'pica', 'piča'],
  },
};
const BLOCK = Object.fromEntries(
  Object.entries(BLOCK_RULES).map(([l, r]) => [l, { test: (w) => r.words.includes(w) || r.stems.some((s) => w.startsWith(s)) }]),
);

/** Bonus words longer than this are very rare on a 3×3 board; leaving them out halves the download. */
const MAX_BONUS = 7;
const tiles = (w) => w.replace(/ch/g, 'C').length;

async function get(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, path.basename(url));
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file, 'utf8');
}

/** Same order as JS string comparison on the encoded form ("ch" → "C"), used by the game. */
const sortEncoded = (words) =>
  words
    .map((w) => [w.replace(/ch/g, 'C'), w])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map((x) => x[1]);

for (const [lang, cfg] of Object.entries(LANGS)) {
  const dic = await get(cfg.dic);
  const accept = new Set();
  const known = new Set(); // every dictionary word, for checking the target list
  for (const line of dic.split('\n').slice(1)) {
    const [head, ...rest] = line.trim().split(/\s+/);
    if (!head) continue;
    const [w, flags = ''] = head.split('/');
    known.add(w);
    if (flags.includes(cfg.nosuggest)) continue;
    const po = (rest.find((r) => r.startsWith('po:')) || '').slice(3);
    if (['acronym', 'pronoun', 'preposition', 'conjunction', 'particle', 'interjection'].includes(po)) continue;
    if (!cfg.letters.test(w) || tiles(w) < 3 || tiles(w) > MAX_BONUS || BLOCK[lang].test(w)) continue;
    accept.add(w);
  }

  const targetFile = path.join(OUT, `${lang}-target.tsv`);
  const target = new Map();
  for (const line of fs.readFileSync(targetFile, 'utf8').split('\n')) {
    const [raw, tier] = line.split('\t');
    const w = (raw || '').trim().toLowerCase();
    if (!w) continue;
    if (!cfg.letters.test(w) || tiles(w) < 3 || tiles(w) > 9) { console.warn(`${lang}: skipped "${w}" (letters/length)`); continue; }
    if (BLOCK[lang].test(w)) { console.warn(`${lang}: skipped "${w}" (blocked)`); continue; }
    if (!known.has(w)) console.warn(`${lang}: "${w}" is not in the dictionary (kept)`);
    const t = tier && tier.trim() === '1' ? 1 : 2;
    target.set(w, Math.min(t, target.get(w) || 2));
  }

  fs.writeFileSync(targetFile, sortEncoded([...target.keys()]).map((w) => `${w}\t${target.get(w)}`).join('\n') + '\n');
  // Target words are added to the accept list by the game itself, so they're not repeated here.
  const acc = sortEncoded([...accept].filter((w) => !target.has(w)));
  fs.writeFileSync(path.join(OUT, `${lang}-accept.txt`), acc.join('\n') + '\n');
  console.log(`${lang}: ${target.size} target words, ${acc.length} more accepted words`);
}
