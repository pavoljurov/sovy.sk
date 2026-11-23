import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { pick, shuffle, starsFromMistakes } from '../../platform/util';
import { MASCOT_NAME, praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import './sudoku.css';

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="#fff" stroke="#2B2440" stroke-width="4"/><path d="M32 6v52M6 32h52" stroke="#2B2440" stroke-width="4"/><path d="M19 6v52M45 6v52M6 19h52M6 45h52" stroke="#2B2440" stroke-width="1.5" opacity=".4"/><circle cx="19" cy="19" r="6" fill="#FF5D8F"/><rect x="39" y="39" width="12" height="12" rx="2" fill="#3DA5FF"/><path d="M45 13l6 11H39z" fill="#4CC95B"/></svg>`;

interface Cfg {
  /** box height × box width; grid size = br * bc */
  br: number;
  bc: number;
  blanks: number;
  shapes: boolean;
  /** star thresholds (mistakes) */
  three: number;
  two: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { br: 2, bc: 2, blanks: 6, shapes: true, three: 0, two: 2 },
  medium: { br: 2, bc: 2, blanks: 10, shapes: false, three: 0, two: 2 },
  hard: { br: 3, bc: 3, blanks: 32, shapes: false, three: 2, two: 6 },
};

const SHAPES = [
  '',
  '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#FF5D8F" stroke="#2B2440" stroke-width="3"/></svg>',
  '<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" rx="4" fill="#3DA5FF" stroke="#2B2440" stroke-width="3"/></svg>',
  '<svg viewBox="0 0 40 40"><path d="M20 4l16 30H4z" fill="#4CC95B" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 40 40"><path d="M20 3l5 10.5 11.5 1.6-8.3 8 2 11.4L20 29l-10.2 5.5 2-11.4-8.3-8 11.5-1.6z" fill="#FFD23F" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/></svg>',
];

type Where = 'row' | 'column' | 'box';
const en = {
  introShapes: 'Every row, column and box needs each shape once. Tap a square!',
  introNumbers: (n: number) => `Every row, column and box needs 1 to ${n} once. Tap a square!`,
  where: { row: 'row', column: 'column', box: 'box' } as Record<Where, string>,
  clashShape: (w: string) => `That shape is already in this ${w}!`,
  clashNumber: (v: number, w: string) => `There is already a ${v} in this ${w}!`,
  wontWork: "Hmm, it fits for now, but it won't work later. Try another one!",
  help: (n: number) => `Help me (${n})`,
  helped: `Here is a little help from ${MASCOT_NAME}!`,
  solved: 'You solved the puzzle!',
};
const sk: typeof en = {
  introShapes: 'V každom riadku, stĺpci aj štvorci musí byť každý tvar raz. Ťukni na políčko!',
  introNumbers: (n) => `V každom riadku, stĺpci aj štvorci musia byť čísla 1 až ${n}, každé raz. Ťukni na políčko!`,
  where: { row: 'riadku', column: 'stĺpci', box: 'štvorci' },
  clashShape: (w) => `Tento tvar už v tomto ${w} je!`,
  clashNumber: (v, w) => `V tomto ${w} už je ${v}!`,
  wontWork: 'Hmm, teraz to sedí, ale neskôr by to nevyšlo. Skús iné!',
  help: (n) => `Pomoc (${n})`,
  helped: `Tu je malá pomoc od sovičky ${MASCOT_NAME}!`,
  solved: 'Hádanka je vyriešená! Hurá!',
};

/* ---------- puzzle generation ---------- */

class Grid {
  readonly n: number;
  constructor(readonly br: number, readonly bc: number) {
    this.n = br * bc;
  }
  row = (i: number) => Math.floor(i / this.n);
  col = (i: number) => i % this.n;
  box = (i: number) => Math.floor(this.row(i) / this.br) * this.br + Math.floor(this.col(i) / this.bc);
  /** Index of a cell that already holds `v` in the same row/col/box, or -1. */
  conflict(cells: number[], i: number, v: number): number {
    for (let j = 0; j < cells.length; j++) {
      if (j !== i && cells[j] === v && (this.row(j) === this.row(i) || this.col(j) === this.col(i) || this.box(j) === this.box(i)))
        return j;
    }
    return -1;
  }
  countSolutions(cells: number[], limit = 2): number {
    const i = cells.indexOf(0);
    if (i < 0) return 1;
    let count = 0;
    for (let v = 1; v <= this.n && count < limit; v++) {
      if (this.conflict(cells, i, v) < 0) {
        cells[i] = v;
        count += this.countSolutions(cells, limit - count);
        cells[i] = 0;
      }
    }
    return count;
  }
  solution(): number[] {
    const { n, br, bc } = this;
    // Pick shuffled rows/cols that keep bands/stacks intact, then relabel symbols.
    const bands = shuffle([...Array(n / br).keys()]);
    const rows = bands.flatMap((b) => shuffle([...Array(br).keys()]).map((r) => b * br + r));
    const stacks = shuffle([...Array(n / bc).keys()]);
    const cols = stacks.flatMap((s) => shuffle([...Array(bc).keys()]).map((c) => s * bc + c));
    const symbols = shuffle([...Array(n).keys()].map((x) => x + 1));
    const base = (r: number, c: number) => (bc * (r % br) + Math.floor(r / br) + c) % n;
    return rows.flatMap((r) => cols.map((c) => symbols[base(r, c)]));
  }
  puzzle(blanks: number): { solution: number[]; cells: number[] } {
    const solution = this.solution();
    const cells = [...solution];
    let removed = 0;
    for (const i of shuffle([...cells.keys()])) {
      if (removed >= blanks) break;
      const keep = cells[i];
      cells[i] = 0;
      if (this.countSolutions([...cells]) === 1) removed++;
      else cells[i] = keep;
    }
    return { solution, cells };
  }
}

/* ---------- game ---------- */

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const grid = new Grid(cfg.br, cfg.bc);
  const n = grid.n;
  const { solution, cells } = grid.puzzle(cfg.blanks);
  const given = cells.map((v) => v !== 0);
  const totalBlanks = given.filter((g) => !g).length;

  let selected = -1;
  /** Piece picked first (piece → square flow); 0 = none. Never set together with `selected`. */
  let armed = 0;
  let mistakes = 0;
  let hintsLeft = 3;

  const show = (v: number) => (v === 0 ? '' : cfg.shapes ? SHAPES[v] : String(v));

  const board = h('div', { class: `sdk-board n${n}`, style: { '--n': String(n) } });
  const cellEls = cells.map((_, i) => {
    const r = grid.row(i), c = grid.col(i);
    const cls = ['sdk-cell'];
    if (given[i]) cls.push('given');
    if ((c + 1) % cfg.bc === 0 && c < n - 1) cls.push('br');
    if ((r + 1) % cfg.br === 0 && r < n - 1) cls.push('bb');
    if ((Math.floor(r / cfg.br) + Math.floor(c / cfg.bc)) % 2 === 1) cls.push('alt');
    const el = h('button', { class: cls.join(' '), html: show(cells[i]), onClick: () => select(i) });
    // Drop the flash class (and its delay) when done, so later animations on the cell are not blocked.
    el.addEventListener('animationend', (e) => {
      if (e.animationName !== 'sdk-flash') return;
      el.classList.remove('flash');
      el.style.animationDelay = '';
    });
    board.append(el);
    return el;
  });

  /** Flash cells with a single forced reflow (replay() per cell would force one layout each). */
  function flash(idx: Iterable<number>, staggerMs = 0) {
    const els = [...new Set(idx)].map((j) => cellEls[j]);
    els.forEach((el) => el.classList.remove('flash'));
    void board.offsetWidth;
    els.forEach((el, k) => {
      el.style.animationDelay = staggerMs ? `${k * staggerMs}ms` : '';
      el.classList.add('flash');
    });
  }

  const keyEls = Array.from({ length: n }, (_, k) =>
    h('button', { class: 'btn sdk-key', html: show(k + 1), onClick: () => pressKey(k + 1) }),
  );
  const palette = h('div', { class: 'sdk-pal', style: { '--pc': String(cfg.bc) } }, keyEls);
  const hintBtn: HTMLButtonElement = h('button', { class: 'btn btn-warn sdk-hint', onClick: () => hint() }, S.help(hintsLeft));
  const side = h('div', { class: 'sdk-side' }, palette, hintBtn);
  const wrap = h('div', { class: 'sdk' }, board, side);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    palette.style.setProperty('--pc', String(vertical ? Math.min(n, 9) : cfg.bc));
    const pad = 24;
    const size = vertical ? Math.min(w - pad, hgt * 0.68) : Math.min(hgt - pad, w * 0.66);
    board.style.width = board.style.height = `${Math.max(120, Math.floor(size))}px`;
    board.style.setProperty('--cell', `${size / n}px`);
  });

  function refreshHighlights() {
    const v = selected >= 0 ? cells[selected] : armed;
    keyEls.forEach((el, k) => el.classList.toggle('armed', k + 1 === armed));
    cellEls.forEach((el, i) => {
      const peer =
        selected >= 0 &&
        (grid.row(i) === grid.row(selected) || grid.col(i) === grid.col(selected) || grid.box(i) === grid.box(selected));
      el.classList.toggle('peer', peer);
      el.classList.toggle('sel', i === selected);
      el.classList.toggle('same', v !== 0 && cells[i] === v);
    });
  }

  function select(i: number) {
    if (given[i] || cells[i] !== 0) {
      selected = -1;
      armed = 0;
      refreshHighlights();
      cellEls[i].classList.add('same');
      return;
    }
    selected = i;
    if (armed) return place(armed);
    ctx.sfx.tap();
    refreshHighlights();
  }

  function pressKey(v: number) {
    if (selected >= 0) return place(v);
    // No square chosen yet: remember the piece (tap it again to drop it) and wait for a square.
    armed = armed === v ? 0 : v;
    ctx.sfx.tap();
    refreshHighlights();
  }

  function fill(i: number, v: number) {
    cells[i] = v;
    cellEls[i].innerHTML = show(v);
    cellEls[i].classList.add('filled');
    replay(cellEls[i], 'pop');
    // Celebrate any row / column / box that just got completed.
    const groups: number[][] = [];
    const sameRow = [...cells.keys()].filter((j) => grid.row(j) === grid.row(i));
    const sameCol = [...cells.keys()].filter((j) => grid.col(j) === grid.col(i));
    const sameBox = [...cells.keys()].filter((j) => grid.box(j) === grid.box(i));
    for (const g of [sameRow, sameCol, sameBox]) if (g.every((j) => cells[j] !== 0)) groups.push(g);
    if (groups.length) flash(groups.flat());
    selected = -1;
    refreshHighlights();
  }

  function place(v: number) {
    const i = selected;
    if (solution[i] === v) {
      armed = 0;
      fill(i, v);
      ctx.sfx.correct();
      const left = cells.filter((x) => x === 0).length;
      ctx.setProgress(totalBlanks - left, totalBlanks);
      if (left === 0) return win();
      if (Math.random() < 0.4) ctx.mascot.say(praise(), 'happy', 1500);
      return;
    }
    mistakes++;
    // Piece-first: keep the piece picked so another square can be tried; drop the square.
    if (armed) {
      selected = -1;
      refreshHighlights();
    }
    ctx.sfx.wrong();
    replay(cellEls[i], 'shake');
    const j = grid.conflict(cells, i, v);
    if (j >= 0) {
      replay(cellEls[j], 'clash');
      const where: Where = grid.row(j) === grid.row(i) ? 'row' : grid.col(j) === grid.col(i) ? 'column' : 'box';
      const w = S.where[where];
      ctx.mascot.say(cfg.shapes ? S.clashShape(w) : S.clashNumber(v, w), 'think', 4000);
    } else {
      ctx.mascot.say(S.wontWork, 'think', 4500);
    }
  }

  function hint() {
    if (hintsLeft <= 0) return;
    let i = selected;
    if (i < 0) {
      const empty = [...cells.keys()].filter((k) => cells[k] === 0);
      i = pick(empty);
    }
    hintsLeft--;
    mistakes++;
    armed = 0;
    hintBtn.textContent = S.help(hintsLeft);
    hintBtn.disabled = hintsLeft === 0;
    fill(i, solution[i]);
    ctx.sfx.pop();
    ctx.mascot.say(S.helped, 'wave', 2500);
    const left = cells.filter((x) => x === 0).length;
    ctx.setProgress(totalBlanks - left, totalBlanks);
    if (left === 0) win();
  }

  function win() {
    // No ctx.celebrate() here: the platform's result screen already throws confetti.
    ctx.mascot.say(S.solved, 'cheer', 3000);
    flash(cellEls.keys(), 15);
    ctx.finish({ stars: starsFromMistakes(mistakes, cfg.three, cfg.two) });
  }

  ctx.setProgress(0, totalBlanks);
  ctx.mascot.say(
    cfg.shapes ? S.introShapes : S.introNumbers(n),
    'wave',
    6000,
  );
  return () => stopResize();
}

const game: GameModule = {
  id: 'sudoku',
  order: 3,
  title: { en: 'Sudoku', sk: 'Sudoku' },
  tagline: { en: 'Fill the grid – no repeats!', sk: 'Vyplň mriežku – nič sa neopakuje!' },
  color: '#4CC95B',
  icon: ICON,
  howTo: [
    { en: 'Each row, column and box must have every shape or number exactly once.', sk: 'V každom riadku, stĺpci aj štvorci musí byť každý tvar alebo číslo práve raz.' },
    { en: 'Tap an empty square, then pick what belongs there – or pick first, then tap the square.', sk: 'Ťukni na prázdne políčko a vyber, čo doň patrí – alebo najprv vyber a potom ťukni na políčko.' },
    { en: 'Stuck? The Help button fills in one square (it counts as a mistake).', sk: 'Nevieš ďalej? Tlačidlo Pomoc vyplní jedno políčko (ale počíta sa ako chyba).' },
  ],
  levels: [
    { id: 'easy', description: { en: '4×4 with colourful shapes', sk: '4×4 s farebnými tvarmi' } },
    { id: 'medium', description: { en: '4×4 with numbers 1–4', sk: '4×4 s číslami 1–4' } },
    { id: 'hard', description: { en: 'Big 9×9 puzzle', sk: 'Veľké sudoku 9×9' } },
  ],
  mount,
};
export default game;
