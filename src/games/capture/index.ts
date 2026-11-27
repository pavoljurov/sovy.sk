import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { allMoves, apply, count, explain, makePuzzle, Solver, targets, type Cells, type GenCfg, type Move, type Piece } from './logic';
import './capture.css';

/* ---------- pieces (inline SVG, sticker style; R/B/N as in Chess Maze) ---------- */

const INK = '#2B2440';
const pieceSvg = (type: Piece, fill: string, detail: string) => {
  const st = `fill="${fill}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
  const base = `<path d="M9 35.5h22v-5H9z" ${st}/>`;
  const body: Record<Piece, string> = {
    R: `<path d="M12.5 30.5l1.5-14h12l1.5 14z" ${st}/>
        <path d="M11 16.5V7.5h4.5v3.5h2.7V7.5h3.6v3.5h2.7V7.5H29v9z" ${st}/>
        <path d="M15.5 21h9" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>`,
    B: `<path d="M13 30.5h14l-2-5h-10z" ${st}/>
        <path d="M15 25.5c-4-4-3.5-10 5-16 8.5 6 9 12 5 16z" ${st}/>
        <circle cx="20" cy="6.5" r="2.8" fill="${fill}" stroke="${INK}" stroke-width="2.4"/>
        <path d="M23 13.5l-4.5 5.5" stroke="${detail}" stroke-width="2.2" stroke-linecap="round"/>`,
    N: `<path d="M13 30.5c0-5.5 2.5-8 6.5-11.5-3 .5-5.5 1-7 3L9 18.5c1-4 4.5-9 9.5-11l1-3.5 2.5 3.5c6 1.5 9 7 9 13v10z" ${st}/>
        <circle cx="18" cy="12.5" r="1.6" fill="${detail}"/>
        <path d="M27 15c1 3 1 7 0 11" stroke="${detail}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8"/>`,
    Q: `<path d="M12.5 30.5l2.5-12h10l2.5 12z" ${st}/>
        <path d="M11 19l-2-10 6 5 5-8 5 8 6-5-2 10z" ${st}/>
        <circle cx="9" cy="8.5" r="2.2" fill="${fill}" stroke="${INK}" stroke-width="2.2"/>
        <circle cx="20" cy="5.5" r="2.2" fill="${fill}" stroke="${INK}" stroke-width="2.2"/>
        <circle cx="31" cy="8.5" r="2.2" fill="${fill}" stroke="${INK}" stroke-width="2.2"/>
        <path d="M16 24h8" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>`,
    K: `<path d="M12.5 30.5l2.5-11h10l2.5 11z" ${st}/>
        <path d="M11.5 19.5c0-5 3.5-8 8.5-8s8.5 3 8.5 8z" ${st}/>
        <path d="M20 3.5v8M16.5 7h7" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M16 24.5h8" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>`,
    P: `<path d="M13.5 30.5c0-6 2.5-9.5 6.5-12 4 2.5 6.5 6 6.5 12z" ${st}/>
        <path d="M15 19.5h10" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="20" cy="12.5" r="5.5" ${st}/>
        <path d="M18 10.5a2.5 2.5 0 0 1 2.5-1.5" stroke="${detail}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
  };
  return `<svg viewBox="0 0 40 40">${body[type]}${base}</svg>`;
};
const PIECE_SVG = (t: Piece) => pieceSvg(t, '#FFD23F', '#FF8A3D');
const inner = (svg: string) => svg.replace(/<\/?svg[^>]*>/g, '');

const BULB = `<svg viewBox="0 0 24 24"><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.8.6 1.3 1.5 1.3 2.5v.7h5v-.7c0-1 .5-1.9 1.3-2.5A6.5 6.5 0 0 0 12 2.5z" fill="#FFD23F" stroke="#2B2440" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 20h5M10.5 22.5h3" stroke="#2B2440" stroke-width="2" stroke-linecap="round"/></svg>`;
const UNDO = `<svg viewBox="0 0 24 24"><path d="M9 5L4 10l5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 10H14a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const RESTART = `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="#FFF3DC"/>
<path d="M6 6h13v13H6zM32 6h13v13H32zM19 19h13v13H19zM45 19h13v13H45zM6 32h13v13H6zM32 32h13v13H32zM19 45h13v13H19zM45 45h13v13H45z" fill="#F2C48D"/>
<g transform="translate(31 4) scale(.62)" opacity=".55">${inner(PIECE_SVG('B'))}</g>
<path d="M22 40c4-12 12-18 20-20" fill="none" stroke="#FF4D5E" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 6"/>
<path d="M36 17l7 2.5-4 6" fill="none" stroke="#FF4D5E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(6 28) scale(.78)">${inner(PIECE_SVG('R'))}</g>
<rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#2B2440" stroke-width="4"/></svg>`;

/* ---------- difficulty ---------- */

type Shape = [size: number, pieces: number];
interface Cfg extends Omit<GenCfg, 'size' | 'pieces'> {
  /** one [board size, piece count] per puzzle */
  puzzles: Shape[];
  hints: number;
  /** stars: ≤ three mistakes → 3★, ≤ two → 2★ (undo / start over = 1 mistake each) */
  three: number;
  two: number;
}
const CFG: Record<LevelId, Cfg> = {
  easy: {
    puzzles: [[4, 3], [4, 3], [4, 4], [4, 4], [4, 4]],
    types: ['R', 'B', 'N'], caps: { R: 2, B: 2, N: 2 }, need: [], chance: [0.5, 1],
    hints: 3, three: 1, two: 3,
  },
  medium: {
    puzzles: [[4, 4], [4, 5], [5, 5], [5, 6], [5, 6]],
    types: ['R', 'B', 'N', 'Q', 'K'], caps: { R: 2, B: 2, N: 2, Q: 1, K: 1 }, need: ['Q', 'K'], chance: [0.25, 0.65],
    hints: 3, three: 2, two: 5,
  },
  hard: {
    puzzles: [[5, 6], [5, 7], [5, 8], [6, 8]],
    types: ['R', 'B', 'N', 'Q', 'K', 'P', 'P'], caps: { R: 2, B: 2, N: 2, Q: 1, K: 1, P: 3 }, need: ['P'], chance: [0.08, 0.3],
    hints: 3, three: 3, two: 7,
  },
};

/* ---------- texts ---------- */

const en = {
  name: { R: 'rook', B: 'bishop', N: 'knight', Q: 'queen', K: 'king', P: 'pawn' } as Record<Piece, string>,
  Name: { R: 'Rook', B: 'Bishop', N: 'Knight', Q: 'Queen', K: 'King', P: 'Pawn' } as Record<Piece, string>,
  how: {
    R: 'moves in straight lines: up, down, left, right.',
    B: 'moves diagonally, like an X.',
    N: 'jumps in an L: two squares, then one to the side. It can jump over pieces.',
    Q: 'moves in straight lines and diagonally, as far as it likes.',
    K: 'moves just one square, in any direction.',
    P: 'captures only one square diagonally up.',
  } as Record<Piece, string>,
  intro: 'Every move must capture! Tap a piece, then a piece it can take. Leave only one!',
  pieces: (n: number) => `Pieces: ${n}`,
  goal: 'Leave just 1',
  hint: (n: number) => `Hint (${n})`,
  undo: 'Undo',
  restart: 'Start over',
  explainPiece: (p: Piece) => `${en.Name[p]}: it ${en.how[p]}`,
  noTargets: (p: Piece) => `The ${en.name[p]} cannot capture anything now. It ${en.how[p]}`,
  cantTake: (p: Piece, q: Piece) => `The ${en.name[p]} cannot take that ${en.name[q]}. It ${en.how[p]}`,
  blocked: 'Another piece is in the way. Only the knight can jump over pieces!',
  stuck: 'No more captures, but more pieces are left. Tap Undo or Start over!',
  deadEnd: 'This way cannot win any more. Undo a move and try another way!',
  hintMove: (p: Piece, q: Piece) => `Try this: the ${en.name[p]} takes the ${en.name[q]}.`,
  noHints: 'No hints left. You can do it!',
  undone: 'One move back. Try another way!',
  restarted: 'Back to the start. Try another order!',
  done: (p: string) => `${p} Only one piece is left!`,
  last: 'Last puzzle!',
};
/** Slovak accusative ("vyhodí vežu / strelca …"). */
const ACC: Record<Piece, string> = { R: 'vežu', B: 'strelca', N: 'jazdca', Q: 'dámu', K: 'kráľa', P: 'pešiaka' };
const sk: typeof en = {
  name: { R: 'veža', B: 'strelec', N: 'jazdec', Q: 'dáma', K: 'kráľ', P: 'pešiak' },
  Name: { R: 'Veža', B: 'Strelec', N: 'Jazdec', Q: 'Dáma', K: 'Kráľ', P: 'Pešiak' },
  how: {
    R: 'chodí rovno: hore, dole, doľava, doprava.',
    B: 'chodí šikmo, ako písmeno X.',
    N: 'skáče do tvaru L: dve políčka a jedno nabok. Môže preskakovať figúrky.',
    Q: 'chodí rovno aj šikmo, ako ďaleko chce.',
    K: 'chodí len o jedno políčko, na hociktorú stranu.',
    P: 'vyhadzuje len o jedno políčko šikmo hore.',
  },
  intro: 'Každý ťah musí vyhodiť figúrku! Ťukni na figúrku a potom na tú, ktorú vyhodí. Nechaj len jednu!',
  pieces: (n) => `Figúrky: ${n}`,
  goal: 'Nechaj len 1',
  hint: (n) => `Pomoc (${n})`,
  undo: 'Späť',
  restart: 'Znova',
  explainPiece: (p) => `${sk.Name[p]} ${sk.how[p]}`,
  noTargets: (p) => `${sk.Name[p]} teraz nemôže nič vyhodiť. ${sk.Name[p]} ${sk.how[p]}`,
  cantTake: (p, q) => `${sk.Name[p]} nemôže vyhodiť ${ACC[q]}. ${sk.Name[p]} ${sk.how[p]}`,
  blocked: 'V ceste stojí iná figúrka. Preskakovať vie len jazdec!',
  stuck: 'Už sa nedá nič vyhodiť, ale figúrok je viac. Ťukni na Späť alebo Znova!',
  deadEnd: 'Touto cestou sa už vyhrať nedá. Vráť ťah a skús to inak!',
  hintMove: (p, q) => `Skús toto: ${sk.name[p]} vyhodí ${ACC[q]}.`,
  noHints: 'Pomoc sa už minula. Zvládneš to!',
  undone: 'Ťah späť. Skús to inak!',
  restarted: 'Späť na začiatok. Skús iné poradie!',
  done: (p) => `${p} Ostala len jedna figúrka!`,
  last: 'Posledná hádanka!',
};

/* ---------- game ---------- */

interface Snap { cells: Cells; ids: number[] }

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const total = cfg.puzzles.length;
  let alive = true;
  let solved = 0;
  let mistakes = 0;
  let hintsLeft = cfg.hints;
  let busy = false;
  let n = 4;
  let start: Snap = { cells: [], ids: [] };
  let cur: Snap = start;
  let history: Snap[] = [];
  let sel = -1;
  let hintTo = -1;
  let solver = new Solver(4);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
    timers.add(t);
  };

  /* ----- DOM ----- */

  let squares: HTMLButtonElement[] = [];
  let pieceEls: HTMLElement[] = [];
  let legendChips: [Piece, HTMLElement][] = [];
  const grid = h('div', { class: 'cc-grid' });
  const layer = h('div', { class: 'cc-layer' });
  const board = h('div', { class: 'cc-board' }, grid, layer);

  const countEl = h('div', { class: 'cc-count' });
  const goalEl = h('div', { class: 'cc-goal' }, S.goal);
  const legend = h('div', { class: 'cc-legend' });
  const hintBtn: HTMLButtonElement = h('button', { class: 'btn btn-warn', onClick: () => hint() });
  const undoBtn: HTMLButtonElement = h('button', { class: 'btn btn-alt', onClick: () => undo() });
  const restartBtn: HTMLButtonElement = h('button', { class: 'btn btn-alt', onClick: () => restart() });
  undoBtn.innerHTML = `${UNDO}<span>${S.undo}</span>`;
  restartBtn.innerHTML = `${RESTART}<span>${S.restart}</span>`;
  const panel = h(
    'div',
    { class: 'cc-panel' },
    h('div', { class: 'cc-status card' }, countEl, goalEl),
    legend,
    h('div', { class: 'cc-actions' }, hintBtn, undoBtn, restartBtn),
  );
  const wrap = h('div', { class: 'cc' }, board, panel);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    const size = vertical ? Math.min(w - 24, hgt * 0.64) : Math.min(hgt - 24, w * 0.6);
    board.style.width = board.style.height = `${Math.max(160, Math.floor(size))}px`;
  });

  /* ----- rendering ----- */

  const place = (el: HTMLElement, i: number) => {
    el.style.left = `${((i % n) * 100) / n}%`;
    el.style.top = `${(Math.floor(i / n) * 100) / n}%`;
  };

  function render() {
    const alivePieces = new Set<number>();
    cur.ids.forEach((id, i) => {
      if (id < 0) return;
      alivePieces.add(id);
      place(pieceEls[id], i);
    });
    pieceEls.forEach((el, id) => el.classList.toggle('gone', !alivePieces.has(id)));
    const tg = new Set(sel >= 0 && !busy ? targets(n, cur.cells, sel) : []);
    squares.forEach((sq, i) => {
      sq.classList.toggle('sel', i === sel);
      sq.classList.toggle('target', tg.has(i));
      sq.classList.toggle('hint', i === hintTo);
    });
    pieceEls.forEach((el) => el.classList.remove('picked'));
    if (sel >= 0 && cur.ids[sel] >= 0) pieceEls[cur.ids[sel]].classList.add('picked');
    const left = count(cur.cells);
    countEl.textContent = S.pieces(left);
    legendChips.forEach(([t, chip]) => chip.classList.toggle('out', cur.cells.indexOf(t) < 0));
    undoBtn.classList.toggle('cc-nudge', !busy && left > 1 && !allMoves(n, cur.cells).length);
    hintBtn.innerHTML = `${BULB}<span>${S.hint(hintsLeft)}</span>`;
    hintBtn.disabled = busy;
    undoBtn.disabled = busy || history.length === 0;
    restartBtn.disabled = busy || history.length === 0;
  }

  function newPuzzle() {
    const [size, pieces] = cfg.puzzles[solved];
    n = size;
    const puzzle = makePuzzle({ ...cfg, size, pieces });
    solver = new Solver(n);
    let next = 0;
    start = { cells: puzzle.cells, ids: puzzle.cells.map((c) => (c ? next++ : -1)) };
    cur = start;
    history = [];
    sel = -1;
    hintTo = -1;
    board.style.setProperty('--n', String(n));
    squares = [];
    grid.replaceChildren();
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = Math.floor(i / n);
      const sq = h('button', { class: `cc-sq ${(x + y) % 2 ? 'dark' : 'light'}`, onClick: () => tap(i) });
      squares.push(sq);
      grid.append(sq);
    }
    pieceEls = [];
    layer.replaceChildren();
    start.cells.forEach((t) => {
      if (!t) return;
      const el = h('div', { class: 'cc-piece', html: PIECE_SVG(t) });
      pieceEls.push(el);
      layer.append(el);
    });
    // Legend: one chip per piece type in this puzzle; tap it to hear how the piece moves.
    const types = (['K', 'Q', 'R', 'B', 'N', 'P'] as Piece[]).filter((t) => start.cells.indexOf(t) >= 0);
    legendChips = types.map((t): [Piece, HTMLElement] => [t, h(
        'button',
        {
          class: 'cc-chip',
          onClick: () => { ctx.sfx.tap(); ctx.mascot.say(S.explainPiece(t), 'think', 4500); },
        },
        h('span', { class: 'cc-chip-ico', html: PIECE_SVG(t) }),
        h('span', null, S.Name[t]),
      )]);
    legend.replaceChildren(...legendChips.map(([, chip]) => chip));
    ctx.setProgress(solved, total);
    render();
  }

  /* ----- interaction ----- */

  function select(i: number) {
    sel = i;
    hintTo = -1;
    render();
    const p = cur.cells[i] as Piece;
    if (!targets(n, cur.cells, i).length) ctx.mascot.say(S.noTargets(p), 'think', 4500);
  }

  function tap(i: number) {
    if (busy) return;
    const t = cur.cells[i];
    if (!t) {
      if (sel >= 0) { ctx.sfx.tap(); sel = -1; hintTo = -1; render(); }
      return;
    }
    if (sel < 0 || sel === i) {
      ctx.sfx.tap();
      if (sel === i) { sel = -1; hintTo = -1; render(); } else select(i);
      return;
    }
    const why = explain(n, cur.cells, sel, i);
    if (why === 'ok') return capture({ from: sel, to: i });
    // Not a legal capture: explain why, then pick the tapped piece instead.
    const p = cur.cells[sel] as Piece;
    ctx.sfx.tap();
    replay(squares[i], 'shake');
    select(i);
    ctx.mascot.say(why === 'blocked' ? S.blocked : S.cantTake(p, t), 'think', 5000);
  }

  function capture(m: Move) {
    const moverId = cur.ids[m.from];
    const victimId = cur.ids[m.to];
    history.push(cur);
    const ids = cur.ids.slice();
    ids[m.to] = moverId;
    ids[m.from] = -1;
    cur = { cells: apply(cur.cells, m), ids };
    sel = -1;
    hintTo = -1;
    const mover = pieceEls[moverId];
    const victim = pieceEls[victimId];
    if (cur.cells[m.to] === 'N') replay(mover, 'jump');
    ctx.sfx.step();
    // Keep the captured piece visible until the mover lands on it.
    busy = true;
    render();
    victim.classList.remove('gone');
    later(() => {
      busy = false;
      ctx.sfx.pop();
      render();
      afterMove();
    }, 320);
  }

  function afterMove() {
    const left = count(cur.cells);
    if (left <= 1) return win();
    if (!allMoves(n, cur.cells).length) {
      ctx.sfx.wrong();
      ctx.mascot.say(S.stuck, 'sad', 6000);
    }
  }

  function win() {
    busy = true;
    render();
    solved++;
    const last = cur.ids.filter((id) => id >= 0)[0];
    pieceEls[last].classList.add('home');
    ctx.sfx.correct();
    ctx.celebrate('small');
    ctx.mascot.say(S.done(praise()) + (solved === total - 1 ? ' ' + S.last : ''), 'cheer', 2600);
    later(() => {
      if (solved >= total) {
        // stay busy: the board is frozen under the result card
        ctx.setProgress(solved, total);
        ctx.finish({ stars: starsFromMistakes(mistakes, cfg.three, cfg.two) });
      } else {
        busy = false;
        newPuzzle();
      }
    }, 2300);
  }

  function hint() {
    if (busy) return;
    const good = solver.winning(cur.cells);
    if (!good.length) {
      // On a dead end (no free hint needed): tell the kid to go back.
      ctx.sfx.tap();
      ctx.mascot.say(allMoves(n, cur.cells).length ? S.deadEnd : S.stuck, 'think', 5000);
      replay(undoBtn, 'pop');
      return;
    }
    if (hintsLeft <= 0) {
      ctx.sfx.tap();
      ctx.mascot.say(S.noHints, 'think', 3000);
      return;
    }
    hintsLeft--;
    ctx.sfx.pop();
    const m = good[Math.floor(Math.random() * good.length)];
    sel = m.from;
    hintTo = m.to;
    render();
    ctx.mascot.say(S.hintMove(cur.cells[m.from] as Piece, cur.cells[m.to] as Piece), 'think', 5000);
  }

  function undo() {
    if (busy || !history.length) return;
    mistakes++;
    ctx.sfx.tap();
    cur = history.pop()!;
    sel = -1;
    hintTo = -1;
    render();
    ctx.mascot.say(S.undone, 'idle', 2500);
  }

  function restart() {
    if (busy || !history.length) return;
    mistakes++;
    ctx.sfx.tap();
    cur = start;
    history = [];
    sel = -1;
    hintTo = -1;
    render();
    ctx.mascot.say(S.restarted, 'idle', 2500);
  }

  newPuzzle();
  ctx.mascot.say(S.intro, 'wave', 7000);

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    stopResize();
  };
}

