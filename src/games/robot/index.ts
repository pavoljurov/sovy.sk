import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { pick, randInt, shuffle, sleep, starsFromMistakes } from '../../platform/util';
import { MASCOT_NAME, praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { mascotSvg } from '../../platform/mascot';
import './robot.css';

const ICON = `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="#fff" stroke="#2B2440" stroke-width="4"/><path d="M19 6v52M32 6v52M45 6v52M6 19h52M6 32h52M6 45h52" stroke="#2B2440" stroke-width="1.5" opacity=".35"/><path d="M12 51V38h13V25h13" stroke="#FF8A3D" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 7"/><path d="M44 12v16" stroke="#2B2440" stroke-width="3" stroke-linecap="round"/><path d="M44 12h10l-3 4 3 4H44z" fill="#FF5D8F" stroke="#2B2440" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

/** 0 = up, 1 = right, 2 = down, 3 = left */
type Dir = 0 | 1 | 2 | 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
type Cmd = 'U' | 'R' | 'D' | 'L' | 'F' | 'TL' | 'TR';
const ABS_DIR: Partial<Record<Cmd, Dir>> = { U: 0, R: 1, D: 2, L: 3 };

interface Cfg {
  size: number;
  rocks: number;
  batteries: number;
  /** true = forward / turn left / turn right instead of compass arrows */
  relative: boolean;
  minDist: number;
  maxCmds: number;
  puzzles: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { size: 5, rocks: 4, batteries: 0, relative: false, minDist: 4, maxCmds: 12, puzzles: 5 },
  medium: { size: 6, rocks: 7, batteries: 2, relative: false, minDist: 4, maxCmds: 18, puzzles: 5 },
  hard: { size: 6, rocks: 6, batteries: 1, relative: true, minDist: 3, maxCmds: 24, puzzles: 5 },
};

interface Pt { x: number; y: number }
interface Puzzle { start: Pt; dir: Dir; goal: Pt; rocks: Pt[]; batteries: Pt[] }

const key = (p: Pt) => `${p.x},${p.y}`;

function bfs(size: number, from: Pt, blocked: Set<string>): Map<string, number> {
  const dist = new Map([[key(from), 0]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (let d = 0; d < 4; d++) {
      const q = { x: p.x + DX[d], y: p.y + DY[d] };
      if (q.x < 0 || q.y < 0 || q.x >= size || q.y >= size || blocked.has(key(q)) || dist.has(key(q))) continue;
      dist.set(key(q), dist.get(key(p))! + 1);
      queue.push(q);
    }
  }
  return dist;
}

function makePuzzle(cfg: Cfg): Puzzle {
  const all: Pt[] = [];
  for (let y = 0; y < cfg.size; y++) for (let x = 0; x < cfg.size; x++) all.push({ x, y });
  for (let attempt = 0; attempt < 500; attempt++) {
    const cells = shuffle(all);
    const start = cells[0];
    const rocks = cells.slice(1, 1 + cfg.rocks);
    const blocked = new Set(rocks.map(key));
    const dist = bfs(cfg.size, start, blocked);
    const free = cells.slice(1 + cfg.rocks).filter((p) => dist.has(key(p)));
    const goals = free.filter((p) => dist.get(key(p))! >= cfg.minDist && dist.get(key(p))! <= cfg.minDist + 3);
    if (!goals.length) continue;
    const goal = pick(goals);
    const batteries = shuffle(free.filter((p) => key(p) !== key(goal) && dist.get(key(p))! >= 2)).slice(0, cfg.batteries);
    if (batteries.length < cfg.batteries) continue;
    // Estimate the shortest program (start → batteries → goal) and make sure it fits.
    let best = Infinity;
    const orders = cfg.batteries === 2 ? [[0, 1], [1, 0]] : [[...batteries.keys()]];
    for (const order of orders) {
      const stops = [start, ...order.map((i) => batteries[i]), goal];
      let len = 0;
      for (let i = 0; i < stops.length - 1; i++) len += bfs(cfg.size, stops[i], blocked).get(key(stops[i + 1])) ?? Infinity;
      best = Math.min(best, len);
    }
    const estimate = cfg.relative ? Math.ceil(best * 1.6) + 1 : best;
    if (estimate > cfg.maxCmds - 2) continue;
    return { start, dir: randInt(0, 3) as Dir, goal, rocks, batteries };
  }
  return { start: { x: 0, y: 0 }, dir: 1, goal: { x: cfg.size - 1, y: cfg.size - 1 }, rocks: [], batteries: [] };
}

/* ---------- icons ---------- */

const arrow = (rot: number) =>
  `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)"><path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const turn = (flip: boolean) =>
  `<svg viewBox="0 0 24 24" style="${flip ? 'transform:scaleX(-1)' : ''}"><path d="M20 21v-7a5 5 0 0 0-5-5H9V4L2 10.5 9 17v-4h6a1 1 0 0 1 1 1v7z" fill="currentColor" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const CMD_ICON: Record<Cmd, string> = { U: arrow(0), R: arrow(90), D: arrow(180), L: arrow(270), F: arrow(0), TL: turn(false), TR: turn(true) };
const en = {
  cmd: { U: 'Up', R: 'Right', D: 'Down', L: 'Left', F: 'Forward', TL: 'Turn left', TR: 'Turn right' } as Record<Cmd, string>,
  remove: (c: string) => `Remove ${c}`,
  empty: 'Your program goes here',
  undo: '⌫ Undo',
  clear: '✕ Clear',
  go: '▶ Go!',
  introRelative: 'Program me! I only go where my arrow points. Turn me, then go forward!',
  introBatteries: 'Collect all batteries, then go to the flag! Tap the arrows, then Go!',
  intro: 'Help me reach the flag! Tap the arrows, then press Go!',
  needProgram: 'Tap the arrows to tell me where to go!',
  works: (p: string) => `${p} Your program works!`,
  edge: 'Bonk! That is the edge of the board.',
  rock: 'Bonk! There is a rock!',
  needBatteries: 'I need all the batteries first!',
  checkArrow: 'I am not at the flag yet. Check which way my arrow points!',
  moreSteps: 'I am not at the flag yet. Add more steps!',
  fix: 'Fix the program and try again.',
};
const sk: typeof en = {
  cmd: { U: 'Hore', R: 'Doprava', D: 'Dole', L: 'Doľava', F: 'Dopredu', TL: 'Otoč sa doľava', TR: 'Otoč sa doprava' },
  remove: (c) => `Odstrániť: ${c}`,
  empty: 'Sem príde tvoj program',
  undo: '⌫ Späť',
  clear: '✕ Zmazať',
  go: '▶ Štart!',
  introRelative: 'Naprogramuj ma! Idem len tam, kam ukazuje moja šípka. Otoč ma a potom choď dopredu!',
  introBatteries: 'Pozbieraj všetky batérie a potom choď k vlajke! Ťukaj na šípky a stlač Štart!',
  intro: 'Pomôž mi dostať sa k vlajke! Ťukaj na šípky a potom stlač Štart!',
  needProgram: 'Ťukni na šípky a povedz mi, kam mám ísť!',
  works: (p) => `${p} Tvoj program funguje!`,
  edge: 'Bum! Tu je okraj plochy.',
  rock: 'Bum! Tu je kameň!',
  needBatteries: 'Najprv potrebujem všetky batérie!',
  checkArrow: 'Ešte nie som pri vlajke. Pozri, kam ukazuje moja šípka!',
  moreSteps: 'Ešte nie som pri vlajke. Pridaj ďalšie kroky!',
  fix: 'Oprav program a skús to znova.',
};

const ROCK = `<svg viewBox="0 0 40 40"><path d="M6 30c-2-8 3-17 11-19 6-2 12 0 15 5 4 6 3 12 0 15-5 3-21 4-26-1z" fill="#A89FB8" stroke="#2B2440" stroke-width="3"/><path d="M13 18c3-3 7-3 9-2" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/></svg>`;
const FLAG = `<svg viewBox="0 0 40 40"><ellipse cx="14" cy="35" rx="9" ry="3" fill="#2B2440" opacity=".2"/><path d="M13 35V6" stroke="#2B2440" stroke-width="3.5" stroke-linecap="round"/><path d="M14 6h19l-5 6 5 6H14z" fill="#FF5D8F" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/></svg>`;
const BATTERY = `<svg viewBox="0 0 40 40"><rect x="10" y="7" width="20" height="29" rx="4" fill="#4CC95B" stroke="#2B2440" stroke-width="3"/><rect x="16" y="3" width="8" height="5" rx="1.5" fill="#2B2440"/><path d="M22 12l-6 10h5l-3 9 7-11h-5z" fill="#FFD23F" stroke="#2B2440" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

