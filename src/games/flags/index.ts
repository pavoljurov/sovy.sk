import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { shuffle, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { ICONS } from '../../platform/icons';
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

/** Multiplayer: once the first player has answered, the others have this long. */
const ANSWER_MS = 10000;

/** Player colours (lane accent + light lane background, no color-mix for old browsers). */
const PLAYER_COLORS = [
  { color: '#FF4D5E', tint: '#FFE6E8' },
  { color: '#3DA5FF', tint: '#E1F1FF' },
  { color: '#4CC95B', tint: '#E4F7E6' },
  { color: '#FFD23F', tint: '#FFF6D1' },
];

const en = {
  howMany: 'How many players?',
  hello: 'Play alone or race your friends – up to 4 players!',
  players: (n: number) => (n === 1 ? '1 player' : `${n} players`),
  rules: 'Right answer = 1 point. Fastest right answer = 2 points!',
  player: (i: number) => `Player ${i}`,
  introMulti: 'Everyone taps in their own colour column. Be quick and right!',
  hurry: 'Quick, the time is running!',
  fastest: (p: string) => `${p} was the fastest!`,
  everyone: 'Everyone got it right!',
  nobody: 'Nobody got it this time.',
  itIs: (name: string) => `It is ${name}.`,
  next: 'Next',
  results: 'Results',
  points: (n: number) => (n === 1 ? '1 point' : `${n} points`),
  winner: (p: string, pts: string) => `${p} wins with ${pts}!`,
  tie: (ps: string, pts: string) => `It’s a tie! ${ps}: ${pts}.`,
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
  howMany: 'Koľko hráčov hrá?',
  hello: 'Hrať sa dá aj s kamarátmi – až 4 hráči!',
  players: (n) => (n === 1 ? '1 hráč' : `${n} hráči`),
  rules: 'Správna odpoveď = 1 bod. Najrýchlejšia správna = 2 body!',
  player: (i) => `Hráč ${i}`,
  introMulti: 'Každý ťuká vo svojom farebnom stĺpci. Rýchlo a správne!',
  hurry: 'Rýchlo, čas beží!',
  fastest: (p) => `${p} – najrýchlejšia odpoveď!`,
  everyone: 'Všetci správne!',
  nobody: 'Tentoraz bez správnej odpovede.',
  itIs: (name) => `Je to ${name}.`,
  next: 'Ďalej',
  results: 'Výsledky',
  points: (n) => (n === 1 ? '1 bod' : n >= 2 && n <= 4 ? `${n} body` : `${n} bodov`),
  winner: (p, pts) => `Vyhráva ${p} – ${pts}!`,
  tie: (ps, pts) => `Remíza! ${ps}: ${pts}.`,
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

const miniFlag = (color: string) =>
  `<svg viewBox="8 4 50 56"><path d="M14 8v50" stroke="#2B2440" stroke-width="5" stroke-linecap="round"/><path d="${FLAG_OUTLINE}" fill="${color}" stroke="#2B2440" stroke-width="4" stroke-linejoin="round"/></svg>`;
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="#FFD23F" stroke="#2B2440" stroke-width="2" stroke-linejoin="round"/></svg>';

interface Player {
  name: string;
  score: number;
  /** rounds answered correctly (for the stars) */
  correct: number;
  pick: Country | null;
  /** this round's options in the lane's own (shuffled) order */
  shown: Country[];
  /** answer order within the round (0 = first) */
  order: number;
  lane: HTMLElement;
  opts: HTMLElement;
  status: HTMLElement;
  scoreEl: HTMLElement;
}

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
  const optionsFor = (target: Country) =>
    shuffle([target, ...pickDistractors(target, pool, cfg.choices - 1, cfg.distractors)]);

  let alive = true;
  let timer = 0;
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);
  /** re-measures the multiplayer layout (set once the game starts) */
  let fit = () => {};

  const root = h('div', { class: 'flg' });
  stage.append(root);
  const stopResize = onResize(stage, () => fit());

  /* ---------- player count ---------- */
  function renderSetup() {
    root.className = 'flg flg-setup-mode';
    root.replaceChildren(
      h('div', { class: 'flg-setup' },
        h('div', { class: 'flg-setup-q' }, S.howMany),
        h('div', { class: 'flg-counts' },
          ...[1, 2, 3, 4].map((n) =>
            h('button', {
              class: 'btn flg-count',
              onClick: () => { ctx.sfx.tap(); if (n === 1) playSolo(); else playMulti(n); },
            },
              h('span', { class: 'flg-count-icons', html: PLAYER_COLORS.slice(0, n).map((p) => miniFlag(p.color)).join('') }),
              h('span', null, S.players(n)),
            ),
          ),
        ),
        h('div', { class: 'flg-rules' }, S.rules),
      ),
    );
  }

  /* ---------- 1 player: retry until right, owl hints ---------- */
  function playSolo() {
    let round = 0;
    let mistakes = 0;
    let roundMistakes = 0;
    let locked = false;

    async function next() {
      if (round >= cfg.rounds) {
        ctx.finish({ stars: starsFromMistakes(mistakes, cfg.stars[0], cfg.stars[1]) });
        return;
      }
      ctx.setProgress(round, cfg.rounds);
      const target = targets[round];
      const mode = modes[round];
      const options = optionsFor(target);
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
  }

  /* ---------- 2–4 players: one colour lane each, one answer each, reveal together ---------- */
  function playMulti(count: number) {
    let round = 0;
    let phase: 'load' | 'answer' | 'reveal' = 'load';
    let answered = 0;
    let target = targets[0];
    let mode: Mode = 'name';
    let options: Country[] = [];

    const players: Player[] = PLAYER_COLORS.slice(0, count).map((pc, i) => {
      const status = h('span', { class: 'flg-status' });
      const scoreEl = h('span', { class: 'flg-score-n' }, '0');
      const opts = h('div', { class: 'flg-lane-opts' });
      const lane = h('div', { class: 'flg-lane', style: { '--c': pc.color, '--t': pc.tint } },
        h('div', { class: 'flg-lane-head' },
          h('span', { class: 'flg-badge' }, String(i + 1)),
          status,
          h('span', { class: 'flg-score', html: ICONS.star }, scoreEl),
        ),
        opts,
      );
      return { name: S.player(i + 1), score: 0, correct: 0, pick: null, shown: [], order: 0, lane, opts, status, scoreEl };
    });

    const frame = h('div', { class: 'flg-frame' });
    const question = h('div', { class: 'flg-q' });
    const answer = h('div', { class: 'flg-name' });
    const nextBtn: HTMLButtonElement = h('button', { class: 'btn btn-go btn-big flg-next', onClick: onNext });
    const side = h('div', { class: 'flg-mside' }, question, answer, nextBtn);
    const top = h('div', { class: 'flg-mtop' }, frame, side);
    const timerFill = h('i');
    const timerBar = h('div', { class: 'flg-timer' }, timerFill);
    // touch-action: none on the lanes – several kids tapping at once must not pinch-zoom the page
    const lanes = h('div', { class: `flg-lanes n${count}` }, ...players.map((p) => p.lane));

    root.className = 'flg flg-multi';
    root.replaceChildren(top, timerBar, lanes);

    fit = () => {
      if (!alive || phase === 'load') return;
      const em = parseFloat(getComputedStyle(root).fontSize) || 16;
      if (mode === 'name') {
        // biggest 4:3 flag that fits next to (landscape) or above (portrait) the text
        const column = getComputedStyle(top).flexDirection === 'column';
        const gap = em * (column ? 0.5 : 1.5);
        const w = column ? top.clientWidth : top.clientWidth - side.offsetWidth - gap;
        const hh = column ? top.clientHeight - side.offsetHeight - gap : top.clientHeight;
        const fw = Math.max(em * 4, Math.min(w, (hh * 4) / 3, em * 30));
        frame.style.width = `${Math.floor(fw)}px`;
        const img = frame.firstElementChild as HTMLElement | null;
        if (img) img.style.height = `${Math.floor((fw * 3) / 4) - 2}px`;
      } else {
        // flags inside each lane: 1 or 2 columns, whichever gives bigger flags
        const box = players[0].opts;
        const pad = em * 0.35 * 2;
        const bw = box.clientWidth - pad;
        const bh = box.clientHeight - pad;
        const gap = em * 0.45;
        let fw = em * 2;
        for (const cols of [1, 2]) {
          const rows = Math.ceil(options.length / cols);
          fw = Math.max(fw, Math.min((bw - gap * (cols - 1)) / cols, (((bh - gap * (rows - 1)) / rows) * 4) / 3, em * 16));
        }
        root.style.setProperty('--fw', `${Math.floor(fw)}px`);
        root.style.setProperty('--fh', `${Math.floor((fw * 3) / 4)}px`);
      }
    };

    async function loadRound() {
      phase = 'load';
      ctx.setProgress(round, cfg.rounds);
      target = targets[round];
      mode = modes[round];
      options = optionsFor(target);
      await preload(mode === 'flag' ? options.map((c) => c.code) : [target.code]);
      if (!alive) return;
      render();
    }

    function render() {
      answered = 0;
      root.className = `flg flg-multi mode-${mode}`;
      frame.replaceChildren(mode === 'name' ? flagImg(target, 'flg-img') : '');
      if (mode === 'name') replay(frame, 'pop');
      question.textContent = mode === 'name' ? S.whichCountry : S.findFlag;
      answer.textContent = name(target);
      answer.style.display = mode === 'flag' ? '' : 'none';
      nextBtn.style.display = 'none';
      timerBar.classList.remove('on');
      for (const p of players) {
        p.pick = null;
        p.lane.className = 'flg-lane';
        p.status.textContent = '';
        p.status.className = 'flg-status';
        // every lane gets its own order, so copying the neighbour's position does not help
        p.shown = shuffle(options);
        p.opts.replaceChildren(...p.shown.map((c) => optionButton(p, c)));
      }
      phase = 'answer';
      fit();
    }

    function optionButton(p: Player, c: Country): HTMLButtonElement {
      const b: HTMLButtonElement = mode === 'name'
        ? h('button', { class: 'btn flg-opt' }, h('span', { class: 'flg-opt-text' }, name(c)))
        : h('button', { class: 'flg-pick' }, flagImg(c, 'flg-img'), h('span', { class: 'flg-pick-label' }, name(c)));
      // pointerdown, not click: browsers drop "click" when two fingers touch the screen at once
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(p, c, b); });
      b.addEventListener('click', () => choose(p, c, b));
      return b;
    }

    function choose(p: Player, c: Country, b: HTMLButtonElement) {
      if (phase !== 'answer' || p.pick) return;
      p.pick = c;
      p.order = answered++;
      ctx.sfx.tap();
      p.opts.querySelectorAll('button').forEach((x) => (x.disabled = true));
      b.classList.add('picked');
      p.lane.classList.add('locked');
      p.status.textContent = '✓';
      replay(b, 'pop');
      if (answered >= players.length) reveal();
      else if (answered === 1) startCountdown();
    }

    function startCountdown() {
      timerFill.style.transition = 'none';
      timerFill.style.width = '100%';
      timerBar.classList.add('on');
      void timerFill.offsetWidth;
      timerFill.style.transition = `width ${ANSWER_MS}ms linear`;
      timerFill.style.width = '0%';
      ctx.mascot.say(S.hurry, 'think', 2500);
      timer = window.setTimeout(() => alive && phase === 'answer' && reveal(), ANSWER_MS);
    }

    function reveal() {
      phase = 'reveal';
      clearTimeout(timer);
      timer = 0;
      timerBar.classList.remove('on');
      const right = players.filter((p) => p.pick === target).sort((a, b) => a.order - b.order);
      const fastest = right[0];
      for (const p of players) {
        const ok = p.pick === target;
        const pts = ok ? (p === fastest ? 2 : 1) : 0;
        p.score += pts;
        if (ok) p.correct++;
        p.lane.className = `flg-lane revealed ${ok ? 'got' : 'miss'}`;
        p.opts.querySelectorAll('button').forEach((b, i) => {
          b.disabled = true;
          b.classList.remove('picked');
          const c = p.shown[i];
          if (c === target) b.classList.add('right');
          else if (c === p.pick) {
            b.classList.add('wrong');
            if (mode === 'name') b.prepend(flagImg(c, 'flg-mini'));
          }
        });
        p.status.className = `flg-status ${ok ? 'ok' : 'no'}`;
        p.status.innerHTML = '';
        p.status.append(`+${pts}`);
        if (p === fastest) p.status.append(h('span', { class: 'flg-bolt', html: BOLT }));
        p.scoreEl.textContent = String(p.score);
        replay(p.status, 'pop');
      }
      answer.textContent = name(target);
      answer.style.display = '';
      replay(answer, 'pop');
      const last = round + 1 >= cfg.rounds;
      nextBtn.textContent = last ? S.results : S.next;
      nextBtn.style.display = '';
      nextBtn.disabled = true; // a kid still tapping must not skip the reveal
      later(() => (nextBtn.disabled = false), 900);
      fit();

      const tail = mode === 'name' ? ` ${S.itIs(name(target))}` : '';
      if (right.length) { ctx.sfx.correct(); ctx.celebrate('small'); } else ctx.sfx.wrong();
      const msg = right.length === players.length ? S.everyone
        : right.length ? S.fastest(fastest.name) : S.nobody;
      ctx.mascot.say(msg + tail, right.length ? 'happy' : 'think', 4000);
    }

    function onNext() {
      if (phase !== 'reveal') return;
      ctx.sfx.tap();
      round++;
      if (round >= cfg.rounds) end();
      else void loadRound();
    }

    function end() {
      const best = Math.max(...players.map((p) => p.score));
      const bestCorrect = Math.max(...players.map((p) => p.correct));
      const winners = players.filter((p) => p.score === best);
      let message = winners.length === 1
        ? S.winner(winners[0].name, S.points(best))
        : S.tie(winners.map((p) => p.name).join(', '), S.points(best));
      const rest = players.filter((p) => p.score !== best).sort((a, b) => b.score - a.score);
      if (rest.length) message += '  ' + rest.map((p) => `${p.name}: ${S.points(p.score)}`).join(' · ');
      ctx.finish({ stars: starsFromMistakes(cfg.rounds - bestCorrect, cfg.stars[0], cfg.stars[1]), message });
    }

    ctx.mascot.say(S.introMulti, 'wave', 4500);
    void loadRound();
  }

  renderSetup();
  ctx.mascot.say(S.hello, 'wave', 4000);
  return () => {
    alive = false;
    clearTimeout(timer);
    stopResize();
  };
}

