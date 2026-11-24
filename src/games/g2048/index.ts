import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { pick, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import './g2048.css';

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="9" fill="#E9E2F7" stroke="#2B2440" stroke-width="4"/><rect x="11" y="11" width="19" height="19" rx="4" fill="#FFD23F" stroke="#2B2440" stroke-width="2.5"/><rect x="34" y="11" width="19" height="19" rx="4" fill="#FF8A3D" stroke="#2B2440" stroke-width="2.5"/><rect x="11" y="34" width="19" height="19" rx="4" fill="#7B5CFF" stroke="#2B2440" stroke-width="2.5"/><rect x="34" y="34" width="19" height="19" rx="4" fill="#fff" stroke="#2B2440" stroke-width="2.5"/><text x="20.5" y="25.5" font-size="12" font-weight="800" text-anchor="middle" fill="#2B2440" font-family="sans-serif">2</text><text x="43.5" y="25.5" font-size="12" font-weight="800" text-anchor="middle" fill="#2B2440" font-family="sans-serif">0</text><text x="20.5" y="48.5" font-size="12" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">4</text><text x="43.5" y="48.5" font-size="12" font-weight="800" text-anchor="middle" fill="#2B2440" font-family="sans-serif">8</text></svg>`;

const arrow = (rot: number) =>
  `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const UNDO_ICON = `<svg viewBox="0 0 24 24"><path d="M9 4L3 10l6 6v-4h6a3 3 0 0 1 0 6h-3v3h3a6 6 0 0 0 0-12H9z" fill="currentColor" stroke="#2B2440" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

/* ---------- difficulty ---------- */

interface Cfg {
  n: number;
  /** reaching this tile wins */
  target: number;
  /** chance that a new tile is a 4 instead of a 2 */
  four: number;
  undos: number;
  /** star thresholds (undos used) */
  three: number;
  two: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { n: 4, target: 128, four: 0, undos: 5, three: 1, two: 3 },
  medium: { n: 4, target: 512, four: 0.1, undos: 5, three: 1, two: 3 },
  hard: { n: 4, target: 2048, four: 0.1, undos: 5, three: 2, two: 4 },
};

/* ---------- texts ---------- */

const en = {
  intro: (t: number) => `Swipe or tap the arrows. Two same numbers join into one. Make ${t}!`,
  score: 'Score',
  goal: 'Goal',
  undo: (n: number) => `Undo (${n})`,
  end: 'Finish',
  noMove: 'Nothing can move that way. Try another arrow!',
  corner: 'Tip: keep your biggest tile in a corner!',
  newTile: (v: number) => `Wow, a ${v}!`,
  undone: 'One step back. Try another way!',
  stuck: 'No moves left! Tap Undo to go back a step.',
  stuckEnd: 'No moves left!',
  won: (t: number) => `You made ${t}! Hooray!`,
  best: (v: number) => `Your biggest tile: ${v}`,
};
const sk: typeof en = {
  intro: (t) => `Potiahni prstom alebo ťukni na šípky. Dve rovnaké čísla sa spoja do jedného. Vyrob ${t}!`,
  score: 'Body',
  goal: 'Cieľ',
  undo: (n) => `Späť (${n})`,
  end: 'Koniec',
  noMove: 'Tým smerom sa nič nepohne. Skús inú šípku!',
  corner: 'Tip: najväčšie číslo drž v rohu!',
  newTile: (v) => `Wow, ${v}!`,
  undone: 'Krok späť. Skús to inak!',
  stuck: 'Už sa nedá pohnúť! Ťukni na Späť a vráť sa o krok.',
  stuckEnd: 'Už sa nedá pohnúť!',
  won: (t) => `Hurá, máš ${t}!`,
  best: (v) => `Najväčšie číslo: ${v}`,
};

/* ---------- game ---------- */

type Dir = 'up' | 'down' | 'left' | 'right';
const VEC: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};
const SLIDE_MS = 120;

