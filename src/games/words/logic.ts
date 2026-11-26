/**
 * Word Grid logic: tiles, dictionary lookup, board solver and generator.
 * No DOM here.
 *
 * Words are handled in an "encoded" form where every tile is one character:
 * Slovak "ch" is one letter of the alphabet, so it becomes the single char "C"
 * (all real words are lowercase, so "C" never clashes with a real letter).
 */

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

/** Neighbours of every cell, diagonals included. */
export const NEIGHBOURS: number[][] = Array.from({ length: CELLS }, (_, i) => {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
  return out;
});
export const adjacent = (a: number, b: number): boolean => NEIGHBOURS[a].indexOf(b) >= 0;

export const encode = (word: string): string => word.replace(/ch/g, 'C');
export const decode = (enc: string): string => enc.replace(/C/g, 'ch');
/** Text shown on a tile ("CH", "Ô", …). */
export const tileLabel = (t: string): string => (t === 'C' ? 'CH' : t.toUpperCase());

export interface Dict {
  /** Sorted encoded words that are accepted at all (target words included). */
  accept: string[];
  /** Encoded target word → tier (1 = very common, 2 = well known). */
  target: Map<string, number>;
  /** Tile → weight, from the letters of the target words (for filling boards). */
  weights: [string, number][];
}

/**
 * targetTsv: "word<TAB>tier" lines; acceptTxt: one word per line.
 * The accept list is already sorted by the build script, but sort again if not.
 */
export function buildDict(targetTsv: string, acceptTxt: string): Dict {
  const target = new Map<string, number>();
  const counts: Record<string, number> = {};
  for (const line of targetTsv.split('\n')) {
    const [w, t] = line.trim().split('\t');
    if (!w) continue;
    const e = encode(w);
    target.set(e, Number(t) || 2);
    for (const ch of e) counts[ch] = (counts[ch] || 0) + 1;
  }
  const set: Record<string, true> = {};
  for (const w of acceptTxt.split('\n')) if (w) set[encode(w.trim())] = true;
  target.forEach((_, w) => (set[w] = true));
  const accept = Object.keys(set);
  accept.sort();
  return { accept, target, weights: Object.keys(counts).map((k) => [k, counts[k]] as [string, number]) };
}

/** Index of the first word >= s. */
function lowerBound(arr: string[], s: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
const hasPrefix = (arr: string[], p: string): boolean => {
  const i = lowerBound(arr, p);
  return i < arr.length && arr[i].slice(0, p.length) === p;
};
export const isWord = (d: Dict, w: string): boolean => {
  const i = lowerBound(d.accept, w);
  return i < d.accept.length && d.accept[i] === w;
};

/** Every word (≥ 3 tiles) on the board, with the first path found for it. */
export function solve(d: Dict, tiles: string[]): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const used: boolean[] = Array(CELLS).fill(false);
  const path: number[] = [];
  const walk = (cell: number, prefix: string) => {
    const w = prefix + tiles[cell];
    if (!hasPrefix(d.accept, w)) return;
    used[cell] = true;
    path.push(cell);
    if (path.length >= 3 && !found.has(w) && isWord(d, w)) found.set(w, path.slice());
    for (const n of NEIGHBOURS[cell]) if (!used[n]) walk(n, w);
    path.pop();
    used[cell] = false;
  };
  for (let i = 0; i < CELLS; i++) walk(i, '');
  return found;
}

export interface LevelRule {
  tiers: number;     // target words have tier <= tiers
  maxLen: number;    // target words have at most this many tiles
  minWords: number;
  maxWords: number;
  /** Ideal number of words; the generator keeps looking for a board close to it. */
  goal: number;
  /** Hard: the board must hold a target word at least this long (0 = no rule). */
  bigWord: number;
  /** Length range of the word planted on the board first. */
  seedLen: [number, number];
}

export const isTarget = (d: Dict, rule: LevelRule, w: string): boolean => {
  const t = d.target.get(w);
  return t !== undefined && t <= rule.tiers && w.length <= rule.maxLen;
};

export interface Board {
  tiles: string[];
  /** Target words → path, sorted by length then alphabet. */
  words: [string, number[]][];
  /** The planted word (used to avoid repeating boards). */
  seed: string;
}

function weightedPick(weights: [string, number][], total: number): string {
  let r = Math.random() * total;
  for (const [k, w] of weights) if ((r -= w) < 0) return k;
  return weights[weights.length - 1][0];
}

/** A random self-avoiding path of `len` cells (or null if it got stuck). */
function randomPath(len: number): number[] | null {
  const path = [Math.floor(Math.random() * CELLS)];
  while (path.length < len) {
    const free = NEIGHBOURS[path[path.length - 1]].filter((n) => path.indexOf(n) < 0);
    if (!free.length) return null;
    path.push(free[Math.floor(Math.random() * free.length)]);
  }
  return path;
}

/**
 * Plant a target word along a random path, fill the rest with letters weighted
 * like the target words, solve, and keep the board if its word count fits the
 * level. Returns the best board found within `tries` attempts.
 */
export function generate(d: Dict, rule: LevelRule, avoid: string[], tries = 400): Board | null {
  const seeds: string[] = [];
  d.target.forEach((t, w) => {
    if (t <= rule.tiers && w.length >= rule.seedLen[0] && w.length <= rule.seedLen[1] && avoid.indexOf(w) < 0) seeds.push(w);
  });
  const total = d.weights.reduce((s, [, w]) => s + w, 0);
  let best: Board | null = null;
  let bestMiss = Infinity;
  for (let k = 0; k < tries; k++) {
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    const path = randomPath(seed.length);
    if (!path) continue;
    const tiles: string[] = Array(CELLS).fill('');
    path.forEach((cell, i) => (tiles[cell] = seed[i]));
    for (let i = 0; i < CELLS; i++) if (!tiles[i]) tiles[i] = weightedPick(d.weights, total);
    // At most two copies of a tile: boards full of the same letter look odd.
    const seen: Record<string, number> = {};
    if (tiles.some((t) => (seen[t] = (seen[t] || 0) + 1) > 2)) continue;

    const words: [string, number[]][] = [];
    solve(d, tiles).forEach((p, w) => isTarget(d, rule, w) && words.push([w, p]));
    const n = words.length;
    const big = !rule.bigWord || words.some(([w]) => w.length >= rule.bigWord);
    const out = (n < rule.minWords ? rule.minWords - n : n > rule.maxWords ? n - rule.maxWords : 0) + (big ? 0 : 5);
    const miss = out * 100 + Math.abs(n - rule.goal);
    if (miss < bestMiss) {
      words.sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
      best = { tiles, words, seed };
      bestMiss = miss;
      if (miss <= 1) break;
    }
  }
  return best;
}

/** Points for a word of `len` tiles. */
export const points = (len: number): number => (len <= 3 ? 1 : len === 4 ? 2 : len === 5 ? 3 : 5);
