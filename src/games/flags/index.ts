import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, replay } from '../../platform/dom';
import { shuffle, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { COUNTRIES, FAMOUS, flagUrl, lookalikes, type Continent, type Country } from './countries';
import './flags.css';

const FLAG_OUTLINE = 'M16 11c8-4 14 4 22 0s12-2 16 0v24c-4-2-8-4-16 0s-14-4-22 0z';
const ICON = `<svg viewBox="0 0 64 64"><path d="M14 8v50" stroke="#2B2440" stroke-width="5" stroke-linecap="round"/><path d="${FLAG_OUTLINE}" fill="#FFD23F"/><path d="M16 19c8-4 14 4 22 0s12-2 16 0v8c-4-2-8-4-16 0s-14-4-22 0z" fill="#3DA5FF"/><path d="M16 27c8-4 14 4 22 0s12-2 16 0v8c-4-2-8-4-16 0s-14-4-22 0z" fill="#FF4D5E"/><path d="${FLAG_OUTLINE}" fill="none" stroke="#2B2440" stroke-width="4" stroke-linejoin="round"/></svg>`;

/** 'name' = a flag is shown, pick the country name. 'flag' = a name is shown, pick the flag. */
type Mode = 'name' | 'flag';
type Distractors = 'easy' | 'random' | 'tricky';

interface Cfg {
  rounds: number;
  choices: number;
  /** chance a round is "find the flag" instead of "which country" */
  flagChance: number;
  pool: (c: Country) => boolean;
  distractors: Distractors;
  /** mistakes allowed for 3 / 2 stars */
  stars: [number, number];
}

const CFG: Record<LevelId, Cfg> = {
  easy: { rounds: 10, choices: 3, flagChance: 0.2, pool: (c) => c.continent === 'eu', distractors: 'easy', stars: [1, 3] },
  medium: { rounds: 10, choices: 4, flagChance: 0.35, pool: (c) => FAMOUS.has(c.code), distractors: 'random', stars: [1, 3] },
  hard: { rounds: 12, choices: 4, flagChance: 0.5, pool: () => true, distractors: 'tricky', stars: [2, 4] },
};

const en = {
  whichCountry: 'Which country has this flag?',
  findFlag: 'Find the flag:',
  intro: 'Look at the flag. Which country is it?',
  introWorld: 'Flags from all over the world! Which country is it?',
  correct: (p: string, name: string) => `${p} ${name}!`,
  notThis: (name: string) => `That one is ${name}. Try again!`,
  continent: (where: string) => `Hint: the country is in ${where}.`,
  lookColours: 'Look carefully at the colours and the shapes.',
  where: { eu: 'Europe', as: 'Asia', af: 'Africa', na: 'North America', sa: 'South America', oc: 'Oceania' } as Record<Continent, string>,
};
const sk: typeof en = {
  whichCountry: 'Ktorej krajine patrí táto vlajka?',
  findFlag: 'Nájdi vlajku:',
  intro: 'Pozri sa na vlajku. Ktorá je to krajina?',
  introWorld: 'Vlajky z celého sveta! Ktorá je to krajina?',
  correct: (p, name) => `${p} ${name}!`,
  notThis: (name) => `To je ${name}. Skús to znova!`,
  continent: (where) => `Tip: tá krajina leží ${where}.`,
  lookColours: 'Pozri sa pozorne na farby a tvary.',
  where: { eu: 'v Európe', as: 'v Ázii', af: 'v Afrike', na: 'v Severnej Amerike', sa: 'v Južnej Amerike', oc: 'v Oceánii' },
};

function pickDistractors(target: Country, pool: Country[], n: number, kind: Distractors): Country[] {
  const others = shuffle(pool.filter((c) => c.code !== target.code));
  if (kind === 'random') return others.slice(0, n);
  const look = lookalikes(target.code);
  if (kind === 'easy') {
    // avoid flags that look alike – both with the target and with each other
    const out: Country[] = [];
    for (const c of others) {
      if (out.length >= n) break;
      if (look.has(c.code) || out.some((o) => lookalikes(o.code).has(c.code))) continue;
      out.push(c);
    }
    return out.length === n ? out : others.slice(0, n);
  }
  // tricky: up to 2 lookalikes, then the same continent, then anything
  const similar = others.filter((c) => look.has(c.code)).slice(0, 2);
  const near = others.filter((c) => c.continent === target.continent && !similar.includes(c));
  const rest = others.filter((c) => !similar.includes(c) && !near.includes(c));
  return [...similar, ...near, ...rest].slice(0, n);
}

/** Resolves once all images are loaded (or failed), so a round never appears half-drawn. */
function preload(codes: string[]): Promise<void> {
  return Promise.all(
    codes.map((code) => new Promise<void>((res) => {
      const img = new Image();
      img.onload = img.onerror = () => res();
      img.src = flagUrl(code);
    })),
  ).then(() => undefined);
}

const flagImg = (c: Country, cls: string) =>
  h('img', { class: cls, src: flagUrl(c.code), alt: '', draggable: 'false' });

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const name = (c: Country) => (ctx.lang === 'sk' ? c.sk : c.en);
  const pool = COUNTRIES.filter(cfg.pool);
  const targets = shuffle(pool).slice(0, cfg.rounds);
  // at least two "find the flag" rounds on medium/hard; the first round is always "which country"
  const modes: Mode[] = targets.map(() => (Math.random() < cfg.flagChance ? 'flag' : 'name'));
  if (ctx.level !== 'easy') {
    while (modes.filter((m) => m === 'flag').length < 2) modes[1 + Math.floor(Math.random() * (modes.length - 1))] = 'flag';
  }
  modes[0] = 'name';

  let alive = true;
  let round = 0;
  let mistakes = 0;
  let roundMistakes = 0;
  let locked = false;
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);

  const root = h('div', { class: 'flg' });
  stage.append(root);

  async function next() {
    if (round >= cfg.rounds) {
      ctx.finish({ stars: starsFromMistakes(mistakes, cfg.stars[0], cfg.stars[1]) });
      return;
    }
    ctx.setProgress(round, cfg.rounds);
    const target = targets[round];
    const mode = modes[round];
    const options = shuffle([target, ...pickDistractors(target, pool, cfg.choices - 1, cfg.distractors)]);
    await preload(mode === 'flag' ? options.map((c) => c.code) : [target.code]);
    if (!alive) return;
    roundMistakes = 0;
    locked = false;
    if (mode === 'name') renderName(target, options);
    else renderFlag(target, options);
  }

  function renderName(target: Country, options: Country[]) {
    const buttons = options.map((c) => {
      const b: HTMLButtonElement = h('button', {
        class: 'btn flg-opt',
        onClick: () => (c === target ? onCorrect(b, target) : onWrong(b, c, target, 'name')),
      }, h('span', { class: 'flg-opt-text' }, name(c)));
      return b;
    });
    root.className = 'flg mode-name';
    root.replaceChildren(
      h('div', { class: 'flg-show' }, h('div', { class: 'flg-frame' }, flagImg(target, 'flg-img'))),
      h('div', { class: 'flg-panel' },
        h('div', { class: 'flg-q' }, S.whichCountry),
        h('div', { class: `flg-options n${options.length}` }, ...buttons),
      ),
    );
  }

  function renderFlag(target: Country, options: Country[]) {
    const buttons = options.map((c) => {
      const b: HTMLButtonElement = h('button', {
        class: 'flg-pick',
        onClick: () => (c === target ? onCorrect(b, target) : onWrong(b, c, target, 'flag')),
      }, flagImg(c, 'flg-img'), h('span', { class: 'flg-pick-label' }, name(c)));
      return b;
    });
    root.className = 'flg mode-flag';
    root.replaceChildren(
      h('div', { class: 'flg-head' },
        h('div', { class: 'flg-q' }, S.findFlag),
        h('div', { class: 'flg-name' }, name(target)),
      ),
      h('div', { class: `flg-grid n${options.length}` }, ...buttons),
    );
  }

  function onCorrect(btn: HTMLButtonElement, target: Country) {
    if (locked) return;
    locked = true;
    btn.classList.add('right');
    root.querySelectorAll('button').forEach((b) => (b.disabled = true));
    replay(btn, 'pop');
    ctx.sfx.correct();
    ctx.celebrate('small');
    ctx.mascot.say(S.correct(praise(), name(target)), 'happy', 2000);
    round++;
    later(next, 1500);
  }

  function onWrong(btn: HTMLButtonElement, chosen: Country, target: Country, mode: Mode) {
    if (locked) return;
    mistakes++;
    roundMistakes++;
    ctx.sfx.wrong();
    btn.disabled = true;
    btn.classList.add('wrong');
    // show what the wrong answer really is: its flag (name mode) or its name (flag mode)
    if (mode === 'name') btn.prepend(flagImg(chosen, 'flg-mini'));
    replay(btn, 'shake');
    const msg = roundMistakes >= 2
      ? (ctx.level === 'easy' ? S.lookColours : S.continent(S.where[target.continent]))
      : S.notThis(name(chosen));
    ctx.mascot.say(msg, 'think', 4000);
  }

  ctx.mascot.say(ctx.level === 'easy' ? S.intro : S.introWorld, 'wave', 4000);
  void next();
  return () => { alive = false; };
}

const game: GameModule = {
  id: 'flags',
  order: 6,
  title: { en: 'World Flags', sk: 'Vlajky sveta' },
  tagline: { en: 'Which country is it?', sk: 'Ktorá je to krajina?' },
  color: '#3DA5FF',
  icon: ICON,
  howTo: [
    { en: 'Look at the flag and tap the country it belongs to.', sk: 'Pozri sa na vlajku a ťukni na krajinu, ktorej patrí.' },
    { en: "Sometimes it's the other way round: find the flag for a country name.", sk: 'Niekedy naopak: k názvu krajiny nájdi správnu vlajku.' },
    { en: 'Wrong? Huhu shows whose flag it really is and gives a hint.', sk: 'Chyba? Sovička ukáže, čia je to naozaj vlajka, a poradí.' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Europe, 3 choices', sk: 'Európa, 3 možnosti' } },
    { id: 'medium', description: { en: 'Well-known flags of the world', sk: 'Známe vlajky sveta' } },
    { id: 'hard', description: { en: 'All countries, tricky look-alikes', sk: 'Všetky krajiny, podobné vlajky' } },
  ],
  mount,
};
export default game;