const game: GameModule = {
  id: 'flags',
  order: 6,
  players: 4,
  title: { en: 'World Flags', sk: 'Vlajky sveta' },
  tagline: { en: 'Which country is it?', sk: 'Ktorá je to krajina?' },
  color: '#3DA5FF',
  icon: ICON,
  howTo: [
    { en: 'Choose how many players (1 to 4).', sk: 'Vyber, koľko hráčov hrá (1 až 4).' },
    { en: 'Look at the flag and tap the country it belongs to.', sk: 'Pozri sa na vlajku a ťukni na krajinu, ktorej patrí.' },
    { en: "Sometimes it's the other way round: find the flag for a country name.", sk: 'Niekedy naopak: k názvu krajiny nájdi správnu vlajku.' },
    { en: 'With friends, everyone taps in their own colour column. The fastest right answer gets 2 points!', sk: 'S kamarátmi ťuká každý vo svojom farebnom stĺpci. Najrýchlejšia správna odpoveď má 2 body!' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Europe, 3 choices', sk: 'Európa, 3 možnosti' } },
    { id: 'medium', description: { en: 'Well-known flags of the world', sk: 'Známe vlajky sveta' } },
    { id: 'hard', description: { en: 'All countries, tricky look-alikes', sk: 'Všetky krajiny, podobné vlajky' } },
  ],
  mount,
};
export default game;
