/**
 * Pure logic for Memory Pairs (no DOM): building the deck and fitting the grid.
 */

/** What is printed on the face of one card. */
export type Face =
  | { kind: 'pic'; pic: number }
  | { kind: 'flag'; code: string }
  | { kind: 'name'; code: string }
  | { kind: 'clock'; h: number; m: number }
  | { kind: 'time'; h: number; m: number }
  | { kind: 'mul'; a: number; b: number }
  | { kind: 'num'; n: number };

export interface Card {
  /** position in the deck */
  id: number;
  /** both cards of a pair share this number */
  pair: number;
  face: Face;
}

type Rand = () => number;

export function shuffleWith<T>(arr: readonly T[], rnd: Rand = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function deal(pairs: [Face, Face][], rnd: Rand): Card[] {
  const cards: Omit<Card, 'id'>[] = [];
  pairs.forEach(([a, b], pair) => { cards.push({ pair, face: a }, { pair, face: b }); });
  return shuffleWith(cards, rnd).map((c, id) => ({ ...c, id }));
}

/** Easy / medium: `pairs` identical picture pairs, chosen from `picCount` pictures. */
export function pictureDeck(pairs: number, picCount: number, rnd: Rand = Math.random): Card[] {
  const pics = shuffleWith(Array.from({ length: picCount }, (_, i) => i), rnd).slice(0, pairs);
  return deal(pics.map((pic) => [{ kind: 'pic', pic }, { kind: 'pic', pic }] as [Face, Face]), rnd);
}

/**
 * Hard: related pairs — flag ↔ country name, clock face ↔ digital time, a × b ↔ product.
 * `flags` = available flag codes, `lookalike` groups never appear together in one game.
 */
export function mixedDeck(pairs: number, flags: string[], lookalike: string[][], rnd: Rand = Math.random): Card[] {
  // split the pairs between the three kinds as evenly as possible, extra ones go to random kinds
  const kinds = shuffleWith(['flag', 'clock', 'mul'] as const, rnd);
  const count: Record<string, number> = { flag: 0, clock: 0, mul: 0 };
  for (let i = 0; i < pairs; i++) count[kinds[i % 3]]++;

  const out: [Face, Face][] = [];

  // flags: no two from the same look-alike group
  const used: string[] = [];
  for (const code of shuffleWith(flags, rnd)) {
    if (used.length >= count.flag) break;
    const clash = lookalike.some((g) => g.indexOf(code) >= 0 && used.some((u) => g.indexOf(u) >= 0));
    if (!clash) used.push(code);
  }
  for (const code of used) out.push([{ kind: 'flag', code }, { kind: 'name', code }]);

  // clocks: whole, half or quarter hours, every clock a different hour
  const hours = shuffleWith(Array.from({ length: 12 }, (_, i) => i + 1), rnd).slice(0, count.clock);
  for (const hr of hours) {
    // never let the hands cover each other (e.g. 8:45, 3:15, 12:00): the clock must be easy to read
    const ok = [0, 15, 30, 45].filter((mm) => {
      const d = Math.abs(((hr % 12) * 30 + mm * 0.5 - mm * 6 + 720) % 360);
      return Math.min(d, 360 - d) >= 35;
    });
    const m = ok[Math.floor(rnd() * ok.length)];
    out.push([{ kind: 'clock', h: hr, m }, { kind: 'time', h: hr, m }]);
  }

  // multiplication: times tables 2–5 and 10, every product different
  const products: number[] = [];
  let guard = 0;
  while (products.length < count.mul && guard++ < 500) {
    const a = [2, 3, 4, 5, 10][Math.floor(rnd() * 5)];
    const b = 2 + Math.floor(rnd() * 8); // 2..9
    const n = a * b;
    if (products.indexOf(n) >= 0) continue;
    products.push(n);
    const [x, y] = rnd() < 0.5 ? [a, b] : [b, a];
    out.push([{ kind: 'mul', a: x, b: y }, { kind: 'num', n }]);
  }
  return deal(out, rnd);
}

export const timeText = (h: number, m: number): string => `${h}:${m < 10 ? '0' : ''}${m}`;

export interface Layout { cols: number; rows: number; w: number; h: number }

/**
 * Best grid for `n` cards in a `W × H` box: tries every column count that fills complete rows
 * and picks the one with the biggest cards. Cards may be up to `stretch` times longer than wide.
 */
export function fitGrid(n: number, W: number, H: number, gap: number, stretch = 1.4): Layout {
  let best: Layout = { cols: n, rows: 1, w: 0, h: 0 };
  let bestScore = -1;
  for (let cols = 2; cols <= n; cols++) {
    if (n % cols !== 0) continue;
    const rows = n / cols;
    const cw = (W - gap * (cols - 1)) / cols;
    const ch = (H - gap * (rows - 1)) / rows;
    if (cw <= 0 || ch <= 0) continue;
    const w = Math.min(cw, ch * stretch);
    const h = Math.min(ch, cw * stretch);
    const score = Math.min(w, h);
    if (score > bestScore + 0.5) { bestScore = score; best = { cols, rows, w: Math.floor(w), h: Math.floor(h) }; }
  }
  return best;
}
