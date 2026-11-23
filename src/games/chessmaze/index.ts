import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { attackMap, key, makePuzzle, reach, type Enemy, type GenCfg, type Piece, type Pt, type Puzzle } from './logic';
import './chessmaze.css';

/* ---------- pieces (inline SVG, sticker style) ---------- */

const pieceSvg = (type: Piece, fill: string, detail: string) => {
  const base = `<path d="M9 35.5h22v-5H9z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>`;
  const body: Record<Piece, string> = {
    R: `<path d="M12.5 30.5l1.5-14h12l1.5 14z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M11 16.5V7.5h4.5v3.5h2.7V7.5h3.6v3.5h2.7V7.5H29v9z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M15.5 21h9" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>`,
    B: `<path d="M13 30.5h14l-2-5h-10z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M15 25.5c-4-4-3.5-10 5-16 8.5 6 9 12 5 16z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="20" cy="6.5" r="2.8" fill="${fill}" stroke="#2B2440" stroke-width="2.4"/>
        <path d="M23 13.5l-4.5 5.5" stroke="${detail}" stroke-width="2.2" stroke-linecap="round"/>`,
    N: `<path d="M13 30.5c0-5.5 2.5-8 6.5-11.5-3 .5-5.5 1-7 3L9 18.5c1-4 4.5-9 9.5-11l1-3.5 2.5 3.5c6 1.5 9 7 9 13v10z" fill="${fill}" stroke="#2B2440" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="18" cy="12.5" r="1.6" fill="${detail}"/>
        <path d="M27 15c1 3 1 7 0 11" stroke="${detail}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8"/>`,
  };
  return `<svg viewBox="0 0 40 40">${body[type]}${base}</svg>`;
};
const PLAYER_SVG = (t: Piece) => pieceSvg(t, '#FFD23F', '#FF8A3D');
const ENEMY_SVG = (t: Piece) => pieceSvg(t, '#5B4E7A', '#C9BFE0');
const FLAG = `<svg viewBox="0 0 40 40"><ellipse cx="14" cy="35" rx="9" ry="3" fill="#2B2440" opacity=".2"/><path d="M13 35V6" stroke="#2B2440" stroke-width="3.5" stroke-linecap="round"/><path d="M14 6h19l-5 6 5 6H14z" fill="#4CC95B" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/></svg>`;
const EYE = `<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="#fff" stroke="#2B2440" stroke-width="2.2"/><circle cx="12" cy="12" r="3.5" fill="#2B2440"/></svg>`;
const RESTART = `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="#FFF3DC" stroke="#2B2440" stroke-width="4"/>
<path d="M8 8h12v12H8zM32 8h12v12H32zM20 20h12v12H20zM44 20h12v12H44zM8 32h12v12H8zM32 32h12v12H32zM20 44h12v12H20zM44 44h12v12H44z" fill="#F2C48D"/>
<path d="M38 48l9-9" stroke="#FF4D5E" stroke-width="3.5" stroke-linecap="round"/>
<g transform="translate(5 22) scale(.78)">${pieceSvg('N', '#FFD23F', '#FF8A3D').replace(/<\/?svg[^>]*>/g, '')}</g>
<path d="M44 10v14" stroke="#2B2440" stroke-width="2.6" stroke-linecap="round"/><path d="M45 10h9l-2.5 3.5L54 17h-9z" fill="#4CC95B" stroke="#2B2440" stroke-width="2.2" stroke-linejoin="round"/>
<rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#2B2440" stroke-width="4"/></svg>`;

/* ---------- difficulty ---------- */

interface Cfg extends GenCfg { puzzles: number; peeks: number }
const CFG: Record<LevelId, Cfg> = {
  easy: { size: 6, player: 'R', enemyTypes: ['B', 'R', 'B'], enemies: 3, minMoves: 3, maxMoves: 5, puzzles: 5, peeks: 3 },
  medium: { size: 7, player: 'B', enemyTypes: ['R', 'N', 'R', 'N'], enemies: 4, minMoves: 3, maxMoves: 6, puzzles: 5, peeks: 3 },
  hard: { size: 7, player: 'N', enemyTypes: ['R', 'B', 'N'], enemies: 3, minMoves: 3, maxMoves: 5, puzzles: 5, peeks: 3 },
};

