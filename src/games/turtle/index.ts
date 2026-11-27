import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { shuffle, sleep, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import {
  type Block, type Dir, type LevelKey, type Placed, type ShapeId, type Step,
  FWD_MAX, GRID, LIMIT, PUZZLES, REP_MAX, REP_MIN,
  countBlocks, place, segKey, trace, verifyPuzzles,
} from './logic';
import './turtle.css';


/* ---------- icons ---------- */

const ARROW = `<svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const turnIcon = (right: boolean) =>
  `<svg viewBox="0 0 24 24"${right ? ' style="transform:scaleX(-1)"' : ''}><path d="M20 21v-7a5 5 0 0 0-5-5H9V4L2 10.5 9 17v-4h6a1 1 0 0 1 1 1v7z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const LOOP = `<svg viewBox="0 0 24 24"><path d="M5 13a7 7 0 0 1 12-6l1.5-2.5L20 11h-6.5l2.2-2.4A4.6 4.6 0 0 0 7.4 13zM19 11a7 7 0 0 1-12 6l-1.5 2.5L4 13h6.5l-2.2 2.4a4.6 4.6 0 0 0 8.3-2.4z" fill="currentColor" stroke="#2B2440" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const END = `<svg viewBox="0 0 24 24"><path d="M8 3h7v18H8v-3.5h3.5v-11H8z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const DEL = `<svg viewBox="0 0 24 24"><path d="M8 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-6-7z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 9l6 6M17 9l-6 6" stroke="#2B2440" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const CLEAR = `<svg viewBox="0 0 24 24"><path d="M5 7h14l-1.3 13a1.5 1.5 0 0 1-1.5 1.3H7.8a1.5 1.5 0 0 1-1.5-1.3zM3.5 7h17M9 7V4h6v3" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="#2B2440" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor" stroke="#2B2440" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const FAST = `<svg viewBox="0 0 24 24"><path d="M2 5l10 7-10 7zM12 5l10 7-10 7z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const ICONS = { F: ARROW, L: turnIcon(false), R: turnIcon(true), P: LOOP };

const TURTLE = `<svg viewBox="0 0 40 40">
 <g fill="#8BDB5E" stroke="#2B2440" stroke-width="2.2">
  <ellipse cx="9.5" cy="13" rx="4" ry="5" transform="rotate(-35 9.5 13)"/><ellipse cx="30.5" cy="13" rx="4" ry="5" transform="rotate(35 30.5 13)"/>
  <ellipse cx="9.5" cy="29" rx="4" ry="5" transform="rotate(35 9.5 29)"/><ellipse cx="30.5" cy="29" rx="4" ry="5" transform="rotate(-35 30.5 29)"/>
  <path d="M18 33l2 5 2-5z" stroke-linejoin="round"/>
  <ellipse cx="20" cy="6.5" rx="5.2" ry="5.6"/>
 </g>
 <circle cx="17.6" cy="5.2" r="1.3" fill="#2B2440"/><circle cx="22.4" cy="5.2" r="1.3" fill="#2B2440"/>
 <ellipse cx="20" cy="21" rx="11.5" ry="13" fill="#1FC2AE" stroke="#2B2440" stroke-width="2.4"/>
 <path d="M20 14l4.5 3v5L20 25l-4.5-3v-5zM20 14v-5M24.5 17l5-2M24.5 22l5 2.5M20 25v8M15.5 22l-5 2.5M15.5 17l-5-2" fill="#5FD9C6" stroke="#178F80" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="#fff" stroke="#2B2440" stroke-width="4"/><g fill="#2B2440" opacity=".25"><circle cx="16" cy="16" r="2"/><circle cx="32" cy="16" r="2"/><circle cx="48" cy="16" r="2"/><circle cx="16" cy="32" r="2"/><circle cx="32" cy="32" r="2"/><circle cx="48" cy="32" r="2"/><circle cx="16" cy="48" r="2"/><circle cx="32" cy="48" r="2"/><circle cx="48" cy="48" r="2"/></g><path d="M16 48V16h18" fill="none" stroke="#7B5CFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 16v32H30" fill="none" stroke="#B4A4F4" stroke-width="3.5" stroke-linecap="round" stroke-dasharray=".1 6"/><g transform="translate(40 16) rotate(90) scale(.68) translate(-20 -20)">${TURTLE.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;

/* ---------- texts ---------- */

const en = {
  block: { F: 'Forward', L: 'Left', R: 'Right', P: 'Repeat', end: 'End' },
  aria: {
    F: (n: number) => `Forward ${n}`,
    L: 'Turn left',
    R: 'Turn right',
    P: (n: number) => `Repeat ${n} times`,
    end: 'End of repeat',
    less: 'Less',
    more: 'More',
  },
  shape: {
    ell: 'letter L', you: 'letter U', hook: 'hook', sq2: 'small square', rect: 'rectangle', tee: 'letter T',
    snake: 'snake', stairs3: 'stairs', sq3: 'square', sq4: 'big square', rect2: 'long box', stairs4: 'long stairs',
    plus: 'plus', wave: 'castle wall', comb: 'comb', window: 'window', ladder: 'ladder', row3: 'train',
    flower: 'flower', pyramid: 'pyramid', mill: 'windmill', diag: 'box stairs',
  } as Record<ShapeId, string>,
  picture: 'Picture:',
  blocks: (n: number): string => (n === 1 ? 'block' : 'blocks'),
  maxBlocks: (n: number) => `max ${n} ${n === 1 ? 'block' : 'blocks'}`,
  empty: 'Tap the blocks below',
  delAria: 'Delete the marked block',
  clearAria: 'Clear the program',
  clearAgain: 'Tap again to clear the whole program.',
  go: 'Start',
  fast: 'Faster',
  introEasy: 'Draw the dotted picture! Tap the blocks to build a program for the turtle, then press Start.',
  introMedium: 'New block: Repeat! The turtle does the blocks inside it again and again. Watch the block limit!',
  introHard: 'You can put a Repeat inside a Repeat! Big pictures from just a few blocks.',
  inside: 'Now tap blocks – they go inside Repeat. Use + and − to change the number. Then tap End.',
  needProgram: 'Tap the blocks to build a program first!',
  full: (n: number) => `That is all ${n} blocks! Can a Repeat do the work?`,
  fullEasy: 'The program is full. Remove a block first.',
  edge: 'Oops! The turtle cannot walk off the paper.',
  extra: 'The red lines are not in the picture. Check the numbers and the turns!',
  missing: 'Almost! The orange lines are still missing.',
  emptyRepeat: 'One Repeat is empty – put blocks inside it.',
  tooLong: 'Whoa, that walk is far too long! Check the Repeat numbers.',
  fix: 'Fix the program and try again.',
  works: (p: string) => `${p} The picture matches!`,
};
const skBlocks = (n: number): string => (n === 1 ? 'blok' : n >= 2 && n <= 4 ? 'bloky' : 'blokov');
const sk: typeof en = {
  block: { F: 'Dopredu', L: 'Vľavo', R: 'Vpravo', P: 'Opakuj', end: 'Koniec' },
  aria: {
    F: (n) => `Dopredu ${n}`,
    L: 'Otoč sa doľava',
    R: 'Otoč sa doprava',
    P: (n) => `Opakuj ${n}-krát`,
    end: 'Koniec opakovania',
    less: 'Menej',
    more: 'Viac',
  },
  shape: {
    ell: 'písmeno L', you: 'písmeno U', hook: 'háčik', sq2: 'malý štvorec', rect: 'obdĺžnik', tee: 'písmeno T',
    snake: 'hadík', stairs3: 'schody', sq3: 'štvorec', sq4: 'veľký štvorec', rect2: 'dlhá krabica', stairs4: 'dlhé schody',
    plus: 'plus', wave: 'hradby', comb: 'hrebeň', window: 'okno', ladder: 'rebrík', row3: 'vláčik',
    flower: 'kvietok', pyramid: 'pyramída', mill: 'veterník', diag: 'schody z kociek',
  },
  picture: 'Obrázok:',
  blocks: skBlocks,
  maxBlocks: (n) => `najviac ${n} ${skBlocks(n)}`,
  empty: 'Ťukaj na bloky dole',
  delAria: 'Zmazať označený blok',
  clearAria: 'Zmazať celý program',
  clearAgain: 'Ťukni ešte raz a celý program sa zmaže.',
  go: 'Štart',
  fast: 'Rýchlejšie',
  introEasy: 'Nakresli bodkovaný obrázok! Ťukaj na bloky, poskladaj program pre korytnačku a stlač Štart.',
  introMedium: 'Nový blok: Opakuj! Bloky v ňom korytnačka urobí znova a znova. Pozor na počet blokov!',
  introHard: 'Opakuj môžeš dať aj do iného Opakuj! Veľké obrázky z pár blokov.',
  inside: 'Teraz ťukaj na bloky – pôjdu dovnútra Opakuj. Číslo zmeníš cez + a −. Potom ťukni na Koniec.',
  needProgram: 'Najprv ťukaj na bloky a poskladaj program!',
  full: (n) => `To je všetkých ${n} ${skBlocks(n)}! Pomôže Opakuj?`,
  fullEasy: 'Program je plný. Najprv nejaký blok zmaž.',
  edge: 'Ups! Korytnačka nemôže odísť z papiera.',
  extra: 'Červené čiary v obrázku nie sú. Skontroluj čísla a otočenia!',
  missing: 'Skoro! Ešte chýbajú oranžové čiary.',
  emptyRepeat: 'Jedno Opakuj je prázdne – daj doň bloky.',
  tooLong: 'Hú, to je priveľmi dlhá cesta! Skontroluj čísla pri Opakuj.',
  fix: 'Oprav program a skús to znova.',
  works: (p) => `${p} Obrázok sedí!`,
};

/* ---------- difficulty ---------- */

interface Cfg {
  puzzles: number;
  repeat: boolean;
  /** Start headings the turtle may get (0 = up). */
  dirs: Dir[];
}
const CFG: Record<LevelId, Cfg> = {
  easy: { puzzles: 5, repeat: false, dirs: [0] },
  medium: { puzzles: 5, repeat: true, dirs: [0, 1] },
  hard: { puzzles: 4, repeat: true, dirs: [0, 1, 2, 3] },
};

if (import.meta.env.DEV) {
  const problems = verifyPuzzles();
  if (problems.length) console.error('[turtle] puzzle problems:\n' + problems.join('\n'));
}

function pickPuzzles(level: LevelKey, cfg: Cfg): Placed[] {
  const chosen = shuffle(PUZZLES[level]).slice(0, cfg.puzzles);
  const out: Placed[] = [];
  for (const def of chosen) {
    const dirs = shuffle(cfg.dirs);
    for (const dir of dirs) {
      const p = place(def, GRID[level], dir, Math.random() < 0.5, LIMIT[level], Math.random);
      if (p) {
        out.push(p);
        break;
      }
    }
  }
  // Easier pictures (shorter solutions) first.
  return out.sort((a, b) => countBlocks(a.ref) - countBlocks(b.ref));
}

/* ---------- game ---------- */

const U = 10; // SVG units per grid step
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag: string, attrs: Record<string, string | number>): SVGElement => {
  const el = document.createElementNS(NS, tag) as SVGElement;
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
};

interface Cursor { list: Block[]; i: number }

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const level = ctx.level as LevelKey;
  const cfg = CFG[level];
  const S = pickLang({ en, sk });
  const N = GRID[level];
  let alive = true;
  let solved = 0;
  let failedRuns = 0;
  let running = false;
  let fast = false;
  let insideHintShown = false;
  let program: Block[] = [];
  let cursor: Cursor = { list: program, i: 0 };
  const puzzles = pickPuzzles(level, cfg);
  let puzzle = puzzles[0];

  /* ----- board ----- */
  const svg = svgEl('svg', { viewBox: `${-U / 2} ${-U / 2} ${N * U} ${N * U}`, class: 'tt-svg' });
  const gTarget = svgEl('g', { class: 'tt-target' });
  const gInk = svgEl('g', { class: 'tt-ink' });
  const gDots = svgEl('g', { class: 'tt-dots' });
  const startMark = svgEl('circle', { r: 2.6, class: 'tt-start' });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) gDots.append(svgEl('circle', { cx: x * U, cy: y * U, r: 0.75 }));
  svg.append(gDots, gTarget, startMark, gInk);
  const turtleInner = h('div', { class: 'tt-turtle-inner', html: TURTLE });
  const turtle = h('div', { class: 'tt-turtle', style: { width: `${100 / N}%`, height: `${100 / N}%` } }, turtleInner);
  const board = h('div', { class: 'tt-board' }, svg as unknown as Node, turtle);

  /* ----- panel ----- */
  const shapeName = h('b', { class: 'tt-shape' });
  const counter = h('span', { class: 'tt-counter' });
  const head = h('div', { class: 'tt-head' }, h('span', { class: 'tt-pic' }, S.picture, ' ', shapeName), counter);
  const programEl = h('div', { class: 'tt-program' });
  const programBox = h('div', {
    class: 'tt-program-box',
    onClick: (e: Event) => {
      // A tap on the empty area moves the cursor to the end of the program.
      if (e.target === programBox || e.target === programEl) setCursor({ list: program, i: program.length });
    },
  }, programEl);

  const paletteBtns: HTMLButtonElement[] = [];
  const palBtn = (cls: string, icon: string, label: string, aria: string, fn: () => void) => {
    const b = h('button', { class: `btn tt-pal ${cls}`, 'aria-label': aria, onClick: fn },
      h('span', { class: 'tt-pal-icon', html: icon }), h('span', { class: 'tt-pal-label' }, label));
    paletteBtns.push(b);
    return b;
  };
  const fwdBtn = palBtn('fwd', ARROW, S.block.F, S.aria.F(1), () => insert({ k: 'F', n: 1 }));
  const leftBtn = palBtn('turn', ICONS.L, S.block.L, S.aria.L, () => insert({ k: 'L' }));
  const rightBtn = palBtn('turn', ICONS.R, S.block.R, S.aria.R, () => insert({ k: 'R' }));
  const repBtn = palBtn('rep', LOOP, S.block.P, S.aria.P(REP_MIN), () => insert({ k: 'P', n: REP_MIN, body: [] }));
  const endBtn = palBtn('end', END, S.block.end, S.aria.end, () => closeRepeat());
  const palette = h('div', { class: `tt-palette ${cfg.repeat ? 'n5' : 'n3'}` },
    fwdBtn, leftBtn, rightBtn, cfg.repeat ? repBtn : null, cfg.repeat ? endBtn : null);

  const lessBtn = h('button', { class: 'btn tt-step', 'aria-label': S.aria.less, onClick: () => adjust(-1) }, '−');
  const moreBtn = h('button', { class: 'btn tt-step', 'aria-label': S.aria.more, onClick: () => adjust(1) }, '+');
  const delBtn = h('button', { class: 'btn btn-warn tt-tool', 'aria-label': S.delAria, html: DEL, onClick: () => del() });
  const clearBtn = h('button', { class: 'btn btn-alt tt-tool', 'aria-label': S.clearAria, html: CLEAR, onClick: () => clearAll() });
  const runBtn = h('button', { class: 'btn btn-big btn-go tt-run', onClick: () => (running ? toggleFast() : void run()) });
  const tools = h('div', { class: 'tt-tools' }, lessBtn, moreBtn, delBtn, clearBtn, runBtn);

  const panel = h('div', { class: 'tt-panel' }, head, programBox, palette, tools);
  const wrap = h('div', { class: 'tt' }, board, panel);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    const size = vertical ? Math.min(w - 20, hgt * 0.47) : Math.min(hgt - 24, w * 0.52);
    board.style.width = board.style.height = `${Math.max(150, Math.floor(size))}px`;
  });

  /* ----- program tree helpers ----- */

  /** The repeat whose body is `list` (null for the main program), and where that repeat sits. */
  function ownerOf(list: Block[], within: Block[] = program): { rep: Block & { k: 'P' }; list: Block[]; i: number } | null {
    for (let i = 0; i < within.length; i++) {
      const b = within[i];
      if (b.k !== 'P') continue;
      if (b.body === list) return { rep: b, list: within, i };
      const deeper = ownerOf(list, b.body);
      if (deeper) return deeper;
    }
    return null;
  }

  /** The block the − / + / ⌫ buttons act on: the one left of the cursor, or the repeat it sits at the start of. */
  function current(): Block | null {
    if (cursor.i > 0) return cursor.list[cursor.i - 1];
    return ownerOf(cursor.list)?.rep ?? null;
  }

  const budget = () => puzzle.budget;
  const used = () => countBlocks(program);

  /* ----- board rendering ----- */

  let angle = 0;
  function setTurtle(x: number, y: number, a: number, ms: number) {
    turtle.style.transition = ms ? `left ${ms}ms linear, top ${ms}ms linear` : 'none';
    turtleInner.style.transition = ms ? `transform ${ms}ms ease-in-out` : 'none';
    turtle.style.left = `${(x * 100) / N}%`;
    turtle.style.top = `${(y * 100) / N}%`;
    turtleInner.style.transform = `rotate(${a * 90}deg)`;
  }

  function resetBoard() {
    gInk.replaceChildren();
    for (const el of Array.from(gTarget.children)) el.classList.remove('missing');
    board.classList.remove('won', 'failed');
    angle = puzzle.start.dir;
    setTurtle(puzzle.start.x, puzzle.start.y, angle, 0);
  }

  function drawTarget() {
    gTarget.replaceChildren();
    puzzle.target.forEach((k) => {
      const [x1, y1, x2, y2] = k.split(',').map(Number);
      const line = svgEl('line', { x1: x1 * U, y1: y1 * U, x2: x2 * U, y2: y2 * U });
      line.setAttribute('data-k', k);
      gTarget.append(line);
    });
    startMark.setAttribute('cx', String(puzzle.start.x * U));
    startMark.setAttribute('cy', String(puzzle.start.y * U));
  }

  function inkLine(st: Step & { t: 'move' }, ms: number) {
    const line = svgEl('line', { x1: st.from.x * U, y1: st.from.y * U, x2: st.to.x * U, y2: st.to.y * U });
    line.setAttribute('data-k', segKey(st.from.x, st.from.y, st.to.x, st.to.y));
    line.style.strokeDasharray = `${U} ${U * 2}`;
    line.style.strokeDashoffset = String(U);
    gInk.append(line);
    void line.getBoundingClientRect();
    line.style.transition = `stroke-dashoffset ${ms}ms linear`;
    line.style.strokeDashoffset = '0';
  }

  /* ----- program rendering ----- */

  const chipOf = new Map<Block, HTMLElement>();
  const counterOf = new Map<Block, HTMLElement>();
  const endOf = new Map<Block, HTMLElement>();

  function renderList(list: Block[], depth: number): HTMLElement[] {
    const out: HTMLElement[] = [];
    const caret = () => h('i', { class: 'tt-caret' });
    list.forEach((b, i) => {
      if (cursor.list === list && cursor.i === i) out.push(caret());
      if (b.k === 'P') {
        const num = h('b', null, `${b.n}×`);
        counterOf.set(b, num);
        const headChip = h('button', {
          class: 'tt-chip rep', 'aria-label': S.aria.P(b.n), html: LOOP,
          onClick: () => setCursor({ list: b.body, i: 0 }),
        }, num);
        const endChip = h('button', {
          class: 'tt-chip rep-end', 'aria-label': S.aria.end, html: END,
          onClick: () => setCursor({ list, i: i + 1 }),
        });
        const group = h('div', { class: `tt-group d${depth % 2}${cursor.list === b.body ? ' open' : ''}` },
          headChip, ...renderList(b.body, depth + 1), endChip);
        chipOf.set(b, headChip);
        endOf.set(b, endChip);
        out.push(group);
      } else {
        const chip = h('button', {
          class: `tt-chip ${b.k === 'F' ? 'fwd' : 'turn'}`,
          'aria-label': b.k === 'F' ? S.aria.F(b.n) : S.aria[b.k],
          html: ICONS[b.k],
          onClick: () => setCursor({ list, i: i + 1 }),
        }, b.k === 'F' ? h('b', null, String(b.n)) : null);
        chipOf.set(b, chip);
        out.push(chip);
      }
    });
    if (cursor.list === list && cursor.i === list.length) out.push(caret());
    return out;
  }

  function renderProgram() {
    chipOf.clear();
    counterOf.clear();
    endOf.clear();
    programEl.replaceChildren(...renderList(program, 0));
    if (!program.length) programEl.append(h('span', { class: 'tt-empty' }, S.empty));
    const cur = current();
    if (cur && !running) {
      // Right after a repeat the ring sits on its end bracket, at the start of its body on its head.
      const afterRepeat = cursor.i > 0 && cur.k === 'P';
      (afterRepeat ? endOf.get(cur) : chipOf.get(cur))?.classList.add('cur');
    }
    const u = used();
    counter.textContent = `${u} / ${budget()} ${S.blocks(budget())}`;
    counter.classList.toggle('full', u >= budget());
    // Not disabled when the budget is full: a tap then explains the limit (see insert()).
    paletteBtns.forEach((b) => (b.disabled = running));
    endBtn.disabled = running || !ownerOf(cursor.list);
    const numeric = !!cur && (cur.k === 'F' || cur.k === 'P');
    lessBtn.disabled = running || !numeric || (cur!.k === 'F' ? cur!.n <= 1 : (cur as { n: number }).n <= REP_MIN);
    moreBtn.disabled = running || !numeric || (cur!.k === 'F' ? cur!.n >= FWD_MAX : (cur as { n: number }).n >= REP_MAX);
    delBtn.disabled = running || !cur;
    clearBtn.disabled = running || !program.length;
    runBtn.innerHTML = running ? FAST : PLAY;
    runBtn.append(running ? S.fast : S.go);
    runBtn.classList.toggle('fast', running && fast);
    // Keep the caret in view.
    const caretEl = programEl.querySelector('.tt-caret') as HTMLElement | null;
    if (caretEl) programBox.scrollTop = Math.max(0, caretEl.offsetTop - programBox.clientHeight + caretEl.offsetHeight + 8);
  }

  /* ----- editing ----- */

  function edited() {
    resetBoard();
    renderProgram();
  }

  function setCursor(c: Cursor) {
    if (running) return;
    ctx.sfx.tap();
    cursor = c;
    edited();
  }

  function insert(b: Block) {
    if (running) return;
    if (used() + 1 > budget()) {
      ctx.sfx.wrong();
      replay(counter, 'shake');
      ctx.mascot.say(cfg.repeat ? S.full(budget()) : S.fullEasy, 'think', 4000);
      return;
    }
    ctx.sfx.tap();
    cursor.list.splice(cursor.i, 0, b);
    if (b.k === 'P') {
      cursor = { list: b.body, i: 0 };
      if (!insideHintShown) {
        insideHintShown = true;
        ctx.mascot.say(S.inside, 'think', 6000);
      }
    } else cursor = { list: cursor.list, i: cursor.i + 1 };
    edited();
  }

  function closeRepeat() {
    const own = ownerOf(cursor.list);
    if (!own || running) return;
    setCursor({ list: own.list, i: own.i + 1 });
  }

  function adjust(d: 1 | -1) {
    const cur = current();
    if (running || !cur || (cur.k !== 'F' && cur.k !== 'P')) return;
    const [lo, hi] = cur.k === 'F' ? [1, FWD_MAX] : [REP_MIN, REP_MAX];
    const n = Math.max(lo, Math.min(hi, cur.n + d));
    if (n === cur.n) return;
    ctx.sfx.tap();
    cur.n = n;
    edited();
    const chip = chipOf.get(cur);
    if (chip) replay(chip, 'pop');
  }

  /**
   * ⌫ works like backspace in a text editor:
   * - after a normal block: deletes it;
   * - after a repeat: steps back inside it, behind its last block (nothing is lost by accident);
   * - at the start of a repeat: removes just the repeat, the blocks inside it stay in the program.
   */
  function del() {
    if (running) return;
    const prev = cursor.i > 0 ? cursor.list[cursor.i - 1] : null;
    if (prev && prev.k === 'P') {
      cursor = { list: prev.body, i: prev.body.length };
    } else if (prev) {
      cursor.list.splice(cursor.i - 1, 1);
      cursor = { list: cursor.list, i: cursor.i - 1 };
    } else {
      const own = ownerOf(cursor.list);
      if (!own) return;
      own.list.splice(own.i, 1, ...own.rep.body);
      cursor = { list: own.list, i: own.i };
    }
    ctx.sfx.tap();
    edited();
  }

  let clearTimer = 0;
  function clearAll() {
    if (running || !program.length) return;
    ctx.sfx.tap();
    if (!clearBtn.classList.contains('confirm')) {
      // Two taps, so a whole program is never lost by one accidental tap.
      clearBtn.classList.add('confirm');
      replay(clearBtn, 'shake');
      ctx.mascot.say(S.clearAgain, 'think', 2500);
      clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => clearBtn.classList.remove('confirm'), 2500);
      return;
    }
    clearBtn.classList.remove('confirm');
    program = [];
    cursor = { list: program, i: 0 };
    edited();
  }

  function toggleFast() {
    fast = !fast;
    ctx.sfx.tap();
    runBtn.classList.toggle('fast', fast);
  }

  /* ----- puzzles ----- */

  function newPuzzle() {
    puzzle = puzzles[solved];
    program = [];
    cursor = { list: program, i: 0 };
    shapeName.textContent = S.shape[puzzle.def.id];
    drawTarget();
    edited();
    ctx.setProgress(solved, puzzles.length);
    if (solved === 0) {
      const intro = level === 'easy' ? S.introEasy : level === 'medium' ? S.introMedium : S.introHard;
      ctx.mascot.say(cfg.repeat ? `${intro} (${S.maxBlocks(puzzle.budget)})` : intro, 'wave', 7000);
    }
  }

  const hasEmptyRepeat = (list: Block[]): boolean => list.some((b) => b.k === 'P' && (!b.body.length || hasEmptyRepeat(b.body)));

  /* ----- running ----- */

  async function run() {
    if (running) return;
    if (!program.length) {
      ctx.mascot.say(S.needProgram, 'think', 3000);
      return;
    }
    running = true;
    fast = false;
    resetBoard();
    renderProgram();
    await sleep(200);
    if (!alive) return;

    const LIMIT_STEPS = 400;
    const steps = trace(program, puzzle.start, LIMIT_STEPS + 1);
    const drawn = new Set<string>();
    let failure: string | null = null;
    const activeRef: { el: HTMLElement | null } = { el: null };
    const mark = (b: Block) => {
      const el = chipOf.get(b) ?? null;
      if (el === activeRef.el) return;
      activeRef.el?.classList.remove('active');
      activeRef.el = el;
      el?.classList.add('active');
    };

    for (let si = 0; si < steps.length; si++) {
      const st = steps[si];
      if (!alive) return;
      if (si >= LIMIT_STEPS) {
        failure = S.tooLong;
        break;
      }
      const k = fast ? 0.3 : 1;
      if (st.t === 'iter') {
        const num = counterOf.get(st.block);
        if (num) num.textContent = `${st.i + 1}/${(st.block as { n: number }).n}`;
        mark(st.block);
        await sleep(160 * k);
        continue;
      }
      mark(st.block);
      if (st.t === 'turn') {
        angle += st.delta;
        setTurtle(st.to.x, st.to.y, angle, 260 * k);
        ctx.sfx.step();
        await sleep(300 * k);
        continue;
      }
      const { to } = st;
      if (to.x < 0 || to.y < 0 || to.x >= N || to.y >= N) {
        replay(turtle, 'bump');
        failure = S.edge;
        break;
      }
      const ms = 330 * k;
      inkLine(st, ms);
      setTurtle(to.x, to.y, angle, ms);
      drawn.add(segKey(st.from.x, st.from.y, to.x, to.y));
      ctx.sfx.step();
      await sleep(ms + 40 * k);
    }
    if (!alive) return;
    activeRef.el?.classList.remove('active');
    counterOf.forEach((el, b) => (el.textContent = `${(b as { n: number }).n}×`));

    const extra = Array.from(drawn).filter((s) => !puzzle.target.has(s));
    const missing = Array.from(puzzle.target).filter((s) => !drawn.has(s));
    if (!failure && !extra.length && !missing.length) {
      board.classList.add('won');
      solved++;
      ctx.sfx.correct();
      ctx.celebrate('small');
      ctx.mascot.say(S.works(praise()), 'cheer', 2500);
      await sleep(2000);
      if (!alive) return;
      running = false;
      if (solved >= puzzles.length) {
        renderProgram();
        ctx.setProgress(solved, puzzles.length);
        ctx.finish({ stars: starsFromMistakes(failedRuns, 1, 4) });
      } else newPuzzle();
      return;
    }

    failedRuns++;
    ctx.sfx.wrong();
    board.classList.add('failed');
    const extraSet = new Set(extra);
    for (const el of Array.from(gInk.children)) if (extraSet.has(el.getAttribute('data-k')!)) el.classList.add('extra');
    const missSet = new Set(missing);
    for (const el of Array.from(gTarget.children)) if (missSet.has(el.getAttribute('data-k')!)) el.classList.add('missing');
    if (!failure) failure = extra.length ? S.extra : hasEmptyRepeat(program) ? S.emptyRepeat : S.missing;
    ctx.mascot.say(`${failure} ${S.fix}`, 'sad', 6000);
    running = false;
    renderProgram(); // the drawing stays until the program is changed or run again
  }

  newPuzzle();
  return () => {
    alive = false;
    clearTimeout(clearTimer);
    stopResize();
  };
}

const game: GameModule = {
  id: 'turtle',
  order: 4.5,
  title: { en: 'Turtle Painter', sk: 'Kresliaca korytnačka' },
  tagline: { en: 'Program the turtle to draw a picture', sk: 'Naprogramuj korytnačku, nech nakreslí obrázok' },
  color: '#1FC2AE',
  icon: ICON,
  howTo: [
    { en: 'Look at the dotted picture.', sk: 'Pozri sa na bodkovaný obrázok.' },
    { en: 'Tap the blocks to build a program for the turtle.', sk: 'Ťukaj na bloky a poskladaj program pre korytnačku.' },
    { en: 'Press Start – the turtle draws a line wherever it walks.', sk: 'Stlač Štart – korytnačka kreslí čiaru všade, kade prejde.' },
    { en: 'Repeat does the blocks inside it again and again – it saves blocks!', sk: 'Opakuj urobí bloky vo vnútri znova a znova – ušetríš tak bloky!' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Simple shapes: forward and turn', sk: 'Jednoduché tvary: dopredu a otoč sa' } },
    { id: 'medium', description: { en: 'Repeat block, few blocks allowed', sk: 'Blok Opakuj a málo blokov' } },
    { id: 'hard', description: { en: 'Repeat inside repeat', sk: 'Opakovanie v opakovaní' } },
  ],
  mount,
};
export default game;
