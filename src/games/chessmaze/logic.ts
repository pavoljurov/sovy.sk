/** Pure chess-maze logic (no DOM): moves, attacks, BFS and the puzzle generator. */

export type Piece = 'R' | 'B' | 'N';
export interface Pt { x: number; y: number }
export interface Enemy extends Pt { type: Piece }
export interface Puzzle { size: number; start: Pt; goal: Pt; enemies: Enemy[]; minMoves: number }

export interface GenCfg {
  size: number;
  player: Piece;
  enemyTypes: Piece[];
  enemies: number;
  minMoves: number;
  maxMoves: number;
}

export const key = (p: Pt) => p.y * 100 + p.x;
const inside = (n: number, x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/**
 * Squares a piece on `from` can reach (or attacks). Sliding pieces stop before any square in
 * `blockers`. The knight jumps, but never onto a blocker.
 */
export function reach(n: number, type: Piece, from: Pt, blockers: Set<number>): Pt[] {
  const out: Pt[] = [];
  if (type === 'N') {
    for (const [dx, dy] of KNIGHT_JUMPS) {
      const x = from.x + dx, y = from.y + dy;
      if (inside(n, x, y) && !blockers.has(key({ x, y }))) out.push({ x, y });
    }
    return out;
  }
  for (const [dx, dy] of type === 'R' ? ROOK_DIRS : BISHOP_DIRS) {
    let x = from.x + dx, y = from.y + dy;
    while (inside(n, x, y) && !blockers.has(key({ x, y }))) {
      out.push({ x, y });
      x += dx; y += dy;
    }
  }
  return out;
}

/** Map: attacked square key → the enemy that attacks it (first one found). */
export function attackMap(n: number, enemies: Enemy[]): Map<number, Enemy> {
  const blockers = new Set(enemies.map(key));
  const map = new Map<number, Enemy>();
  for (const e of enemies) for (const p of reach(n, e.type, e, blockers)) if (!map.has(key(p))) map.set(key(p), e);
  return map;
}

/** Shortest number of moves from start to goal (Infinity if unreachable). */
export function shortest(n: number, player: Piece, start: Pt, goal: Pt, enemies: Enemy[], avoid: Set<number>): number {
  const blockers = new Set(enemies.map(key));
  const dist = new Map([[key(start), 0]]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift()!;
    const d = dist.get(key(p))!;
    if (key(p) === key(goal)) return d;
    for (const q of reach(n, player, p, blockers)) {
      if (avoid.has(key(q)) || dist.has(key(q))) continue;
      dist.set(key(q), d + 1);
      queue.push(q);
    }
  }
  return Infinity;
}

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function makePuzzle(cfg: GenCfg): Puzzle {
  const n = cfg.size;
  for (let attempt = 0; attempt < 4000; attempt++) {
    // Late attempts relax the "danger must matter" rule so we always find something.
    const strict = attempt < 3000;
    const used = new Set<number>();
    const enemies: Enemy[] = [];
    // Make sure each allowed enemy type shows up at least once when there is room.
    const types = Array.from({ length: cfg.enemies }, (_, i) => cfg.enemyTypes[i] ?? pick(cfg.enemyTypes));
    for (const type of types) {
      const x = randInt(0, n - 1), y = randInt(0, n - 1);
      if (used.has(key({ x, y }))) continue;
      used.add(key({ x, y }));
      enemies.push({ x, y, type });
    }
    if (enemies.length < cfg.enemies) continue;
    const attacked = attackMap(n, enemies);
    const safe: Pt[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = key({ x, y });
      if (!used.has(k) && !attacked.has(k)) safe.push({ x, y });
    }
    // Not too crowded with danger, not too empty either.
    if (safe.length < n * n * 0.3 || safe.length > n * n * 0.65) continue;
    const start = pick(safe);
    const goal = pick(safe);
    if (key(start) === key(goal)) continue;
    if (Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y) < n / 2) continue;
    const d = shortest(n, cfg.player, start, goal, enemies, new Set(attacked.keys()));
    if (d < cfg.minMoves || d > cfg.maxMoves) continue;
    if (strict) {
      // The danger squares must actually change the route.
      const free = shortest(n, cfg.player, start, goal, enemies, new Set());
      if (free >= d) continue;
    }
    return { size: n, start, goal, enemies, minMoves: d };
  }
  // Fallback (should never happen): an empty-ish board.
  return {
    size: n, start: { x: 0, y: n - 1 }, goal: { x: n - 1, y: 0 },
    enemies: [{ x: Math.floor(n / 2), y: Math.floor(n / 2), type: 'N' }], minMoves: 2,
  };
}
