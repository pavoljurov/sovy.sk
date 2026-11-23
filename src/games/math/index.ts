import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, replay } from '../../platform/dom';
import { pick, randInt, shuffle, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import './math.css';

const ICON = `<svg viewBox="0 0 64 64"><ellipse cx="22" cy="24" rx="14" ry="16" fill="#FF5D8F" stroke="#2B2440" stroke-width="4"/><ellipse cx="42" cy="28" rx="14" ry="16" fill="#FFD23F" stroke="#2B2440" stroke-width="4"/><path d="M22 40c0 8 6 10 6 18M42 44c0 6-4 8-4 14" stroke="#2B2440" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M16 24h12M22 18v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M36 28h12" stroke="#2B2440" stroke-width="4" stroke-linecap="round"/></svg>`;

interface Cfg {
  max: number;
  /** draw counting dots under the numbers */
  dots: boolean;
  /** chance of a "missing number" question (7 + ? = 12) */
  missing: number;
  minA: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { max: 10, dots: true, missing: 0, minA: 1 },
  medium: { max: 20, dots: false, missing: 0.2, minA: 3 },
  hard: { max: 50, dots: false, missing: 0.4, minA: 8 },
};
const TOTAL = 10;

const en = {
  intro: 'Pop the balloon with the right answer!',
  streak: (n: number) => `★ ${n} in a row!`,
  onFire: (n: number) => `${n} in a row! You're on fire!`,
  hintDots: 'Count the dots! You can do it!',
  hintMissing: 'Which number makes both sides equal? Try each one!',
  hintPlus: (a: number, b: number) => `Start at ${a} and count up ${b}.`,
  hintMinus: (a: number, b: number) => `Start at ${a} and count back ${b}.`,
};
const sk: typeof en = {
  intro: 'Praskni balónik so správnou odpoveďou!',
  streak: (n) => `★ ${n} za sebou!`,
  onFire: (n) => `${n} správne za sebou! Ide ti to ako po masle!`,
  hintDots: 'Spočítaj bodky! Zvládneš to!',
  hintMissing: 'Ktoré číslo sa sem hodí, aby to platilo? Skús každé!',
  hintPlus: (a, b) => `Začni na čísle ${a} a pripočítaj ${b}.`,
  hintMinus: (a, b) => `Začni na čísle ${a} a odpočítaj ${b}.`,
};
const BALLOON_COLORS = ['#FF5D8F', '#3DA5FF', '#FFD23F', '#4CC95B'];

type Op = '+' | '-';
interface Q { a: number; b: number; c: number; op: Op; hide: 'a' | 'b' | 'c' }

function makeQuestion(cfg: Cfg): Q {
  const op: Op = Math.random() < 0.5 ? '+' : '-';
  let a: number, b: number, c: number;
  if (op === '+') {
    a = randInt(cfg.minA, cfg.max - 1);
    b = randInt(1, cfg.max - a);
    c = a + b;
  } else {
    a = randInt(Math.max(2, cfg.minA), cfg.max);
    b = randInt(1, a - 1);
    c = a - b;
  }
  const hide = Math.random() < cfg.missing ? pick(['a', 'b'] as const) : 'c';
  return { a, b, c, op, hide };
}

function options(answer: number, max: number): number[] {
  const near = shuffle([answer + 1, answer - 1, answer + 2, answer - 2]);
  const far = max > 20 ? shuffle([answer + 10, answer - 10]) : [];
  const pool = [...far.slice(0, 1), ...near, answer + 3, answer - 3].filter((n) => n >= 0 && n <= max && n !== answer);
  const picked = [...new Set(pool)].slice(0, 3);
  while (picked.length < 3) {
    const r = randInt(0, max);
    if (r !== answer && !picked.includes(r)) picked.push(r);
  }
  return shuffle([answer, ...picked]);
}

function dots(q: Q): HTMLElement {
  const group = (n: number, cls: string, crossFrom = Infinity) =>
    h('div', { class: 'm-dots' }, Array.from({ length: n }, (_, i) => h('i', { class: `${cls} ${i >= crossFrom ? 'gone' : ''}` })));
  return q.op === '+'
    ? h('div', { class: 'm-visual' }, group(q.a, 'd1'), h('span', null, '+'), group(q.b, 'd2'))
    : h('div', { class: 'm-visual' }, group(q.a, 'd1', q.a - q.b));
}

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const equation = h('div', { class: 'm-eq' });
  const visual = h('div', { class: 'm-visual-wrap' });
  const streakEl = h('div', { class: 'm-streak' });
  const sky = h('div', { class: 'm-sky' });
  stage.append(h('div', { class: 'm-wrap' }, h('div', { class: 'm-top' }, equation, visual, streakEl), sky));

  let n = 0, mistakes = 0, streak = 0, alive = true;
  let prev = '';
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);

  function next() {
    if (n >= TOTAL) return ctx.finish({ stars: starsFromMistakes(mistakes, 1, 3) });
    ctx.setProgress(n, TOTAL);
    let q: Q;
    do q = makeQuestion(cfg);
    while (`${q.a}${q.op}${q.b}` === prev);
    prev = `${q.a}${q.op}${q.b}`;
    const answer = q[q.hide];

    const slot = (key: 'a' | 'b' | 'c') =>
      q.hide === key ? h('span', { class: 'm-num m-hole' }, '?') : h('span', { class: 'm-num' }, String(q[key]));
    equation.replaceChildren(slot('a'), h('span', { class: 'm-op' }, q.op === '+' ? '+' : '−'), slot('b'), h('span', { class: 'm-op' }, '='), slot('c'));
    replay(equation, 'pop');
    visual.replaceChildren(cfg.dots && q.hide === 'c' ? dots(q) : '');

    let wrongHere = 0;
    const balloons = options(answer, cfg.max).map((v, i) => {
      const b: HTMLButtonElement = h(
        'button',
        {
          class: 'm-balloon',
          style: { '--bc': BALLOON_COLORS[i], '--delay': `${-i * 0.7}s`, '--sway': `${randInt(2, 4)}s` },
          onClick: () => {
            if (b.disabled) return;
            if (v === answer) {
              balloons.forEach((x) => (x.disabled = true));
              b.classList.add('popped');
              equation.querySelector('.m-hole')!.textContent = String(answer);
              equation.querySelector('.m-hole')!.classList.add('solved');
              ctx.sfx.pop();
              ctx.sfx.correct();
              ctx.celebrate('small');
              if (wrongHere === 0) streak++;
              streakEl.textContent = streak >= 2 ? S.streak(streak) : '';
              ctx.mascot.say(streak >= 3 && streak % 3 === 0 ? S.onFire(streak) : praise(), 'happy', 1800);
              n++;
              later(next, 1300);
            } else {
              mistakes++;
              wrongHere++;
              streak = 0;
              streakEl.textContent = '';
              b.disabled = true;
              b.classList.add('wrong');
              ctx.sfx.wrong();
              ctx.mascot.say(hintFor(q), 'think', 4000);
            }
          },
        },
        h('span', null, String(v)),
      );
      return b;
    });
    sky.replaceChildren(...balloons);
  }

  function hintFor(q: Q): string {
    if (cfg.dots) return S.hintDots;
    if (q.hide !== 'c') return S.hintMissing;
    if (q.op === '+') return S.hintPlus(Math.max(q.a, q.b), Math.min(q.a, q.b));
    return S.hintMinus(q.a, q.b);
  }

  ctx.mascot.say(S.intro, 'wave', 3500);
  next();
  return () => {
    alive = false;
  };
}

const game: GameModule = {
  id: 'math',
  order: 2,
  title: { en: 'Math Balloons', sk: 'Počtové balóny' },
  tagline: { en: 'Plus and minus – pop the answer!', sk: 'Plus a mínus – praskni správny balón!' },
  color: '#FF5D8F',
  icon: ICON,
  levels: [
    { id: 'easy', description: { en: 'Numbers up to 10, with dots to count', sk: 'Čísla do 10 s bodkami na počítanie' } },
    { id: 'medium', description: { en: 'Numbers up to 20', sk: 'Čísla do 20' } },
    { id: 'hard', description: { en: 'Up to 50 and missing numbers', sk: 'Do 50 a chýbajúce čísla' } },
  ],
  mount,
};
export default game;