/* ---------- game ---------- */

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const CMD_LABEL = S.cmd;
  let alive = true;
  let solved = 0;
  let failedRuns = 0;
  let running = false;
  let program: Cmd[] = [];
  let puzzle: Puzzle;

  const board = h('div', { class: 'rb-board', style: { '--n': String(cfg.size) } });
  const layer = h('div', { class: 'rb-layer' });
  const robotFace = h('div', { class: 'rb-robot-face', html: mascotSvg() });
  const robotArrow = h('div', { class: 'rb-robot-arrow', html: arrow(0) });
  const robot = h('div', { class: 'rb-robot' }, h('div', { class: 'rb-robot-inner' }, robotArrow, robotFace));
  for (let i = 0; i < cfg.size * cfg.size; i++) board.append(h('div', { class: 'rb-tile' }));
  board.append(layer, h('div', { class: 'rb-layer' }, robot));

  const programEl = h('div', { class: 'rb-program' });
  const counter = h('div', { class: 'rb-counter' });
  const cmdButtons: HTMLButtonElement[] = [];
  const cmdBtn = (c: Cmd, cls = '') => {
    const b = h('button', { class: `btn rb-cmd ${cls}`, 'aria-label': CMD_LABEL[c], html: CMD_ICON[c], onClick: () => add(c) });
    cmdButtons.push(b);
    return b;
  };
  const pad = cfg.relative
    ? h('div', { class: 'rb-pad rel' }, cmdBtn('TL', 'turn'), cmdBtn('F', 'fwd'), cmdBtn('TR', 'turn'))
    : h('div', { class: 'rb-pad abs' }, h('i'), cmdBtn('U'), h('i'), cmdBtn('L'), cmdBtn('D'), cmdBtn('R'));
  const undoBtn = h('button', { class: 'btn btn-warn', onClick: () => edit(() => program.pop()) }, S.undo);
  const clearBtn = h('button', { class: 'btn btn-alt', onClick: () => edit(() => (program = [])) }, S.clear);
  const runBtn = h('button', { class: 'btn btn-big btn-go rb-run', onClick: () => void run() }, S.go);
  const panel = h(
    'div',
    { class: 'rb-panel' },
    h('div', { class: 'rb-program-box' }, programEl, counter),
    pad,
    h('div', { class: 'rb-actions' }, undoBtn, clearBtn, runBtn),
  );
  const wrap = h('div', { class: 'rb' }, board, panel);
  stage.append(wrap);

  const stopResize = onResize(stage, (w, hgt) => {
    const vertical = hgt > w * 1.05;
    wrap.classList.toggle('vertical', vertical);
    const size = vertical ? Math.min(w - 24, hgt * 0.55) : Math.min(hgt - 24, w * 0.55);
    board.style.width = board.style.height = `${Math.max(150, Math.floor(size))}px`;
  });

  /* ----- rendering ----- */

  const place = (el: HTMLElement, p: Pt) => {
    el.style.left = `${(p.x * 100) / cfg.size}%`;
    el.style.top = `${(p.y * 100) / cfg.size}%`;
  };
  let batteryEls: HTMLElement[] = [];

  function setRobot(p: Pt, dir: Dir) {
    place(robot, p);
    robotArrow.style.transform = `rotate(${dir * 90}deg)`;
    robotFace.classList.toggle('flip', dir === 3);
  }

  function resetBoard() {
    setRobot(puzzle.start, puzzle.dir);
    batteryEls.forEach((b) => b.classList.remove('got'));
    robot.classList.remove('home');
  }

  function newPuzzle() {
    puzzle = makePuzzle(cfg);
    program = [];
    layer.replaceChildren();
    const item = (p: Pt, cls: string, svg: string) => {
      const el = h('div', { class: `rb-item ${cls}`, html: svg });
      place(el, p);
      layer.append(el);
      return el;
    };
    puzzle.rocks.forEach((r) => item(r, 'rock', ROCK));
    item(puzzle.goal, 'goal', FLAG);
    batteryEls = puzzle.batteries.map((b) => item(b, 'battery', BATTERY));
    robot.style.transition = 'none';
    resetBoard();
    void robot.offsetWidth;
    robot.style.transition = '';
    renderProgram();
    ctx.setProgress(solved, cfg.puzzles);
    if (solved === 0) {
      ctx.mascot.say(
        cfg.relative ? S.introRelative : cfg.batteries ? S.introBatteries : S.intro,
        'wave',
        6500,
      );
    }
  }

  function renderProgram(active = -1) {
    programEl.replaceChildren(
      ...program.map((c, i) =>
        h('button', {
          class: `rb-chip ${c === 'TL' || c === 'TR' ? 'turn' : ''} ${i === active ? 'active' : ''} ${i < active ? 'done' : ''}`,
          html: CMD_ICON[c],
          'aria-label': S.remove(CMD_LABEL[c]),
          onClick: () => edit(() => program.splice(i, 1)),
        }),
      ),
    );
    if (!program.length) programEl.append(h('span', { class: 'rb-empty' }, S.empty));
    counter.textContent = `${program.length} / ${cfg.maxCmds}`;
    const full = program.length >= cfg.maxCmds;
    cmdButtons.forEach((b) => (b.disabled = running || full));
    [undoBtn, clearBtn].forEach((b) => (b.disabled = running || !program.length));
    runBtn.disabled = running;
    programEl.scrollLeft = programEl.scrollWidth;
  }

  function add(c: Cmd) {
    if (running || program.length >= cfg.maxCmds) return;
    ctx.sfx.tap();
    program.push(c);
    resetBoard();
    renderProgram();
  }

  function edit(fn: () => void) {
    if (running) return;
    ctx.sfx.tap();
    fn();
    resetBoard();
    renderProgram();
  }

  /* ----- running the program ----- */

  async function run() {
    if (running) return;
    if (!program.length) {
      ctx.mascot.say(S.needProgram, 'think', 3000);
      return;
    }
    running = true;
    resetBoard();
    renderProgram(0);
    await sleep(250);

    let pos = { ...puzzle.start };
    let dir = puzzle.dir;
    const got = new Set<number>();
    let failure: string | null = null;

    for (let i = 0; i < program.length && alive; i++) {
      renderProgram(i);
      const c = program[i];
      if (c === 'TL' || c === 'TR') {
        dir = ((dir + (c === 'TL' ? 3 : 1)) % 4) as Dir;
        setRobot(pos, dir);
        ctx.sfx.step();
        await sleep(380);
        continue;
      }
      if (ABS_DIR[c] !== undefined) dir = ABS_DIR[c]!;
      const next = { x: pos.x + DX[dir], y: pos.y + DY[dir] };
      const outside = next.x < 0 || next.y < 0 || next.x >= cfg.size || next.y >= cfg.size;
      const rock = puzzle.rocks.some((r) => key(r) === key(next));
      if (outside || rock) {
        setRobot(pos, dir);
        robot.style.setProperty('--bx', String(DX[dir]));
        robot.style.setProperty('--by', String(DY[dir]));
        replay(robot, 'bump');
        failure = outside ? S.edge : S.rock;
        break;
      }
      pos = next;
      setRobot(pos, dir);
      ctx.sfx.step();
      await sleep(400);
      puzzle.batteries.forEach((b, bi) => {
        if (key(b) === key(pos) && !got.has(bi)) {
          got.add(bi);
          batteryEls[bi].classList.add('got');
          ctx.sfx.pop();
        }
      });
    }
    if (!alive) return;
    renderProgram(program.length);

    const atGoal = key(pos) === key(puzzle.goal);
    if (!failure && atGoal && got.size === puzzle.batteries.length) {
      robot.classList.add('home');
      solved++;
      ctx.sfx.correct();
      ctx.celebrate('small');
      ctx.mascot.say(S.works(praise()), 'cheer', 2500);
      await sleep(1700);
      if (!alive) return;
      running = false;
      if (solved >= cfg.puzzles) {
        ctx.setProgress(solved, cfg.puzzles);
        ctx.finish({ stars: starsFromMistakes(failedRuns, 1, 4) });
      } else newPuzzle();
      return;
    }

    failedRuns++;
    ctx.sfx.wrong();
    if (!failure) {
      failure = atGoal
        ? S.needBatteries
        : cfg.relative && program.some((c) => c === 'TL' || c === 'TR')
          ? S.checkArrow
          : S.moreSteps;
    }
    ctx.mascot.say(`${failure} ${S.fix}`, 'sad', 5000);
    await sleep(1400);
    if (!alive) return;
    running = false;
    resetBoard();
    renderProgram();
  }

  newPuzzle();
  return () => {
    alive = false;
    stopResize();
  };
}

const game: GameModule = {
  id: 'robot',
  order: 4,
  title: { en: 'Robot Path', sk: 'Robotí chodník' },
  tagline: { en: `Program ${MASCOT_NAME} to reach the flag`, sk: `Naprogramuj ${MASCOT_NAME} cestu k vlajke` },
  color: '#7B5CFF',
  icon: ICON,
  levels: [
    { id: 'easy', description: { en: 'Small 5×5 board, arrow steps', sk: 'Malá plocha 5×5, kroky šípkami' } },
    { id: 'medium', description: { en: 'Collect batteries on the way', sk: 'Po ceste pozbieraj batérie' } },
    { id: 'hard', description: { en: 'Real robot moves: forward and turn', sk: 'Ako skutočný robot: dopredu a otočiť sa' } },
  ],
  mount,
};
export default game;
