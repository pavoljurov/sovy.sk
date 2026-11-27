/**
 * Turtle Painter – pure logic (no DOM). Program model, interpreter, puzzle data.
 * Kept free of imports so it can also be checked from Node (see the dev check in index.ts).
 */

/** 0 = up, 1 = right, 2 = down, 3 = left (y grows downwards, like the screen) */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export type Block =
  | { k: 'F'; n: number }
  | { k: 'L' }
  | { k: 'R' }
  | { k: 'P'; n: number; body: Block[] };

export const FWD_MAX = 5;
export const REP_MIN = 2;
export const REP_MAX = 9;

export interface Pose { x: number; y: number; dir: Dir }

/** One animation step: a unit move (draws a segment), a turn, or a repeat starting a new round. */
export type Step =
  | { t: 'move'; block: Block; from: Pose; to: Pose }
  | { t: 'turn'; block: Block; to: Pose; delta: 1 | -1 }
  | { t: 'iter'; block: Block; i: number };

/** Blocks used by a program (a repeat counts 1, plus everything inside it). */
export function countBlocks(prog: Block[]): number {
  let c = 0;
  for (const b of prog) c += b.k === 'P' ? 1 + countBlocks(b.body) : 1;
  return c;
}

/** Runs a program and lists every step. Stops after `limit` steps (endless-looking programs). */
export function trace(prog: Block[], start: Pose, limit = 600): Step[] {
  const steps: Step[] = [];
  let pose: Pose = { ...start };
  const run = (list: Block[]): boolean => {
    for (const b of list) {
      if (steps.length >= limit) return false;
      if (b.k === 'F') {
        for (let i = 0; i < b.n; i++) {
          const to: Pose = { x: pose.x + DX[pose.dir], y: pose.y + DY[pose.dir], dir: pose.dir };
          steps.push({ t: 'move', block: b, from: pose, to });
          pose = to;
        }
      } else if (b.k === 'L' || b.k === 'R') {
        const delta = b.k === 'R' ? 1 : -1;
        pose = { ...pose, dir: ((pose.dir + delta + 4) % 4) as Dir };
        steps.push({ t: 'turn', block: b, to: pose, delta });
      } else {
        for (let i = 0; i < b.n; i++) {
          steps.push({ t: 'iter', block: b, i });
          if (!run(b.body)) return false;
        }
      }
    }
    return true;
  };
  run(prog);
  return steps;
}

/** Order-independent key of the unit segment between two grid points. */
export function segKey(ax: number, ay: number, bx: number, by: number): string {
  return ax < bx || (ax === bx && ay < by) ? `${ax},${ay},${bx},${by}` : `${bx},${by},${ax},${ay}`;
}

export function segments(steps: Step[]): Set<string> {
  const s = new Set<string>();
  for (const st of steps) if (st.t === 'move') s.add(segKey(st.from.x, st.from.y, st.to.x, st.to.y));
  return s;
}

/* ---------- tiny program notation for the puzzle list: "4[F2 R]", "F3 L F1" ---------- */

export function parse(src: string): Block[] {
  const tokens = src.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/);
  let i = 0;
  const list = (): Block[] => {
    const out: Block[] = [];
    while (i < tokens.length && tokens[i] !== ']') {
      const t = tokens[i++];
      if (t === 'L' || t === 'R') out.push({ k: t });
      else if (t[0] === 'F') out.push({ k: 'F', n: Number(t.slice(1)) || 1 });
      else if (/^\d+$/.test(t) && tokens[i] === '[') {
        i++;
        const body = list();
        i++; // ']'
        out.push({ k: 'P', n: Number(t), body });
      } else throw new Error(`bad token ${t}`);
    }
    return out;
  };
  return list();
}

export function mirror(prog: Block[]): Block[] {
  return prog.map((b): Block => (b.k === 'L' ? { k: 'R' } : b.k === 'R' ? { k: 'L' } : b.k === 'P' ? { ...b, body: mirror(b.body) } : { ...b }));
}

/* ---------- puzzles ---------- */

export type LevelKey = 'easy' | 'medium' | 'hard';
export type ShapeId =
  | 'ell' | 'you' | 'sq2' | 'rect' | 'stairs3' | 'snake' | 'hook' | 'tee'
  | 'sq3' | 'stairs4' | 'rect2' | 'wave' | 'plus' | 'comb' | 'sq4'
  | 'row3' | 'window' | 'ladder' | 'diag' | 'mill' | 'flower' | 'pyramid';

export interface PuzzleDef {
  id: ShapeId;
  /** Reference solution, written from heading up. The target picture is what it draws. */
  ref: string;
  /** Block budget (medium/hard). Easy uses the level limit. */
  budget?: number;
}

