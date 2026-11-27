import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { starsFromMistakes } from '../../platform/util';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { PLAYER_COLORS } from '../../platform/party';
import { fitGrid, mixedDeck, pictureDeck, timeText, type Card, type Face } from './logic';
import { CARD_BACK, ICON, PICTURES, clockSvg, kidSvg } from './pictures';
import { FLAG_CODES, LOOKALIKE, flagName, flagUrl } from './flags';
import './memory.css';

/* ---------- difficulty ---------- */

interface Cfg {
  pairs: number;
  /** related pairs (flag ↔ name, clock ↔ time, 3 × 4 ↔ 12) instead of identical pictures */
  mixed: boolean;
  /** misses for 3 / 2 stars (a perfect memory still needs ~pairs/2 misses by bad luck) */
  stars: [number, number];
  /** how long two different cards stay open (ms) */
  showMs: number;
}

const CFG: Record<LevelId, Cfg> = {
  easy: { pairs: 6, mixed: false, stars: [6, 10], showMs: 1100 },
  medium: { pairs: 8, mixed: false, stars: [8, 13], showMs: 1100 },
  hard: { pairs: 10, mixed: true, stars: [11, 17], showMs: 1600 },
};

/** CSS flip duration (keep in sync with memory.css) */
const FLIP_MS = 350;

/* ---------- texts ---------- */

const en = {
  howMany: 'How many players?',
  hello: 'Play alone or with friends – up to 4 players!',
  players: (n: number) => (n === 1 ? '1 player' : `${n} players`),
  player: (i: number) => `Player ${i}`,
  intro: 'Flip two cards. Find all the pairs!',
  introHard: 'Find what belongs together: a flag and its country, a clock and its time, a sum and its result!',
  introMulti: 'Take turns! Find a pair and you play again.',
  pairs: 'Pairs',
  misses: 'Misses',
  turnLabel: (p: string) => `${p}: your turn`,
  turn: (p: string) => `${p}, your turn!`,
  again: (p: string) => `A pair! ${p} plays again.`,
  notPair: 'Not a pair. Remember where they are!',
  seenBefore: 'Careful! The pair of this card was already shown. Where was it?',
  flagIs: (c: string) => `That is the flag of ${c}.`,
  findFlag: (c: string) => `Now find the flag of ${c}!`,
  clockIs: (t: string) => `The clock shows ${t}. Short hand = hours.`,
  findClock: (t: string) => `Find the clock that shows ${t}!`,
  mulIs: (a: number, b: number, n: number) => `${a} × ${b} = ${n}. Find the ${n}!`,
  findMul: (n: number) => `Which example gives ${n}?`,
  pairN: (n: number) => (n === 1 ? '1 pair' : `${n} pairs`),
  soloEnd: (m: number) => (m === 0 ? 'All pairs found without a single miss!' : `All pairs found! Misses: ${m}.`),
  winner: (p: string, pts: string) => `${p} wins with ${pts}!`,
  tie: (ps: string, pts: string) => `It’s a tie! ${ps}: ${pts}.`,
};
const sk: typeof en = {
  howMany: 'Koľko hráčov hrá?',
  hello: 'Hrať sa dá aj s kamarátmi – až 4 hráči!',
  players: (n) => (n === 1 ? '1 hráč' : `${n} hráči`),
  player: (i) => `Hráč ${i}`,
  intro: 'Otoč dve karty. Nájdi všetky dvojice!',
  introHard: 'Hľadaj, čo k sebe patrí: vlajku a krajinu, hodiny a čas, príklad a výsledok!',
  introMulti: 'Striedajte sa! Kto nájde dvojicu, hrá ešte raz.',
  pairs: 'Dvojice',
  misses: 'Omyly',
  turnLabel: (p) => `Na rade: ${p}`,
  turn: (p) => `Na rade je ${p}!`,
  again: (p) => `Dvojica! ${p} hrá ešte raz.`,
  notPair: 'Nie je to dvojica. Zapamätaj si, kde sú!',
  seenBefore: 'Pozor! Dvojica k tejto karte už bola odkrytá. Spomenieš si, kde?',
  flagIs: (c) => `To je vlajka krajiny ${c}.`,
  findFlag: (c) => `Teraz nájdi vlajku krajiny ${c}!`,
  clockIs: (t) => `Hodiny ukazujú ${t}. Krátka ručička = hodiny.`,
  findClock: (t) => `Nájdi hodiny, ktoré ukazujú ${t}!`,
  mulIs: (a, b, n) => `${a} × ${b} = ${n}. Nájdi číslo ${n}!`,
  findMul: (n) => `Ktorý príklad má výsledok ${n}?`,
  pairN: (n) => (n === 1 ? '1 dvojica' : n >= 2 && n <= 4 ? `${n} dvojice` : `${n} dvojíc`),
  soloEnd: (m) => (m === 0 ? 'Všetky dvojice sú nájdené bez jediného omylu!' : `Všetky dvojice sú nájdené! Omyly: ${m}.`),
  winner: (p, pts) => `Vyhráva ${p} – ${pts}!`,
  tie: (ps, pts) => `Remíza! ${ps}: ${pts}.`,
};