interface Tile { v: number; r: number; c: number; el: HTMLElement; face: HTMLElement }
interface Snapshot { vals: number[]; score: number }

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const n = cfg.n;
  const steps = Math.log2(cfg.target) - 1; // progress dots: 4, 8, … target

  let alive = true;
  let done = false;
  let busy = false;
  let queued: Dir | null = null;
  let tiles: Tile[] = [];
  let score = 0;
  let maxTile = 2;
  let undosLeft = cfg.undos;
  let undosUsed = 0;
  let tipShown = false;
  const history: Snapshot[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (alive) fn();
    }, ms);
    timers.add(t);
  };

  /* --- DOM --- */
  const board = h(
    'div',
    { class: 'g2-board', style: { '--n': String(n) } },
    Array.from({ length: n * n }, () => h('div', { class: 'g2-cell' })),
  );
  const scoreEl = h('b', null, '0');
  const goalTile = h('div', { class: `g2-face g2-mini ${tileClass(cfg.target)}` }, String(cfg.target));
  const info = h(
    'div',
    { class: 'g2-info' },
    h('div', { class: 'g2-box' }, h('span', null, S.score), scoreEl),
    h('div', { class: 'g2-box' }, h('span', null, S.goal), goalTile),
  );
  const dirBtn = (d: Dir, rot: number) =>
    h('button', { class: `btn btn-alt g2-arrow g2-${d}`, html: arrow(rot), 'aria-label': d, onClick: () => tryMove(d) });
  const pad = h('div', { class: 'g2-pad' }, dirBtn('up', 0), dirBtn('left', 270), dirBtn('right', 90), dirBtn('down', 180));
  const undoBtn: HTMLButtonElement = h('button', { class: 'btn btn-warn g2-undo', onClick: () => undo() });
  const endBtn: HTMLButtonElement = h('button', { class: 'btn g2-end', onClick: () => lose() }, S.end);
  endBtn.hidden = true;
  const actions = h('div', { class: 'g2-actions' }, undoBtn, endBtn);
  const side = h('div', { class: 'g2-side' }, info, pad, actions);
  const wrap = h('div', { class: 'g2' }, board, side);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    const room = 40;
    const size = vertical ? Math.min(w - room, hgt * 0.62) : Math.min(hgt - room, w * 0.6);
    const px = Math.max(140, Math.floor(size));
    // board = 2 borders + n cells + (n + 1) gaps, gap = 12% of a cell; the grid sizes itself
    const border = parseFloat(getComputedStyle(board).borderLeftWidth) || 0;
    const cell = (px - 2 * border) / (n + (n + 1) * 0.12);
    board.style.setProperty('--cs', `${cell}px`);
    board.style.setProperty('--gap', `${cell * 0.12}px`);
  });

  /* --- tiles --- */
  function tileClass(v: number) {
    return `v${Math.min(v, 4096)}` + (v >= 1000 ? ' d4' : v >= 100 ? ' d3' : '');
  }
  function paint(t: Tile) {
    t.el.style.setProperty('--r', String(t.r));
    t.el.style.setProperty('--c', String(t.c));
    t.face.className = `g2-face ${tileClass(t.v)}`;
    t.face.textContent = String(t.v);
  }
  function addTile(v: number, r: number, c: number, anim: 'new' | 'none' = 'new'): Tile {
    const face = h('div', { class: 'g2-face' });
    const el = h('div', { class: 'g2-tile' }, face);
    const t: Tile = { v, r, c, el, face };
    paint(t);
    if (anim === 'new') face.classList.add('appear');
    board.append(el);
    tiles.push(t);
    return t;
  }
  function at(r: number, c: number) {
    return tiles.find((t) => t.r === r && t.c === c);
  }
  function spawn() {
    const free: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!at(r, c)) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = pick(free);
    addTile(Math.random() < cfg.four ? 4 : 2, r, c);
  }
  function canMove() {
    if (tiles.length < n * n) return true;
    return tiles.some((t) => {
      const right = at(t.r, t.c + 1), down = at(t.r + 1, t.c);
      return (right && right.v === t.v) || (down && down.v === t.v);
    });
  }

  /* --- moving --- */
  /** Computes the move; returns null if nothing would change. */
  function plan(dir: Dir) {
    const [dr, dc] = VEC[dir];
    const toEnd = dr === 1 || dc === 1;
    const moves: { t: Tile; r: number; c: number }[] = [];
    const merges: { keep: Tile; gone: Tile }[] = [];
    for (let line = 0; line < n; line++) {
      // cells of this line, starting at the edge the tiles slide towards
      const cells = Array.from({ length: n }, (_, k) => {
        const p = toEnd ? n - 1 - k : k;
        return dr !== 0 ? [p, line] : [line, p];
      });
      const row = cells.map(([r, c]) => at(r, c)).filter((t): t is Tile => !!t);
      let slot = 0;
      let last: Tile | null = null;
      for (const t of row) {
        if (last && last.v === t.v) {
          const dest = moves.find((m) => m.t === last)!;
          moves.push({ t, r: dest.r, c: dest.c });
          merges.push({ keep: last, gone: t });
          last = null; // a tile merges only once per move
        } else {
          const [r, c] = cells[slot++];
          moves.push({ t, r, c });
          last = t;
        }
      }
    }
    const changed = merges.length > 0 || moves.some((m) => m.t.r !== m.r || m.t.c !== m.c);
    return changed ? { moves, merges } : null;
  }

  function snapshot(): Snapshot {
    const vals = Array(n * n).fill(0);
    for (const t of tiles) vals[t.r * n + t.c] = t.v;
    return { vals, score };
  }

  function tryMove(dir: Dir) {
    if (done) return;
    if (busy) {
      queued = dir;
      return;
    }
    const p = plan(dir);
    if (!p) {
      ctx.sfx.tap();
      replay(board, `nudge-${dir}`);
      if (Math.random() < 0.5) ctx.mascot.say(S.noMove, 'think', 2500);
      return;
    }
    history.push(snapshot());
    if (history.length > 30) history.shift();
    endBtn.hidden = true;
    board.classList.remove('stuck');
    busy = true;
    for (const m of p.moves) {
      m.t.r = m.r;
      m.t.c = m.c;
      paint(m.t);
    }
    ctx.sfx.step();
    later(() => afterSlide(p.merges), SLIDE_MS);
  }

  function afterSlide(merges: { keep: Tile; gone: Tile }[]) {
    const prevMax = maxTile;
    for (const { keep, gone } of merges) {
      gone.el.remove();
      tiles = tiles.filter((t) => t !== gone);
      keep.v *= 2;
      score += keep.v;
      maxTile = Math.max(maxTile, keep.v);
      paint(keep);
      replay(keep.face, 'merge');
    }
    if (merges.length) ctx.sfx.pop();
    scoreEl.textContent = String(score);
    replay(scoreEl, 'pop');
    spawn();
    busy = false;
    updateProgress();
    updateUndo();

    if (maxTile >= cfg.target) return win();
    if (maxTile > prevMax && maxTile >= 16) {
      if (maxTile >= 64 && !tipShown) {
        tipShown = true;
        ctx.mascot.say(S.corner, 'think', 4500);
      } else {
        ctx.celebrate('small');
        ctx.mascot.say(maxTile >= 32 ? S.newTile(maxTile) : praise(), 'happy', 2000);
      }
    }
    if (!canMove()) return stuck();
    if (queued) {
      const d = queued;
      queued = null;
      tryMove(d);
    }
  }

  function updateProgress() {
    ctx.setProgress(Math.min(steps, Math.log2(maxTile) - 1), steps);
  }
  function updateUndo() {
    undoBtn.innerHTML = '';
    undoBtn.append(h('span', { html: UNDO_ICON }), S.undo(undosLeft));
    undoBtn.disabled = undosLeft === 0 || history.length === 0;
  }

  function undo() {
    if (done || busy || undosLeft === 0 || !history.length) return;
    const snap = history.pop()!;
    undosLeft--;
    undosUsed++;
    queued = null;
    for (const t of tiles) t.el.remove();
    tiles = [];
    snap.vals.forEach((v, i) => v && addTile(v, Math.floor(i / n), i % n, 'none'));
    score = snap.score;
    scoreEl.textContent = String(score);
    maxTile = Math.max(2, ...snap.vals);
    updateProgress();
    endBtn.hidden = true;
    board.classList.remove('stuck');
    board.classList.remove('rewind');
    replay(board, 'rewind');
    ctx.sfx.tap();
    ctx.mascot.say(S.undone, 'wave', 2200);
    updateUndo();
  }

  function stuck() {
    ctx.sfx.wrong();
    replay(board, 'shake');
    board.classList.add('stuck');
    updateUndo();
    if (undosLeft > 0) {
      ctx.mascot.say(S.stuck, 'sad', 5000);
      endBtn.hidden = false;
      replay(undoBtn, 'pop');
    } else {
      ctx.mascot.say(S.stuckEnd, 'sad', 3000);
      later(lose, 1400);
    }
  }

  function lose() {
    if (done) return;
    done = true;
    ctx.finish({ stars: 0, message: S.best(maxTile) });
  }

  function win() {
    done = true;
    updateUndo();
    ctx.mascot.say(S.won(cfg.target), 'cheer', 3000);
    tiles.filter((t) => t.v >= cfg.target).forEach((t) => replay(t.face, 'champion'));
    ctx.finish({ stars: starsFromMistakes(undosUsed, cfg.three, cfg.two) });
  }

  /* --- input: swipe, keyboard, buttons --- */
  let start: { x: number; y: number; id: number } | null = null;
  board.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    board.setPointerCapture(e.pointerId);
  });
  const endSwipe = (e: PointerEvent) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    const min = Math.max(24, board.clientWidth * 0.06);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
    tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  board.addEventListener('pointerup', endSwipe);
  board.addEventListener('pointercancel', () => (start = null));

  const onKey = (e: KeyboardEvent) => {
    const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!board.isConnected || document.querySelector('.overlay')) return;
    e.preventDefault();
    tryMove(d);
  };
  window.addEventListener('keydown', onKey);

  /* --- start --- */
  spawn();
  spawn();
  updateUndo();
  updateProgress();
  ctx.mascot.say(S.intro(cfg.target), 'wave', 6000);

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey);
    stopResize();
  };
}