/* ---------- texts ---------- */

const en = {
  name: { R: 'rook', B: 'bishop', N: 'knight' } as Record<Piece, string>,
  Name: { R: 'Rook', B: 'Bishop', N: 'Knight' } as Record<Piece, string>,
  how: {
    R: 'moves in straight lines: up, down, left, right.',
    B: 'moves diagonally, like an X.',
    N: 'jumps in an L: two squares, then one to the side.',
  } as Record<Piece, string>,
  intro: (p: Piece) => `Bring the ${en.name[p]} to the flag! Do not stop on a square an enemy piece guards.`,
  introKnight: 'Bring the knight to the flag! It jumps in an L shape. Avoid guarded squares!',
  yours: 'Your piece',
  enemies: 'Enemies',
  moves: (n: number) => `Moves: ${n}`,
  peek: (n: number) => `Danger (${n})`,
  peeked: 'The red squares are guarded. Find a way around them!',
  restart: 'Start over',
  restarted: 'Back to the start. Try another way!',
  guarded: (e: Piece) => `Careful! The ${en.name[e]} guards that square. A ${en.name[e]} ${en.how[e]}`,
  cantMove: (p: Piece) => `The ${en.name[p]} cannot go there. It ${en.how[p]}`,
  blocked: 'Pieces cannot jump over other pieces – only the knight can!',
  done: (p: string, moves: number, best: number) =>
    moves <= best ? `${p} Shortest way: ${moves} moves!` : `${p} You made it in ${moves} moves.`,
};
const sk: typeof en = {
  name: { R: 'veža', B: 'strelec', N: 'jazdec' },
  Name: { R: 'Veža', B: 'Strelec', N: 'Jazdec' },
  how: {
    R: 'chodí rovno: hore, dole, doľava, doprava.',
    B: 'chodí šikmo, ako písmeno X.',
    N: 'skáče do tvaru L: dve políčka a jedno nabok.',
  },
  intro: (p) => `Dostaň ${{ R: 'vežu', B: 'strelca', N: 'jazdca' }[p]} k vlajke! Nezastav na políčku, ktoré stráži nepriateľ.`,
  introKnight: 'Dostaň jazdca k vlajke! Skáče do tvaru L. Vyhni sa stráženým políčkam!',
  yours: 'Tvoja figúrka',
  enemies: 'Nepriatelia',
  moves: (n) => `Ťahy: ${n}`,
  peek: (n) => `Nebezpečie (${n})`,
  peeked: 'Červené políčka sú strážené. Nájdi cestu okolo nich!',
  restart: 'Znova',
  restarted: 'Späť na štart. Skús inú cestu!',
  guarded: (e) => `Pozor! To políčko stráži ${sk.name[e]}. ${sk.Name[e]} ${sk.how[e]}`,
  cantMove: (p) => `${sk.Name[p]} tam nemôže ísť. ${sk.Name[p]} ${sk.how[p]}`,
  blocked: 'Figúrky nemôžu preskakovať iné figúrky – to vie len jazdec!',
  done: (p, moves, best) =>
    moves <= best ? `${p} Najkratšia cesta: ${moves} ${moves < 5 ? 'ťahy' : 'ťahov'}!` : `${p} Hotovo za ${moves} ${moves < 5 ? 'ťahy' : 'ťahov'}.`,
};