/* ---------- game ---------- */

interface Player { name: string; color: string; score: number; chip: HTMLElement; scoreEl: HTMLElement }

const SOLO_COLOR = '#7B5CFF';

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const cards: Card[] = cfg.mixed
    ? mixedDeck(cfg.pairs, FLAG_CODES, LOOKALIKE)
    : pictureDeck(cfg.pairs, PICTURES.length);

  let alive = true;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(() => alive && fn(), ms)); };

  let players: Player[] = [];
  let turn = 0;
  let first = -1;
  let busy = false;
  let found = 0;
  let misses = 0;
  const matched: boolean[] = cards.map(() => false);
  /** cards that have been face-up at least once */
  const seen: boolean[] = cards.map(() => false);

  const root = h('div', { class: 'mem' });
  stage.append(root);

  /* ---- player count ---- */
  function renderSetup() {
    root.className = 'mem mem-setup-mode';
    root.replaceChildren(
      h('div', { class: 'mem-setup' },
        h('div', { class: 'mem-setup-q' }, S.howMany),
        h('div', { class: 'mem-counts' },
          ...[1, 2, 3, 4].map((n) =>
            h('button', { class: 'btn mem-count', onClick: () => { ctx.sfx.tap(); start(n); } },
              h('span', { class: 'mem-count-kids', html: PLAYER_COLORS.slice(0, n).map((p) => kidSvg(p.color)).join('') }),
              h('span', null, S.players(n)),
            ),
          ),
        ),
      ),
    );
  }

  /* ---- board ---- */
  const bar = h('div', { class: 'mem-bar' });
  const turnEl = h('div', { class: 'mem-turn' });
  const board = h('div', { class: 'mem-board' });
  const boardWrap = h('div', { class: 'mem-boardwrap' }, board);
  let soloPairs: HTMLElement | null = null;
  let soloMisses: HTMLElement | null = null;

  /** country-name cards: font size depends on the longest word and the card width */
  const names: { el: HTMLElement; longest: number }[] = [];

  function faceEl(f: Face): HTMLElement {
    switch (f.kind) {
      case 'pic': return h('div', { class: 'mem-pic', html: PICTURES[f.pic] });
      case 'flag': return h('div', { class: 'mem-flagbox' }, h('img', { class: 'mem-flag', src: flagUrl(f.code), alt: '', draggable: 'false' }));
      case 'name': {
        const name = flagName(f.code, ctx.lang);
        const el = h('div', { class: 'mem-name' }, name);
        names.push({ el, longest: Math.max(...name.split(' ').map((w) => w.length)) });
        return el;
      }
      case 'clock': return h('div', { class: 'mem-pic', html: clockSvg(f.h, f.m) });
      case 'time': return h('div', { class: 'mem-time' }, timeText(f.h, f.m));
      case 'mul': return h('div', { class: 'mem-mul' }, `${f.a} × ${f.b}`);
      case 'num': return h('div', { class: 'mem-num' }, String(f.n));
    }
  }
  const group = (f: Face) => (f.kind === 'flag' || f.kind === 'name' ? 'g-flag' : f.kind === 'clock' || f.kind === 'time' ? 'g-clock' : f.kind === 'pic' ? 'g-pic' : 'g-mul');

  const els: HTMLButtonElement[] = cards.map((c, i) =>
    h('button', { class: `mem-card ${group(c.face)}`, onClick: () => onTap(i) },
      h('div', { class: 'mem-inner' },
        h('div', { class: 'mem-face mem-back', html: CARD_BACK }),
        h('div', { class: 'mem-face mem-front' }, faceEl(c.face)),
      ),
    ),
  );
  board.append(...els);

  function layout() {
    const W = boardWrap.clientWidth;
    const H = boardWrap.clientHeight;
    if (!W || !H) return;
    const em = parseFloat(getComputedStyle(root).fontSize) || 16;
    const gap = Math.round(em * 0.6);
    // leave room for the cards' drop shadow
    const L = fitGrid(cards.length, W - em * 0.3, H - em * 0.4, gap);
    board.style.gridTemplateColumns = `repeat(${L.cols}, ${L.w}px)`;
    board.style.gridAutoRows = `${L.h}px`;
    board.style.gridGap = `${gap}px`;
    board.style.gap = `${gap}px`;
    const fs = Math.max(9, Math.round(Math.min(L.w, L.h) * 0.2));
    board.style.fontSize = `${fs}px`;
    for (const n of names) n.el.style.fontSize = `${Math.floor(Math.min(fs * 1.1, (L.w * 0.86) / (0.58 * n.longest)))}px`;
  }

  function renderBar() {
    if (players.length === 1) {
      soloPairs = h('b', null, `0 / ${cfg.pairs}`);
      soloMisses = h('b', null, '0');
      bar.replaceChildren(
        h('div', { class: 'mem-chip solo' }, h('span', null, S.pairs), soloPairs),
        h('div', { class: 'mem-chip solo' }, h('span', null, S.misses), soloMisses),
      );
      return;
    }
    bar.replaceChildren(h('div', { class: 'mem-chips' }, ...players.map((p) => p.chip)), turnEl);
  }

  function updateTurn() {
    const p = players[turn];
    root.style.setProperty('--c', p.color);
    if (players.length === 1) return;
    players.forEach((q, i) => q.chip.classList.toggle('active', i === turn));
    turnEl.textContent = S.turnLabel(p.name);
    replay(turnEl, 'pop');
  }

  function start(n: number) {
    players = (n === 1 ? [{ color: SOLO_COLOR }] : PLAYER_COLORS.slice(0, n)).map((pc, i) => {
      const scoreEl = h('b', { class: 'mem-chip-score' }, '0');
      const chip = h('div', { class: 'mem-chip', style: { '--pc': pc.color } },
        h('span', { class: 'mem-chip-badge' }, String(i + 1)),
        h('span', { class: 'mem-chip-name' }, S.player(i + 1)),
        scoreEl,
      );
      return { name: S.player(i + 1), color: pc.color, score: 0, chip, scoreEl };
    });
    root.className = `mem${n > 1 ? ' multi' : ''}`;
    renderBar();
    root.replaceChildren(bar, boardWrap);
    updateTurn();
    layout();
    ctx.setProgress(0, cfg.pairs);
    ctx.mascot.say(n > 1 ? S.introMulti : cfg.mixed ? S.introHard : S.intro, 'wave', 5000);
  }

  /** Owl hint after two different cards: why it is not a pair / what to look for. */
  function missHint(a: number, partnerSeen: boolean): string {
    if (partnerSeen) return S.seenBefore;
    if (!cfg.mixed) return S.notPair;
    const f = cards[a].face;
    switch (f.kind) {
      case 'flag': return S.flagIs(flagName(f.code, ctx.lang));
      case 'name': return S.findFlag(flagName(f.code, ctx.lang));
      case 'clock': return S.clockIs(timeText(f.h, f.m));
      case 'time': return S.findClock(timeText(f.h, f.m));
      case 'mul': return S.mulIs(f.a, f.b, f.a * f.b);
      case 'num': return S.findMul(f.n);
      default: return S.notPair;
    }
  }

  function onTap(i: number) {
    if (busy || matched[i] || i === first || !players.length) return;
    const el = els[i];
    el.classList.add('open');
    if (first < 0) {
      first = i;
      seen[i] = true;
      ctx.sfx.step();
      return;
    }
    const a = first;
    const b = i;
    first = -1;
    const partnerOf = (k: number) => cards.findIndex((c, j) => j !== k && c.pair === cards[k].pair);
    // "you could have known": the partner of either card was face-up before and is not the other card
    const partnerSeen = (seen[partnerOf(a)] && partnerOf(a) !== b) || (seen[partnerOf(b)] && partnerOf(b) !== a);
    seen[b] = true;
    const p = players[turn];

    if (cards[a].pair === cards[b].pair) {
      matched[a] = matched[b] = true;
      found++;
      p.score++;
      p.scoreEl.textContent = String(p.score);
      if (soloPairs) soloPairs.textContent = `${found} / ${cfg.pairs}`;
      ctx.setProgress(found, cfg.pairs);
      ctx.sfx.correct();
      busy = true;
      later(() => {
        for (const k of [a, b]) {
          els[k].classList.add('matched');
          els[k].style.setProperty('--mc', p.color);
          replay(els[k], 'mem-match');
        }
        ctx.celebrate('small');
        busy = false;
        if (found >= cfg.pairs) {
          busy = true;
          later(end, 1000);
        } else if (players.length > 1) {
          ctx.mascot.say(S.again(p.name), 'happy', 2500);
          replay(p.chip, 'pop');
        } else {
          ctx.mascot.say(praise(), 'happy', 1800);
        }
      }, FLIP_MS);
      return;
    }

    misses++;
    if (soloMisses) soloMisses.textContent = String(misses);
    busy = true;
    later(() => {
      ctx.sfx.wrong();
      replay(els[a], 'shake');
      replay(els[b], 'shake');
    }, FLIP_MS);
    const next = players.length > 1 ? (turn + 1) % players.length : turn;
    const hint = missHint(a, partnerSeen);
    ctx.mascot.say(players.length > 1 ? `${hint} ${S.turn(players[next].name)}` : hint, partnerSeen ? 'think' : 'sad', cfg.showMs + 2500);
    later(() => {
      els[a].classList.remove('open');
      els[b].classList.remove('open');
      turn = next;
      updateTurn();
      busy = false;
    }, FLIP_MS + cfg.showMs);
  }

  function end() {
    const stars = starsFromMistakes(misses, cfg.stars[0], cfg.stars[1]);
    if (players.length === 1) return ctx.finish({ stars, message: S.soloEnd(misses) });
    const best = Math.max(...players.map((p) => p.score));
    const winners = players.filter((p) => p.score === best);
    let message = winners.length === 1
      ? S.winner(winners[0].name, S.pairN(best))
      : S.tie(winners.map((p) => p.name).join(', '), S.pairN(best));
    const rest = players.filter((p) => p.score !== best).sort((x, y) => y.score - x.score);
    if (rest.length) message += '  ' + rest.map((p) => `${p.name}: ${S.pairN(p.score)}`).join(' · ');
    ctx.finish({ stars, message });
  }

  const stopResize = onResize(boardWrap, layout);
  renderSetup();
  ctx.mascot.say(S.hello, 'wave', 4000);

  return () => {
    alive = false;
    timers.forEach((t) => clearTimeout(t));
    stopResize();
  };
}