const game: GameModule = {
  id: 'g2048',
  order: 7,
  title: { en: '2048', sk: '2048' },
  tagline: { en: 'Slide and join the numbers', sk: 'Posúvaj a spájaj čísla' },
  color: '#FFB627',
  icon: ICON,
  howTo: [
    { en: 'Swipe on the board or tap an arrow: all tiles slide that way.', sk: 'Potiahni prstom po ploche alebo ťukni na šípku: všetky kocky sa posunú tým smerom.' },
    { en: 'Two tiles with the same number join into one: 2 + 2 = 4, 4 + 4 = 8…', sk: 'Dve kocky s rovnakým číslom sa spoja do jednej: 2 + 2 = 4, 4 + 4 = 8…' },
    { en: 'After every move a new tile appears. Reach the goal number before the board fills up!', sk: 'Po každom ťahu pribudne nová kocka. Dosiahni cieľové číslo skôr, ako sa plocha zaplní!' },
    { en: 'Undo takes a move back – but using it often costs stars.', sk: 'Späť vráti ťah – ale keď ho použiješ často, prídeš o hviezdičky.' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Make 128', sk: 'Vyrob 128' } },
    { id: 'medium', description: { en: 'Make 512', sk: 'Vyrob 512' } },
    { id: 'hard', description: { en: 'Classic: make 2048!', sk: 'Klasika: vyrob 2048!' } },
  ],
  mount,
};
export default game;
