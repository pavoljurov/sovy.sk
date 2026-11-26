import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { randInt, shuffle, starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { createParty, playerPicker, type Party } from '../../platform/party';
import './clock.css';

const ICON = `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#fff" stroke="#2B2440" stroke-width="5"/><path d="M32 13v19" stroke="#7B5CFF" stroke-width="5" stroke-linecap="round"/><path d="M32 32l11 6" stroke="#FF8A3D" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#2B2440"/></svg>`;

interface Cfg {
  /** minute step of the generated times */
  step: number;
  options: number;
  /** chance a question is "set the clock" instead of "read the clock" */
  setChance: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { step: 60, options: 3, setChance: 0.3 },
  medium: { step: 15, options: 4, setChance: 0.35 },
  hard: { step: 5, options: 4, setChance: 0.5 },
};
const TOTAL = 8;

/** h is 0–23 (24-hour time). The clock face only shows h % 12. */
interface Time { h: number; m: number }

const h12 = (hr: number) => hr % 12 || 12;
const nextHour = (hr: number) => (hr % 12) + 1;
const fmt = (t: Time) => `${t.h}:${String(t.m).padStart(2, '0')}`;
const same = (a: Time, b: Time) => a.h === b.h && a.m === b.m;
/** Same position of the hands (ignores morning/afternoon). */
const sameOnFace = (a: Time, b: Time) => a.h % 12 === b.h % 12 && a.m === b.m;

/* ---------- part of the day (tells which half of the day it is) ---------- */

type Part = 'night' | 'morning' | 'forenoon' | 'afternoon' | 'evening';
// Chosen so that h and h+12 always fall into different parts.
const partOf = (hr: number): Part =>
  hr < 5 ? 'night' : hr < 9 ? 'morning' : hr < 12 ? 'forenoon' : hr < 18 ? 'afternoon' : hr < 22 ? 'evening' : 'night';

const INK = '#2B2440';
const SUN = `<svg viewBox="0 0 40 40"><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="20" r="8.5" fill="#FFD23F" stroke="${INK}" stroke-width="2.5"/></svg>`;
const horizon = (fill: string, rays: boolean) =>
  `<svg viewBox="0 0 40 40">${rays ? `<path d="M20 7v5M7 14l3.5 3M33 14l-3.5 3" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` : ''}<path d="M8 28a12 12 0 0 1 24 0z" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M3 28h34" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M11 33h18" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".45"/></svg>`;
const MOON = `<svg viewBox="0 0 40 40"><path d="M25 5a14.5 14.5 0 1 0 10 23A12 12 0 0 1 25 5z" fill="#FFE27A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M9 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#FFE27A"/><circle cx="33" cy="9" r="1.5" fill="#FFE27A"/></svg>`;
const PART_ICON: Record<Part, string> = {
  night: MOON,
  morning: horizon('#FFB020', true),
  forenoon: SUN,
  afternoon: SUN,
  evening: horizon('#FF7A59', false),
};

/* ---------- time in words ---------- */

function wordsEn({ h: hr, m }: Time): string {
  if (hr === 12 && m === 0) return 'noon';
  if (hr === 0 && m === 0) return 'midnight';
  const x = h12(hr);
  let w: string;
  if (m === 0) w = `${x} o'clock`;
  else if (m === 15) w = `quarter past ${x}`;
  else if (m === 30) w = `half past ${x}`;
  else if (m === 45) w = `quarter to ${nextHour(x)}`;
  else if (m < 30) w = `${m} minutes past ${x}`;
  else w = `${60 - m} minutes to ${nextHour(x)}`;
  return `${w} ${EN_PART_PHRASE[partOf(hr)]}`;
}
const EN_PART_PHRASE: Record<Part, string> = {
  night: 'at night', morning: 'in the morning', forenoon: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening',
};

// Slovak tells time towards the NEXT hour: 3:15 = štvrť na štyri, 3:30 = pol štvrtej.
const SK_NOM = ['', 'jedna', 'dve', 'tri', 'štyri', 'päť', 'šesť', 'sedem', 'osem', 'deväť', 'desať', 'jedenásť', 'dvanásť'];
const SK_ACC = ['', 'jednu', 'dve', 'tri', 'štyri', 'päť', 'šesť', 'sedem', 'osem', 'deväť', 'desať', 'jedenásť', 'dvanásť'];
const SK_ORD = ['', 'jednej', 'druhej', 'tretej', 'štvrtej', 'piatej', 'šiestej', 'siedmej', 'ôsmej', 'deviatej', 'desiatej', 'jedenástej', 'dvanástej'];
const SK_PART_PHRASE: Record<Part, string> = {
  night: 'v noci', morning: 'ráno', forenoon: 'dopoludnia', afternoon: 'popoludní', evening: 'večer',
};

function wordsSk({ h: hr, m }: Time): string {
  if (hr === 12 && m === 0) return 'poludnie';
  if (hr === 0 && m === 0) return 'polnoc';
  const x = h12(hr);
  const n = nextHour(x);
  let w: string;
  if (m === 0) w = `${SK_NOM[x]} ${x === 1 ? 'hodina' : x <= 4 ? 'hodiny' : 'hodín'}`;
  else if (m === 15) w = `štvrť na ${SK_ACC[n]}`;
  else if (m === 30) w = `pol ${SK_ORD[n]}`;
  else if (m === 45) w = `tri štvrte na ${SK_ACC[n]}`;
  else if (m < 30) w = `${m} minút po ${SK_ORD[x]}`;
  else w = `${60 - m} minút do ${SK_ORD[n]}`;
  return `${w} ${SK_PART_PHRASE[partOf(hr)]}`;
}

const pad = (m: number) => String(m).padStart(2, '0');

const en = {
  whatTime: 'What time is it?',
  setTo: 'Set the clock to',
  longHand: 'Long hand',
  shortHand: 'Short hand',
  back: 'back',
  forward: 'forward',
  done: 'Done ✓',
  findClock: 'Find the clock:',
  parts: { night: 'Night', morning: 'Morning', forenoon: 'Late morning', afternoon: 'Afternoon', evening: 'Evening' } as Record<Part, string>,
  intro: 'Look at the clock and the picture. What time is it?',
  setIntroEasy: 'Turn the hands to set the clock!',
  setIntro: 'Move the long hand – the short hand moves too!',
  setPm: (t: Time) => `Tip: on the clock, ${fmt(t)} looks just like ${t.h - 12}:${pad(t.m)}!`,
  words: wordsEn,
  itIs: (t: Time) => `It's ${wordsEn(t)}!`,
  hintHalf: (part: string, hr: number) =>
    hr > 12 ? `It's ${part}! After noon we add 12: ${hr - 12} + 12 = ${hr}.` : `Look at the picture – it's ${part}!`,
  hintNextHour: "Careful! The short hand hasn't reached the next number yet.",
  hintHour: 'The minutes are right! Now look at the short orange hand – it shows the hour.',
  hintMinutes: 'The hour is right! The long purple hand shows the minutes.',
  hintFives: 'Short hand = hours. Long hand = minutes. Count by fives!',
  hintBoth: 'Short orange hand shows the hour, long purple hand the minutes.',
};

const sk: typeof en = {
  whatTime: 'Koľko je hodín?',
  setTo: 'Nastav hodiny na',
  longHand: 'Dlhá ručička',
  shortHand: 'Krátka ručička',
  back: 'späť',
  forward: 'dopredu',
  done: 'Hotovo ✓',
  findClock: 'Nájdi hodiny:',
  parts: { night: 'Noc', morning: 'Ráno', forenoon: 'Dopoludnie', afternoon: 'Popoludnie', evening: 'Večer' },
  intro: 'Pozri sa na hodiny aj na obrázok. Koľko je hodín?',
  setIntroEasy: 'Otáčaj ručičkami a nastav hodiny!',
  setIntro: 'Posúvaj dlhú ručičku – krátka sa pohne tiež!',
  setPm: (t) => `Tip: na hodinách vyzerá ${fmt(t)} rovnako ako ${t.h - 12}:${pad(t.m)}!`,
  words: wordsSk,
  itIs: (t) => {
    const x = h12(t.h);
    const plural = t.m === 0 && x >= 2 && x <= 4 && t.h !== 12 && t.h !== 0;
    return `${plural ? 'Sú' : 'Je'} ${wordsSk(t)}.`;
  },
  hintHalf: (part, hr) =>
    hr > 12 ? `Je ${part}! Po poludní pripočítame 12: ${hr - 12} + 12 = ${hr}.` : `Pozri sa na obrázok – je ${part}!`,
  hintNextHour: 'Pozor! Krátka ručička ešte nedošla k ďalšiemu číslu.',
  hintHour: 'Minúty sú správne! Teraz sa pozri na krátku oranžovú ručičku – ukazuje hodiny.',
  hintMinutes: 'Hodina je správne! Dlhá fialová ručička ukazuje minúty.',
  hintFives: 'Krátka ručička = hodiny. Dlhá ručička = minúty. Počítaj po päť!',
  hintBoth: 'Krátka oranžová ručička ukazuje hodiny, dlhá fialová minúty.',
};

function randomTime(step: number): Time {
  return { h: randInt(0, 23), m: randInt(0, 60 / step - 1) * step };
}

/** Wrong answers that mirror real mistakes kids make (the first one is always the other half of the day). */
function candidates(t: Time, cfg: Cfg): Time[] {
  const pm = t.h >= 12;
  /** a clock-face hour (1–12) in the same half of the day as the answer */
  const sameHalf = (x: number) => (x % 12) + (pm ? 12 : 0);
  const out: Time[] = [];
  const add = (x: Time) => {
    if (!same(x, t) && !out.some((o) => same(o, x))) out.push(x);
  };
  const x = h12(t.h);
  add({ h: (t.h + 12) % 24, m: t.m }); // right hands, wrong half of the day (2:30 vs 14:30)
  if (t.m >= 30) add({ h: sameHalf(nextHour(x)), m: t.m }); // reads the hour hand as the next number
  if (t.m % 5 === 0 && t.m > 0) add({ h: sameHalf(t.m / 5), m: (x * 5) % 60 }); // swaps the hands
  add({ h: sameHalf(nextHour(x)), m: t.m });
  add({ h: sameHalf(x === 1 ? 12 : x - 1), m: t.m });
  if (cfg.step < 60) add({ h: t.h, m: (t.m + 30) % 60 });
  while (out.length < 8) {
    const r = randomTime(cfg.step);
    add({ h: sameHalf(h12(r.h)), m: r.m });
  }
  return out;
}

function distractors(t: Time, cfg: Cfg): Time[] {
  const [otherHalf, ...rest] = candidates(t, cfg);
  return [otherHalf, ...shuffle(rest.slice(0, 4))].slice(0, cfg.options - 1);
}

/** Wrong clock faces: all must look different from the answer and from each other. */
function faceDistractors(t: Time, cfg: Cfg): Time[] {
  const out: Time[] = [];
  const add = (x: Time) => {
    if (out.length < cfg.options - 1 && !sameOnFace(x, t) && !out.some((o) => sameOnFace(o, x))) out.push(x);
  };
  const [, ...rest] = candidates(t, cfg);
  rest.slice(0, 2).forEach(add);
  shuffle(rest.slice(2)).forEach(add);
  while (out.length < cfg.options - 1) add(randomTime(cfg.step));
  return out;
}

/* ---------- clock face ---------- */

/** The clock face; with `t` the hands are drawn at that time (for small static clocks). */
function faceSvg(t?: Time): string {
  const P = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [+(Math.sin(a) * r).toFixed(2), +(-Math.cos(a) * r).toFixed(2)];
  };
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const [x1, y1] = P(major ? 89 : 93, i * 6);
    const [x2, y2] = P(98, i * 6);
    ticks += `<line class="${major ? 'tick5' : 'tick'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  let nums = '';
  for (let n = 1; n <= 12; n++) {
    const [x, y] = P(73, n * 30);
    nums += `<text class="num" x="${x}" y="${y}">${n}</text>`;
  }
  return `<svg class="clk-face" viewBox="-115 -115 230 230">
    <circle r="110" class="clk-rim"/><circle r="101" class="clk-bg"/>
    ${ticks}${nums}
    <g class="clk-hour"${t ? ` transform="rotate(${(t.h % 12) * 30 + t.m * 0.5})"` : ''}><line y1="10" y2="-50"/></g>
    <g class="clk-min"${t ? ` transform="rotate(${t.m * 6})"` : ''}><line y1="14" y2="-80"/></g>
    <circle r="8" fill="#2B2440"/><circle r="3.5" fill="#FFD23F"/>
  </svg>`;
}

function createClock() {
  const el = h('div', { class: 'clk-wrap', html: faceSvg() });
  const hourHand = el.querySelector('.clk-hour')!;
  const minHand = el.querySelector('.clk-min')!;
  /** minutes since 12:00, unbounded so hands always turn the short way */
  let total = 0;
  let shown = 0;
  let raf = 0;
  const draw = (t: number) => {
    hourHand.setAttribute('transform', `rotate(${t * 0.5})`);
    minHand.setAttribute('transform', `rotate(${t * 6})`);
  };
  return {
    el,
    /** What the hands show (h is 0–11). */
    get time(): Time {
      const t = ((total % 720) + 720) % 720;
      return { h: Math.floor(t / 60), m: t % 60 };
    },
    set(t: Time) {
      cancelAnimationFrame(raf);
      total = shown = (t.h % 12) * 60 + t.m;
      draw(total);
      replay(el, 'pop');
    },
    nudge(minutes: number) {
      total += minutes;
      const from = shown, to = total, start = performance.now();
      cancelAnimationFrame(raf);
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / 280);
        shown = from + (to - from) * (1 - (1 - k) ** 3);
        draw(shown);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    destroy: () => cancelAnimationFrame(raf),
  };
}

/* ---------- game ---------- */

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const clock = createClock();
  const root = h('div', { class: 'clk clk-setup-mode' });
  stage.append(root);

  let alive = true;
  let party: Party | null = null;
  /** re-measures the multiplayer layout (set once a multiplayer game starts) */
  let fit = () => {};
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);
  const stopResize = onResize(stage, () => fit());

  const nextTime = (() => {
    let last: Time | null = null;
    return () => {
      let t: Time;
      do t = randomTime(cfg.step);
      while (last && same(t, last));
      return (last = t);
    };
  })();

  function partBadge(t: Time) {
    const part = partOf(t.h);
    return h(
      'div',
      { class: 'clk-part', 'data-part': part },
      h('span', { class: 'clk-part-icon', html: PART_ICON[part] }),
      S.parts[part],
    );
  }

  /* ---------- 1 player: read or set the clock, retry until right, owl hints ---------- */
  function playSolo() {
    const panel = h('div', { class: 'clk-panel' });
    root.className = 'clk';
    root.replaceChildren(clock.el, panel);
    let q = 0;
    let mistakes = 0;

    function nextQuestion() {
      if (q >= TOTAL) {
        ctx.finish({ stars: starsFromMistakes(mistakes, 1, 3) });
        return;
      }
      ctx.setProgress(q, TOTAL);
      const t = nextTime();
      if (q > 0 && Math.random() < cfg.setChance) askSet(t);
      else askRead(t);
    }

    function correct(t: Time) {
      ctx.sfx.correct();
      ctx.celebrate('small');
      ctx.mascot.say(`${praise()} ${S.itIs(t)}`, 'happy', 2200);
      q++;
      later(nextQuestion, 1500);
    }

    function hint(t: Time, chosen: Time) {
      mistakes++;
      ctx.sfx.wrong();
      const tx = h12(t.h), cx = h12(chosen.h);
      let msg: string;
      if (sameOnFace(chosen, t)) msg = S.hintHalf(S.parts[partOf(t.h)].toLowerCase(), t.h);
      else if (chosen.m === t.m && cx === nextHour(tx) && t.m >= 30) msg = S.hintNextHour;
      else if (chosen.m === t.m) msg = S.hintHour;
      else if (cx === tx) msg = S.hintMinutes;
      else if (cfg.step === 5) msg = S.hintFives;
      else msg = S.hintBoth;
      ctx.mascot.say(msg, 'think', 5000);
    }

    function askRead(t: Time) {
      clock.el.classList.remove('settable');
      clock.set(t);
      const options = shuffle([t, ...distractors(t, cfg)]);
      const buttons = options.map((o) => {
        const b: HTMLButtonElement = h(
          'button',
          {
            class: 'btn clk-opt',
            onClick: () => {
              if (same(o, t)) {
                b.classList.add('right');
                buttons.forEach((x) => (x.disabled = x !== b));
                correct(t);
              } else {
                b.disabled = true;
                replay(b, 'shake');
                hint(t, o);
              }
            },
          },
          fmt(o),
        );
        return b;
      });
      panel.replaceChildren(
        partBadge(t),
        h('div', { class: 'clk-q' }, S.whatTime),
        h('div', { class: `clk-options n${buttons.length}` }, buttons),
      );
      if (q === 0) ctx.mascot.say(S.intro, 'wave', 4000);
    }

    function askSet(t: Time) {
      clock.el.classList.add('settable');
      let start = randomTime(cfg.step);
      if (sameOnFace(start, t)) start = { h: t.h + 3, m: start.m };
      clock.set(start);
      const step = Math.min(cfg.step, 60);
      const ctrl = (cls: string, label: string, delta: number) =>
        h(
          'div',
          { class: `clk-ctrl ${cls}` },
          h('button', { class: 'btn clk-nudge', 'aria-label': `${label} ${S.back}`, onClick: () => { ctx.sfx.step(); clock.nudge(-delta); } }, '↺'),
          h('span', null, label),
          h('button', { class: 'btn clk-nudge', 'aria-label': `${label} ${S.forward}`, onClick: () => { ctx.sfx.step(); clock.nudge(delta); } }, '↻'),
        );
      const check: HTMLButtonElement = h(
        'button',
        {
          class: 'btn btn-big btn-go clk-check',
          onClick: () => {
            const now = clock.time;
            if (sameOnFace(now, t)) {
              check.disabled = true;
              correct(t);
            } else {
              replay(clock.el, 'shake');
              hint(t, now);
            }
          },
        },
        S.done,
      );
      panel.replaceChildren(
        partBadge(t),
        h('div', { class: 'clk-q' }, S.setTo),
        h('div', { class: 'clk-target' }, fmt(t)),
        h('div', { class: 'clk-words' }, S.words(t)),
        ...(cfg.step < 60 ? [ctrl('min', S.longHand, step)] : []),
        ctrl('hour', S.shortHand, 60),
        check,
      );
      ctx.mascot.say(t.h > 12 ? S.setPm(t) : cfg.step === 60 ? S.setIntroEasy : S.setIntro, 'think', 5000);
    }

    nextQuestion();
  }

  /* ---------- 2–4 players: colour lanes, one answer each, reveal together ---------- */
  function playMulti(count: number) {
    let q = 0;
    /** 'read' = big clock, pick the time. 'find' = a time is shown, pick the clock face. */
    let mode: 'read' | 'find' = 'read';
    const p = createParty(ctx, count, () => {
      q++;
      if (q >= TOTAL) {
        const r = p.result();
        ctx.finish({ stars: starsFromMistakes(TOTAL - r.bestCorrect, 1, 3), message: r.message });
      } else ask();
    });
    party = p;

    const side = h('div', { class: 'clk-mside' });
    const top = h('div', { class: 'clk-mtop' }, clock.el, side);
    root.className = 'clk clk-multi';
    root.replaceChildren(top, p.timer, p.lanes);

    fit = () => {
      if (!alive) return;
      const em = parseFloat(getComputedStyle(root).fontSize) || 16;
      if (mode === 'read') {
        // biggest clock that fits next to (landscape) or above (portrait) the text
        const column = getComputedStyle(top).flexDirection === 'column';
        const gap = em * (column ? 0.5 : 1.5);
        const w = column ? top.clientWidth : top.clientWidth - side.offsetWidth - gap;
        const hh = column ? top.clientHeight - side.offsetHeight - gap : top.clientHeight;
        const size = Math.floor(Math.max(em * 5, Math.min(w, hh, em * 28)));
        clock.el.style.width = clock.el.style.height = `${size}px`;
      } else {
        // small clocks inside each lane: 1–3 columns, whichever gives the biggest clocks
        const box = p.players[0].opts;
        const inset = em * 0.3 * 2;
        const bw = box.clientWidth - inset;
        const bh = box.clientHeight - inset;
        const gap = em * 0.5;
        const n = cfg.options;
        let size = em * 2.5;
        for (let cols = 1; cols <= Math.min(3, n); cols++) {
          const rows = Math.ceil(n / cols);
          size = Math.max(size, Math.min((bw - gap * (cols - 1)) / cols, (bh - gap * (rows - 1)) / rows, em * 12));
        }
        root.style.setProperty('--cs', `${Math.floor(size)}px`);
      }
    };

    function ask() {
      ctx.setProgress(q, TOTAL);
      const t = nextTime();
      mode = q > 0 && Math.random() < cfg.setChance ? 'find' : 'read';
      root.className = `clk clk-multi mode-${mode}`;
      const answer = h('div', { class: 'clk-answer' });
      answer.style.visibility = 'hidden';
      if (mode === 'read') {
        clock.el.classList.remove('settable');
        clock.set(t);
        side.replaceChildren(partBadge(t), h('div', { class: 'clk-q' }, S.whatTime), answer, p.nextBtn);
      } else {
        side.replaceChildren(
          partBadge(t),
          h('div', { class: 'clk-q' }, S.findClock),
          h('div', { class: 'clk-target' }, fmt(t)),
          h('div', { class: 'clk-words' }, S.words(t)),
          p.nextBtn,
        );
      }
      const options = [t, ...(mode === 'read' ? distractors(t, cfg) : faceDistractors(t, cfg))];
      p.ask<Time>({
        options,
        last: q + 1 >= TOTAL,
        isRight: (o) => (mode === 'read' ? same(o, t) : sameOnFace(o, t)),
        button: (o) => (mode === 'read'
          ? h('button', { class: 'btn clk-lopt' }, fmt(o))
          : h('button', { class: 'clk-pick', 'aria-label': fmt(o), html: faceSvg(o) })),
        markWrong: (b, o) => {
          // a wrong clock face: show the time it really shows
          if (mode === 'find') b.append(h('span', { class: 'clk-pick-label' }, `${h12(o.h)}:${pad(o.m)}`));
        },
        onReveal: () => {
          answer.replaceChildren(h('b', null, fmt(t)), ' ', S.words(t));
          answer.style.visibility = '';
          replay(answer, 'pop');
          later(fit, 0);
          return S.itIs(t);
        },
      });
      p.lanes.querySelectorAll('.pty-opts').forEach((o) => o.classList.add(`n${options.length}`));
      fit();
    }

    ask();
  }

  root.replaceChildren(playerPicker(ctx, (n) => (n === 1 ? playSolo() : playMulti(n))));
  return () => {
    alive = false;
    clock.destroy();
    if (party) party.destroy();
    stopResize();
  };
}

const game: GameModule = {
  id: 'clock',
  order: 1,
  players: 4,
  title: { en: 'Clock Quiz', sk: 'Hodiny' },
  tagline: { en: 'Learn to read the clock', sk: 'Nauč sa čítať hodiny' },
  color: '#3DA5FF',
  icon: ICON,
  howTo: [
    { en: 'Look at the clock: the short hand shows the hour, the long hand the minutes.', sk: 'Pozri sa na hodiny: krátka ručička ukazuje hodiny, dlhá minúty.' },
    { en: 'The picture tells you the part of the day – morning, afternoon, evening or night.', sk: 'Obrázok prezradí časť dňa – ráno, popoludnie, večer alebo noc.' },
    { en: 'Tap the right time. Sometimes you set the clock instead – turn the hands with the buttons.', sk: 'Ťukni na správny čas. Niekedy hodiny nastavuješ – ručičky otáčaš tlačidlami.' },
    { en: 'Up to 4 players: everyone taps in their own colour column. The fastest right answer gets 2 points!', sk: 'Až 4 hráči: každý ťuká vo svojom farebnom stĺpci. Najrýchlejšia správna odpoveď má 2 body!' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Whole hours – 3:00 and 15:00', sk: 'Celé hodiny – 3:00 aj 15:00' } },
    { id: 'medium', description: { en: 'Quarters and halves, all day long', sk: 'Štvrť, pol a tri štvrte – celý deň' } },
    { id: 'hard', description: { en: 'Every 5 minutes, all day long', sk: 'Každých 5 minút – celý deň' } },
  ],
  mount,
};
export default game;