const game: GameModule = {
  id: 'memory',
  order: 10,
  players: 4,
  title: { en: 'Memory Pairs', sk: 'Pexeso' },
  tagline: { en: 'Flip the cards and find the pairs', sk: 'Otáčaj karty a hľadaj dvojice' },
  color: '#FF5D8F',
  icon: ICON,
  howTo: [
    { en: 'Choose how many players (1 to 4).', sk: 'Vyber, koľko hráčov hrá (1 až 4).' },
    { en: 'Tap two cards to turn them over.', sk: 'Ťukni na dve karty a otočia sa.' },
    { en: 'A pair stays open. Other cards turn back – remember where they are!', sk: 'Dvojica zostane otočená. Iné karty sa otočia späť – zapamätaj si, kde sú!' },
    { en: 'Found a pair? Play again! The most pairs wins.', sk: 'Nájdeš dvojicu? Hráš ešte raz! Vyhráva ten, kto má najviac dvojíc.' },
  ],
  levels: [
    { id: 'easy', description: { en: '12 cards, same pictures', sk: '12 kariet, rovnaké obrázky' } },
    { id: 'medium', description: { en: '16 cards, same pictures', sk: '16 kariet, rovnaké obrázky' } },
    { id: 'hard', description: { en: '20 cards: flag + country, clock + time, 3 × 4 + 12', sk: '20 kariet: vlajka + krajina, hodiny + čas, 3 × 4 + 12' } },
  ],
  mount,
};
export default game;