export const PUZZLES: Record<LevelKey, PuzzleDef[]> = {
  easy: [
    { id: 'ell', ref: 'F3 R F2' },
    { id: 'you', ref: 'F3 R F2 R F3' },
    { id: 'hook', ref: 'F3 L F2 L F1' },
    { id: 'sq2', ref: 'F2 R F2 R F2 R F2' },
    { id: 'rect', ref: 'F2 R F3 R F2 R F3' },
    { id: 'tee', ref: 'F3 L F1 R R F2' },
    { id: 'snake', ref: 'F2 R F2 R F2 L F2 L F2' },
    { id: 'stairs3', ref: 'F1 R F1 L F1 R F1 L F1 R F1' },
  ],
  medium: [
    { id: 'sq3', ref: '4[F3 R]', budget: 4 },
    { id: 'sq4', ref: '4[F4 R]', budget: 4 },
    { id: 'rect2', ref: '2[F2 R F4 R]', budget: 5 },
    { id: 'stairs4', ref: '4[F1 R F1 L]', budget: 5 },
    { id: 'plus', ref: '4[F1 R F1 L F1 R]', budget: 7 },
    { id: 'wave', ref: '3[F2 R F1 R F2 L F1 L]', budget: 9 },
    { id: 'comb', ref: '4[F2 R R F2 L F1 L]', budget: 8 },
  ],
  hard: [
    { id: 'window', ref: '4[4[F2 R] R]', budget: 5 },
    { id: 'ladder', ref: '3[4[F1 R] F1]', budget: 5 },
    { id: 'row3', ref: '3[4[F2 R] R F2 L]', budget: 7 },
    { id: 'flower', ref: '4[F1 4[F1 R] L]', budget: 6 },
    { id: 'pyramid', ref: '2[3[F1 R F1 L] R]', budget: 7 },
    { id: 'mill', ref: '4[F1 4[F1 L] F1 R]', budget: 7 },
    { id: 'diag', ref: '3[4[F1 R] F1 R F1 L]', budget: 8 },
  ],
};

export interface Placed {
  def: PuzzleDef;
  ref: Block[];
  start: Pose;
  target: Set<string>;
  budget: number;
}

/**
 * Places a puzzle on a grid of `pts`×`pts` dots: optional mirror, start heading, and a random
 * position where the whole picture fits. Returns null when it cannot fit.
 */
export function place(def: PuzzleDef, pts: number, dir: Dir, flip: boolean, budget: number, rnd: () => number): Placed | null {
  const ref = flip ? mirror(parse(def.ref)) : parse(def.ref);
  const steps = trace(ref, { x: 0, y: 0, dir });
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const s of steps) {
    if (s.t !== 'move') continue;
    minX = Math.min(minX, s.to.x); maxX = Math.max(maxX, s.to.x);
    minY = Math.min(minY, s.to.y); maxY = Math.max(maxY, s.to.y);
  }
  const freeX = pts - 1 - (maxX - minX);
  const freeY = pts - 1 - (maxY - minY);
  if (freeX < 0 || freeY < 0) return null;
  // Prefer a roughly centred position, with a little random wobble.
  const ox = Math.round(freeX / 2 + (rnd() - 0.5) * Math.min(2, freeX));
  const oy = Math.round(freeY / 2 + (rnd() - 0.5) * Math.min(2, freeY));
  const start: Pose = { x: ox - minX, y: oy - minY, dir };
  const target = segments(trace(ref, start));
  return { def, ref, start, target, budget: def.budget ?? budget };
}

/** Number of blocks the reference solution would need without any repeat (consecutive moves merged). */
export function flatCount(prog: Block[]): number {
  const flat: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.k === 'P') for (let i = 0; i < b.n; i++) walk(b.body);
      else flat.push(b);
    }
  };
  walk(prog);
  let c = 0;
  let prev = '';
  for (const b of flat) {
    if (b.k === 'F' && prev === 'F') continue;
    c++;
    prev = b.k;
  }
  return c;
}

/** Dots per side of the paper, and the block limit for levels without a per-puzzle budget. */
export const GRID: Record<LevelKey, number> = { easy: 6, medium: 7, hard: 9 };
export const LIMIT: Record<LevelKey, number> = { easy: 14, medium: 12, hard: 12 };

const validBlocks = (p: Block[]): boolean =>
  p.every((b) => (b.k === 'F' ? b.n >= 1 && b.n <= FWD_MAX : b.k === 'P' ? b.n >= REP_MIN && b.n <= REP_MAX && validBlocks(b.body) : true));

/**
 * Checks every built-in puzzle: the reference solution uses only real blocks, fits its block
 * budget, and the picture fits the paper for every start heading, mirrored or not; in every
 * placement the solution stays on the paper and draws exactly the target. Returns problems.
 */
export function verifyPuzzles(): string[] {
  const problems: string[] = [];
  for (const lvl of Object.keys(PUZZLES) as LevelKey[]) {
    for (const d of PUZZLES[lvl]) {
      const ref = parse(d.ref);
      const budget = d.budget ?? LIMIT[lvl];
      if (!validBlocks(ref)) problems.push(`${lvl}/${d.id}: invalid block values`);
      if (countBlocks(ref) > budget) problems.push(`${lvl}/${d.id}: ${countBlocks(ref)} blocks > budget ${budget}`);
      for (let dir = 0; dir < 4; dir++) {
        for (const flip of [false, true]) {
          for (const r of [0, 0.5, 0.999]) {
            const p = place(d, GRID[lvl], dir as Dir, flip, budget, () => r);
            if (!p) { problems.push(`${lvl}/${d.id}: does not fit (dir ${dir}, flip ${flip})`); continue; }
            const steps = trace(p.ref, p.start);
            const n = GRID[lvl];
            if (!steps.every((s) => s.t !== 'move' || (s.to.x >= 0 && s.to.y >= 0 && s.to.x < n && s.to.y < n)))
              problems.push(`${lvl}/${d.id}: leaves the paper (dir ${dir}, flip ${flip})`);
            const drawn = segments(steps);
            if (drawn.size !== p.target.size || [...drawn].some((k) => !p.target.has(k)))
              problems.push(`${lvl}/${d.id}: solution does not draw the target`);
          }
        }
      }
    }
  }
  return problems;
}