/* ---------- game ---------- */

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const n = cfg.size;
  let alive = true;
  let solved = 0;
  let mistakes = 0;
  let peeksLeft = cfg.peeks;
  let busy = false;
  let moves = 0;
  let puzzle: Puzzle;
  let pos: Pt;
  let attacked = new Map<number, Enemy>();
  let blockers = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
    timers.add(t);
  };

  /* ----- DOM ----- */

  const squares: HTMLButtonElement[] = [];
  const board = h('div', { class: 'cm-board', style: { '--n': String(n) } });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sq = h('button', {
      class: `cm-sq ${(x + y) % 2 ? 'dark' : 'light'}`,
      onClick: () => tap({ x, y }),
    });
    squares.push(sq);
    board.append(sq);
  }
  const layer = h('div', { class: 'cm-layer' });
  const player = h('div', { class: 'cm-piece player', html: PLAYER_SVG(cfg.player) });
  board.append(layer, h('div', { class: 'cm-layer' }, player));
  const sqAt = (p: Pt) => squares[p.y * n + p.x];

  const movesEl = h('div', { class: 'cm-moves' });
  const peekBtn: HTMLButtonElement = h('button', { class: 'btn btn-warn', onClick: () => peek() });
  const restartBtn: HTMLButtonElement = h('button', { class: 'btn btn-alt', onClick: () => restart() });
  restartBtn.innerHTML = `${RESTART}<span>${S.restart}</span>`;
  const legend = h(
    'div',
    { class: 'cm-legend card' },
    h('div', { class: 'cm-legend-piece', html: PLAYER_SVG(cfg.player) }),
    h('div', { class: 'cm-legend-text' }, h('b', null, S.Name[cfg.player]), ' ', S.how[cfg.player]),
  );
  const enemyTypes = [...new Set(cfg.enemyTypes)];
  const enemyLegend = h(
    'div',
    { class: 'cm-enemies' },
    h('span', null, S.enemies),
    ...enemyTypes.map((t) => h('span', { class: 'cm-enemy-ico', title: S.Name[t], html: ENEMY_SVG(t) })),
  );
  const panel = h('div', { class: 'cm-panel' }, legend, enemyLegend, movesEl, h('div', { class: 'cm-actions' }, peekBtn, restartBtn));
  const wrap = h('div', { class: 'cm' }, board, panel);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    const size = vertical ? Math.min(w - 24, hgt * 0.62) : Math.min(hgt - 24, w * 0.6);
    board.style.width = board.style.height = `${Math.max(160, Math.floor(size))}px`;
  });

  /* ----- rendering ----- */

  const place = (el: HTMLElement, p: Pt) => {
    el.style.left = `${(p.x * 100) / n}%`;
    el.style.top = `${(p.y * 100) / n}%`;
  };

  function updatePanel() {
    movesEl.textContent = S.moves(moves);
    peekBtn.innerHTML = `${EYE}<span>${S.peek(peeksLeft)}</span>`;
    peekBtn.disabled = busy || peeksLeft <= 0 || board.classList.contains('peek');
    restartBtn.disabled = busy || moves === 0;
  }

  function showTargets() {
    const targets = new Set(busy ? [] : reach(n, cfg.player, pos, blockers).map(key));
    squares.forEach((sq, i) => sq.classList.toggle('target', targets.has(i % n + Math.floor(i / n) * 100)));
    updatePanel();
  }

  function newPuzzle() {
    puzzle = makePuzzle(cfg);
    attacked = attackMap(n, puzzle.enemies);
    blockers = new Set(puzzle.enemies.map(key));
    pos = puzzle.start;
    moves = 0;
    board.classList.remove('peek');
    squares.forEach((sq, i) => {
      const k = (i % n) + Math.floor(i / n) * 100;
      sq.classList.toggle('danger', attacked.has(k));
      sq.classList.remove('bad', 'goal', 'start');
    });
    sqAt(puzzle.goal).classList.add('goal');
    layer.replaceChildren();
    const flag = h('div', { class: 'cm-piece flag', html: FLAG });
    place(flag, puzzle.goal);
    layer.append(flag);
    for (const e of puzzle.enemies) {
      const el = h('div', { class: 'cm-piece enemy', html: ENEMY_SVG(e.type), 'data-k': String(key(e)) });
      place(el, e);
      layer.append(el);
    }
    player.style.transition = 'none';
    player.classList.remove('home');
    place(player, pos);
    void player.offsetWidth;
    player.style.transition = '';
    ctx.setProgress(solved, cfg.puzzles);
    showTargets();
  }

  function enemyEl(e: Enemy) {
    return layer.querySelector<HTMLElement>(`[data-k="${key(e)}"]`);
  }

  /* ----- interaction ----- */

  function tap(p: Pt) {
    if (busy || key(p) === key(pos)) return;
    if (blockers.has(key(p))) {
      ctx.sfx.tap();
      return;
    }
    const legal = reach(n, cfg.player, pos, blockers).some((q) => key(q) === key(p));
    if (!legal) {
      ctx.sfx.tap();
      replay(sqAt(p), 'shake');
      // Would the move be legal on an empty board? Then a piece is in the way.
      const inWay = reach(n, cfg.player, pos, new Set()).some((q) => key(q) === key(p));
      ctx.mascot.say(inWay ? S.blocked : S.cantMove(cfg.player), 'think', 4500);
      return;
    }
    const guard = attacked.get(key(p));
    if (guard) {
      mistakes++;
      ctx.sfx.wrong();
      const sq = sqAt(p);
      sq.classList.add('bad');
      replay(sq, 'shake');
      const g = enemyEl(guard);
      if (g) replay(g, 'alarm');
      ctx.mascot.say(S.guarded(guard.type), 'sad', 5000);
      later(() => sq.classList.remove('bad'), 1600);
      return;
    }
    // A safe move.
    moves++;
    pos = p;
    ctx.sfx.step();
    if (cfg.player === 'N') replay(player, 'jump');
    place(player, pos);
    if (key(pos) === key(puzzle.goal)) return void win();
    showTargets();
  }

  function win() {
    busy = true;
    showTargets();
    solved++;
    later(() => {
      player.classList.add('home');
      ctx.sfx.correct();
      ctx.celebrate('small');
      ctx.mascot.say(S.done(praise(), moves, puzzle.minMoves), 'cheer', 2500);
    }, 350);
    later(() => {
      busy = false;
      if (solved >= cfg.puzzles) {
        ctx.setProgress(solved, cfg.puzzles);
        ctx.finish({ stars: starsFromMistakes(mistakes, 1, 4) });
      } else newPuzzle();
    }, 2300);
  }

  function peek() {
    if (busy || peeksLeft <= 0) return;
    peeksLeft--;
    ctx.sfx.pop();
    board.classList.add('peek');
    ctx.mascot.say(S.peeked, 'think', 4000);
    updatePanel();
  }

  function restart() {
    if (busy || moves === 0) return;
    ctx.sfx.tap();
    pos = puzzle.start;
    moves = 0;
    place(player, pos);
    ctx.mascot.say(S.restarted, 'idle', 2500);
    showTargets();
  }

  newPuzzle();
  ctx.mascot.say(cfg.player === 'N' ? S.introKnight : S.intro(cfg.player), 'wave', 6500);

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    stopResize();
  };
}

const game: GameModule = {
  id: 'chessmaze',
  order: 5,
  title: { en: 'Chess Maze', sk: 'Šachové bludisko' },
  tagline: { en: 'Sneak past the guarded squares', sk: 'Prekĺzni pomedzi strážené políčka' },
  color: '#FF8A3D',
  icon: ICON,
  levels: [
    { id: 'easy', description: { en: 'Rook: straight lines', sk: 'Veža: chodí rovno' } },
    { id: 'medium', description: { en: 'Bishop: diagonal moves', sk: 'Strelec: chodí šikmo' } },
    { id: 'hard', description: { en: 'Knight: jumps in an L', sk: 'Jazdec: skáče do L' } },
  ],
  mount,
};
export default game;
