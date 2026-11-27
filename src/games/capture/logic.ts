/**
 * Pure Capture Chain logic (no DOM): capture rules, a memoised forward solver and a
 * backwards puzzle generator.
 *
 * Board = array of n*n cells, index = y * n + x (y = 0 is the top row). A cell holds a piece
 * letter or '' when empty. Every move is a capture; pawns capture one square diagonally upward.
 */

export type Piece = 'R' | 'B' | 'N' | 'Q' | 'K' | 'P';
export type Cells = (Piece | '')[];
export interface Move { from: number; to: number }

const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN = ROOK.concat(BISHOP);
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const PAWN = [[-1, -1], [1, -1]];

const slides = (t: Piece) => t === 'R' || t === 'B' || t === 'Q';
const dirs = (t: Piece): number[][] =>
  t === 'R' ? ROOK : t === 'B' ? BISHOP : t === 'Q' || t === 'K' ? QUEEN : t === 'N' ? KNIGHT : PAWN;

/** Pieces the piece on `from` can capture right now. */
export function targets(n: number, cells: Cells, from: number): number[] {
  const t = cells[from];
  if (!t) return [];
  const out: number[] = [];
  const fx = from % n, fy = (from - fx) / n;
  for (const [dx, dy] of dirs(t)) {
    let x = fx + dx, y = fy + dy;
    while (x >= 0 && y >= 0 && x < n && y < n) {
      const i = y * n + x;
      if (cells[i]) { out.push(i); break; }
      if (!slides(t)) break;
      x += dx; y += dy;
    }
  }
  return out;
}

/**
 * Why a capture from → to is or is not possible:
 * 'ok', 'blocked' (right direction, but another piece is in the way) or 'shape' (wrong move).
 */
export function explain(n: number, cells: Cells, from: number, to: number): 'ok' | 'blocked' | 'shape' {
  if (targets(n, cells, from).indexOf(to) >= 0) return 'ok';
  const t = cells[from];
  if (!t || !slides(t)) return 'shape';
  const empty: Cells = cells.map(() => '');
  empty[from] = t;
  empty[to] = cells[to];
  return targets(n, empty, from).indexOf(to) >= 0 ? 'blocked' : 'shape';
}

export function allMoves(n: number, cells: Cells): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i]) for (const to of targets(n, cells, i)) out.push({ from: i, to });
  return out;
}

export function apply(cells: Cells, m: Move): Cells {
  const next = cells.slice();
  next[m.to] = next[m.from];
  next[m.from] = '';
  return next;
}

export const count = (cells: Cells) => cells.reduce((s, c) => s + (c ? 1 : 0), 0);
const keyOf = (cells: Cells) => cells.map((c) => c || '.').join('');

/**
 * Forward solver for one puzzle. `chance(cells)` = probability that playing uniformly random
 * captures from this position wins (0 = dead end, 1 = every way wins). Memoised per position.
 */
export class Solver {
  private memo = new Map<string, number>();
  private n: number;
  constructor(n: number) { this.n = n; }

  chance(cells: Cells): number {
    if (count(cells) <= 1) return 1;
    const k = keyOf(cells);
    const known = this.memo.get(k);
    if (known !== undefined) return known;
    const moves = allMoves(this.n, cells);
    let sum = 0;
    for (const m of moves) sum += this.chance(apply(cells, m));
    const p = moves.length ? sum / moves.length : 0;
    this.memo.set(k, p);
    return p;
  }

  /** Moves that still lead to a win (empty = dead end). */
  winning(cells: Cells): Move[] {
    return allMoves(this.n, cells).filter((m) => this.chance(apply(cells, m)) > 0);
  }

  get positions() { return this.memo.size; }
}

/* ---------- generator ---------- */

export interface GenCfg {
  size: number;
  pieces: number;
  /** allowed piece types (repeat a letter to make it more likely) */
  types: Piece[];
  /** max count per type (missing = unlimited) */
  caps: Partial<Record<Piece, number>>;
  /** the puzzle must contain at least one of these (e.g. the level's new pieces) */
  need: Piece[];
  /** wanted range for the random-play win chance; lower = more dead ends */
  chance: [number, number];
}

export interface Puzzle { size: number; cells: Cells; chance: number }

const rnd = (k: number) => Math.floor(Math.random() * k);

/** Empty squares from which a `t` on that square could capture the piece on `x`. */
function backSquares(n: number, cells: Cells, x: number, t: Piece): number[] {
  const out: number[] = [];
  const px = x % n, py = (x - px) / n;
  for (const [dx, dy] of dirs(t)) {
    // walk from the target back towards where the attacker stood (opposite of the move direction)
    let cx = px - dx, cy = py - dy;
    while (cx >= 0 && cy >= 0 && cx < n && cy < n) {
      const i = cy * n + cx;
      if (cells[i]) break; // the path (and the start square) must be empty
      out.push(i);
      if (!slides(t)) break;
      cx -= dx; cy -= dy;
    }
  }
  return out;
}

/** Build one solvable position by undoing captures from a single final piece. */
function backwards(cfg: GenCfg): Cells | null {
  const n = cfg.size;
  const cells: Cells = Array.from({ length: n * n }, () => '' as const);
  const used: Partial<Record<Piece, number>> = {};
  const canUse = (t: Piece) => (used[t] || 0) < (cfg.caps[t] ?? 99);
  const pickType = (): Piece | null => {
    const ok = cfg.types.filter(canUse);
    return ok.length ? ok[rnd(ok.length)] : null;
  };
  const first = pickType();
  if (!first) return null;
  cells[rnd(n * n)] = first;
  used[first] = 1;
  for (let placed = 1; placed < cfg.pieces; placed++) {
    // all (piece, back square) options
    const opts: [number, number][] = [];
    cells.forEach((t, x) => { if (t) for (const y of backSquares(n, cells, x, t)) opts.push([x, y]); });
    const newType = pickType();
    if (!opts.length || !newType) return null;
    const [x, y] = opts[rnd(opts.length)];
    cells[y] = cells[x];
    cells[x] = newType;
    used[newType] = (used[newType] || 0) + 1;
  }
  if (cfg.need.length && !cells.some((c) => c && cfg.need.indexOf(c) >= 0)) return null;
  return cells;
}

/**
 * Random puzzle for `cfg`: tries backwards-built positions (all solvable by construction,
 * double-checked by the solver) and keeps the one whose random-win chance fits `cfg.chance`
 * best. Stops early on a perfect fit or after a time budget.
 */
export function makePuzzle(cfg: GenCfg, budgetMs = 40): Puzzle {
  const t0 = Date.now();
  const [lo, hi] = cfg.chance;
  let best: Puzzle | null = null;
  let bestDist = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const cells = backwards(cfg);
    if (cells) {
      const p = new Solver(cfg.size).chance(cells);
      if (p > 0) {
        const dist = p < lo ? lo - p : p > hi ? p - hi : 0;
        if (dist < bestDist) { best = { size: cfg.size, cells, chance: p }; bestDist = dist; }
        if (dist === 0) break;
      }
    }
    if (best && Date.now() - t0 > budgetMs) break;
  }
  if (best) return best;
  // Fallback (practically never): rook takes knight.
  const cells: Cells = Array.from({ length: cfg.size * cfg.size }, () => '' as const);
  cells[0] = 'R'; cells[1] = 'N';
  return { size: cfg.size, cells, chance: 1 };
}