const game: GameModule = {
  id: 'capture',
  order: 5.5,
  title: { en: 'Capture Chain', sk: 'Šachové vyhadzovanie' },
  tagline: { en: 'Capture until one piece is left', sk: 'Vyhadzuj, kým neostane jedna figúrka' },
  color: '#7B5CFF',
  icon: ICON,
  howTo: [
    { en: 'Every move must capture: one piece takes another and lands on its square.', sk: 'Každý ťah musí vyhodiť: figúrka skočí na miesto inej figúrky.' },
    { en: 'Tap a piece, then tap a piece with a ring to capture it.', sk: 'Ťukni na figúrku a potom na figúrku s krúžkom, ktorú vyhodí.' },
    { en: 'Pieces move like in chess. At the end only one piece may be left!', sk: 'Figúrky chodia ako v šachu. Na konci smie ostať len jedna!' },
    { en: 'No more captures? Tap Undo. The Hint button shows a good move.', sk: 'Nedá sa už nič vyhodiť? Ťukni na Späť. Tlačidlo Pomoc ukáže dobrý ťah.' },
  ],
  levels: [
    { id: 'easy', description: { en: '4×4, rook, bishop and knight', sk: '4×4, veža, strelec a jazdec' } },
    { id: 'medium', description: { en: '+ queen and king, up to 6 pieces', sk: '+ dáma a kráľ, až 6 figúrok' } },
    { id: 'hard', description: { en: '+ pawns, up to 8 pieces, dead ends', sk: '+ pešiaci, až 8 figúrok, slepé uličky' } },
  ],
  mount,
};
export default game;
