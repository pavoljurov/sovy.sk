import type { GameContext, GameModule, LevelId, Stars } from '../../platform/types';
import type { Lang } from '../../platform/i18n';
import { h, onResize, replay } from '../../platform/dom';
import { praise } from '../../platform/config';
import { pickLang } from '../../platform/i18n';
import { storage } from '../../platform/storage';
import {
  CELLS, SIZE, adjacent, buildDict, decode, generate, isTarget, isWord, points, tileLabel,
  type Board, type Dict, type LevelRule,
} from './logic';
import './words.css';

const ICON = `<svg viewBox="0 0 64 64"><rect x="7" y="7" width="50" height="50" rx="8" fill="#fff" stroke="#2B2440" stroke-width="4"/><path d="M24 7v50M40 7v50M7 24h50M7 40h50" stroke="#2B2440" stroke-width="2.5"/><path d="M15.5 15.5L32 32L48.5 32" fill="none" stroke="#FF8A3D" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><circle cx="15.5" cy="15.5" r="5" fill="#FFD23F" stroke="#2B2440" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="#FFD23F" stroke="#2B2440" stroke-width="2"/><circle cx="48.5" cy="32" r="5" fill="#FFD23F" stroke="#2B2440" stroke-width="2"/></svg>`;

const CLEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/** Boards per game. */
const BOARDS = 5;

interface Cfg extends LevelRule {
  /** Slots show the first letter of every word from the start. */
  firstLetter: boolean;
}
const CFG: Record<LevelId, Cfg> = {
  easy: { tiers: 1, maxLen: 5, minWords: 5, maxWords: 14, goal: 8, bigWord: 0, seedLen: [4, 5], firstLetter: true },
  medium: { tiers: 2, maxLen: 6, minWords: 8, maxWords: 22, goal: 12, bigWord: 0, seedLen: [5, 6], firstLetter: false },
  hard: { tiers: 2, maxLen: 9, minWords: 10, maxWords: 30, goal: 16, bigWord: 6, seedLen: [6, 8], firstLetter: false },
};

const en = {
  loading: 'Loading words…',
  loadFailed: 'The words did not load. Check the connection and try again.',
  intro: 'Tap letters that touch – also diagonally – to make a word!',
  introBig: 'One long word of 6+ letters is hidden here too!',
  board: (i: number, n: number) => `Board ${i} of ${n}`,
  score: (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`,
  found: (a: number, b: number) => `Found ${a} of ${b}`,
  clear: 'Clear',
  check: 'Check',
  hint: 'Hint',
  showAll: 'Show all words',
  next: 'Next board',
  finish: 'Finish',
  bonusTitle: 'Bonus words',
  tooShort: 'A word needs at least 3 letters.',
  already: 'You already have that one!',
  notWord: (w: string) => `"${w}" is not in my word list. Try another!`,
  bonus: (w: string) => `"${w}" is a real word – bonus!`,
  great: (w: string, p: number) => `${w}! +${p}`,
  allFound: 'Every word found! +5 bonus!',
  revealed: 'Here are the words you missed. Tap a word to see where it hides.',
  hinted: 'Look at the glowing letter – a word starts there.',
  hintCost: '(−1 point)',
  noHint: 'No more hints – the words are almost spelled out!',
  last: 'Last board!',
  record: 'a new record!',
  best: 'best',
};
const sk: typeof en = {
  loading: 'Načítavam slová…',
  loadFailed: 'Slová sa nenačítali. Skontroluj pripojenie a skús znova.',
  intro: 'Ťukaj na písmená, ktoré sa dotýkajú – aj šikmo – a poskladaj slovo!',
  introBig: 'Ukrýva sa tu aj jedno dlhé slovo so 6 a viac písmenami!',
  board: (i, n) => `Mriežka ${i} z ${n}`,
  score: (n) => `${n} ${n === 1 ? 'bod' : n >= 2 && n <= 4 ? 'body' : 'bodov'}`,
  found: (a, b) => `Nájdené ${a} z ${b}`,
  clear: 'Zmazať',
  check: 'Skontrolovať',
  hint: 'Pomoc',
  showAll: 'Ukáž všetky slová',
  next: 'Ďalšia mriežka',
  finish: 'Koniec',
  bonusTitle: 'Bonusové slová',
  tooShort: 'Slovo musí mať aspoň 3 písmená.',
  already: 'Toto slovo už máš!',
  notWord: (w) => `„${w}“ nepoznám. Skús iné slovo!`,
  bonus: (w) => `„${w}“ je naozajstné slovo – bonus!`,
  great: (w, p) => `${w}! +${p}`,
  allFound: 'Všetky slová sú nájdené! Bonus +5!',
  revealed: 'Tu sú slová, ktoré chýbali. Ťukni na slovo a uvidíš, kde sa skrýva.',
  hinted: 'Pozri na svietiace písmeno – tam začína slovo.',
  hintCost: '(−1 bod)',
  noHint: 'Viac pomoci už nie je – slová sú skoro celé!',
  last: 'Posledná mriežka!',
  record: 'nový rekord!',
  best: 'najlepšie',
};

/* ---------- word data (loaded on demand, one language at a time) ---------- */

type Raw = { default: string };
const LOADERS: Record<Lang, () => Promise<[Raw, Raw]>> = {
  en: () => Promise.all([import('./data/en-target.tsv?raw'), import('./data/en-accept.txt?raw')]),
  sk: () => Promise.all([import('./data/sk-target.tsv?raw'), import('./data/sk-accept.txt?raw')]),
};
const dictCache: Partial<Record<Lang, Dict>> = {};
function loadDict(lang: Lang): Promise<Dict> {
  const cached = dictCache[lang];
  if (cached) return Promise.resolve(cached);
  return LOADERS[lang]().then(([t, a]) => (dictCache[lang] = buildDict(t.default, a.default)));
}

/** Planted words of recent boards, so the next games start elsewhere. */
const recentKey = (lang: Lang) => `words:recent:${lang}`;
const bestKey = (level: LevelId) => `words:best:${level}`;

/* ---------- game ---------- */

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  let alive = true;
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);

  const root = h('div', { class: 'wg' });
  stage.append(root);
  root.append(h('div', { class: 'wg-loading' }, S.loading));

  let stopResize = () => {};
  loadDict(ctx.lang)
    .then((d) => alive && start(d))
    .catch(() => {
      if (!alive) return;
      root.replaceChildren(h('div', { class: 'wg-loading' }, S.loadFailed));
      ctx.mascot.say(S.loadFailed, 'sad', 6000);
    });

  function start(dict: Dict) {
    let boardNo = 0;
    let score = 0;
    /** Share of target words found on each finished board (for stars). */
    const shares: number[] = [];

    // Per-board state
    let board: Board;
    let path: number[] = [];
    let found: Record<string, true> = {};
    let bonus: string[] = [];
    let hints: Record<string, number> = {};
    let revealed = false;
    let traceTimer = 0;

    /* --- static layout --- */
    const info = h('div', { class: 'wg-info' });
    const scoreEl = h('div', { class: 'wg-score' });
    const current = h('div', { class: 'wg-current' });
    const tilesEl = h('div', { class: 'wg-tiles' });
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    line.setAttribute('class', 'wg-line');
    line.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    const gridEl = h('div', { class: 'wg-grid' }, tilesEl, line);
    const tileEls = Array.from({ length: CELLS }, () => h('div', { class: 'wg-tile' }));
    tilesEl.append(...tileEls);

    const clearBtn = h('button', { class: 'btn btn-icon wg-clear', html: CLEAR_ICON, onClick: () => { ctx.sfx.tap(); setPath([]); } });
    clearBtn.setAttribute('aria-label', S.clear);
    const checkBtn = h('button', { class: 'btn btn-go wg-check', onClick: () => submit() }, S.check);
    const wordRow = h('div', { class: 'wg-wordrow' }, current, clearBtn, checkBtn);

    const slots = h('div', { class: 'wg-slots' });
    const bonusEl = h('div', { class: 'wg-bonus' });
    const hintBtn = h('button', { class: 'btn btn-warn wg-hint', onClick: () => hint() }, S.hint);
    const mainBtn: HTMLButtonElement = h('button', { class: 'btn btn-alt wg-main', onClick: () => mainAction() });
    const actions = h('div', { class: 'wg-actions' }, hintBtn, mainBtn);

    const left = h('div', { class: 'wg-left' }, wordRow, gridEl);
    const right = h('div', { class: 'wg-right' }, h('div', { class: 'wg-head' }, info, scoreEl), slots, bonusEl, actions);
    root.replaceChildren(left, right);

    stopResize = onResize(stage, (w, hgt) => {
      const vertical = hgt > w * 1.05;
      root.classList.toggle('vertical', vertical);
      const em = parseFloat(getComputedStyle(root).fontSize) || 16;
      const size = vertical
        ? Math.min(w - 2 * em, hgt * 0.46)
        : Math.min(hgt - 6 * em, w * 0.5);
      gridEl.style.width = gridEl.style.height = `${Math.max(150, Math.floor(size))}px`;
      gridEl.style.fontSize = `${Math.max(150, size) / SIZE * 0.42}px`;
    });

    /* --- input: tap tiles one by one, or swipe across them --- */
    let drag: { start: number; moved: boolean; before: number[] } | null = null;

    function cellAt(x: number, y: number, strict: boolean): number {
      const r = gridEl.getBoundingClientRect();
      const cw = r.width / SIZE;
      const c = Math.floor((x - r.left) / cw), rr = Math.floor((y - r.top) / cw);
      if (c < 0 || c >= SIZE || rr < 0 || rr >= SIZE) return -1;
      if (strict) {
        // While swiping, only count the middle of a tile, so diagonals don't clip a neighbour.
        const dx = (x - r.left) / cw - c - 0.5, dy = (y - r.top) / cw - rr - 0.5;
        if (dx * dx + dy * dy > 0.16) return -1;
      }
      return rr * SIZE + c;
    }

    gridEl.addEventListener('pointerdown', (e) => {
      if (revealed) return;
      const i = cellAt(e.clientX, e.clientY, false);
      if (i < 0) return;
      e.preventDefault();
      try { gridEl.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      drag = { start: i, moved: false, before: path.slice() };
      tapTile(i);
    });
    gridEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const i = cellAt(e.clientX, e.clientY, true);
      if (i < 0 || i === drag.start && !drag.moved) return;
      if (!drag.moved) {
        // First move: keep the word if the press just added the pressed tile to it,
        // otherwise the swipe starts a fresh word from the pressed tile.
        drag.moved = true;
        const extended = path.length === drag.before.length + 1 && path[path.length - 1] === drag.start;
        if (!extended) setPath([drag.start]);
      }
      if (i === path[path.length - 1]) return;
      if (path.length >= 2 && i === path[path.length - 2]) {
        // Swiping back undoes the last letter.
        setPath(path.slice(0, -1));
        return;
      }
      if (path.indexOf(i) >= 0 || !adjacent(path[path.length - 1], i)) return;
      ctx.sfx.step();
      setPath(path.concat(i));
    });
    const endDrag = () => {
      if (drag && drag.moved && path.length >= 2) submit();
      drag = null;
    };
    gridEl.addEventListener('pointerup', endDrag);
    gridEl.addEventListener('pointercancel', () => (drag = null));

    function tapTile(i: number) {
      const last = path[path.length - 1];
      if (i === last) setPath(path.slice(0, -1));                    // tap the last letter again: undo it
      else if (path.indexOf(i) >= 0) setPath(path.slice(0, path.indexOf(i) + 1)); // go back to that letter
      else if (path.length && adjacent(last, i)) setPath(path.concat(i));
      else setPath([i]);                                             // not touching: start a new word
      ctx.sfx.tap();
    }

    /* --- rendering --- */
    const word = () => path.map((i) => board.tiles[i]).join('');
    const upper = (enc: string) => decode(enc).toUpperCase();

    function setPath(p: number[]) {
      path = p;
      const last = path[path.length - 1];
      tileEls.forEach((el, i) => {
        el.classList.toggle('on', path.indexOf(i) >= 0);
        el.classList.toggle('next', path.length > 0 && path.indexOf(i) < 0 && adjacent(last, i));
      });
      current.textContent = upper(word());
      current.classList.toggle('empty', !path.length);
      checkBtn.disabled = path.length < 1;
      drawLine(path);
    }

    function drawLine(p: number[], cls = '') {
      const pts = p.map((i) => `${(i % SIZE) + 0.5},${Math.floor(i / SIZE) + 0.5}`).join(' ');
      line.innerHTML = p.length
        ? `<polyline class="${cls}" points="${pts}"/>` + (p.length === 1 ? `<circle cx="${(p[0] % SIZE) + 0.5}" cy="${Math.floor(p[0] / SIZE) + 0.5}" r=".12"/>` : '')
        : '';
    }

    function renderSlots() {
      slots.replaceChildren(
        ...board.words.map(([w, p]) => {
          const isFound = !!found[w];
          const shown = isFound || revealed ? w.length : Math.max(hints[w] || 0, cfg.firstLetter ? 1 : 0);
          const chip = h(
            'button',
            { class: `wg-slot${isFound ? ' found' : revealed ? ' missed' : ''}`, onClick: () => trace(p, chip) },
            ...w.split('').map((t, k) => h('span', { class: k < shown ? 'l' : 'l blank' }, k < shown ? tileLabel(t) : '')),
          );
          chip.disabled = !isFound && !revealed;
          return chip;
        }),
      );
      const many = board.words.length;
      slots.className = `wg-slots${many > 20 ? ' tiny' : many > 12 ? ' small' : ''}`;
      bonusEl.replaceChildren(
        ...(bonus.length ? [h('span', { class: 'wg-bonus-title' }, S.bonusTitle + ':'), ...bonus.map((w) => h('span', { class: 'wg-bonus-word' }, upper(w)))] : []),
      );
      const n = board.words.filter(([w]) => found[w]).length;
      info.textContent = `${S.board(boardNo + 1, BOARDS)} · ${S.found(n, board.words.length)}`;
      scoreEl.textContent = S.score(score);
      mainBtn.textContent = revealed ? (boardNo + 1 >= BOARDS ? S.finish : S.next) : S.showAll;
      mainBtn.className = `btn ${revealed ? 'btn-go' : 'btn-alt'} wg-main`;
      hintBtn.disabled = revealed;
      checkBtn.disabled = revealed || path.length < 1;
      root.classList.toggle('done', revealed);
    }

    /** Show where a word lies on the grid. */
    function trace(p: number[], chip: HTMLElement) {
      if (path.length && !revealed) setPath([]);
      ctx.sfx.tap();
      replay(chip, 'pop');
      clearTimeout(traceTimer);
      tileEls.forEach((el, i) => el.classList.toggle('trace', p.indexOf(i) >= 0));
      drawLine(p, 'trace');
      traceTimer = window.setTimeout(() => {
        if (!alive) return;
        tileEls.forEach((el) => el.classList.remove('trace'));
        drawLine(path);
      }, 1800);
    }

    function flashTiles(p: number[], cls: string) {
      p.forEach((i) => replay(tileEls[i], cls));
    }

    /* --- actions --- */
    function submit() {
      if (revealed || !path.length) return;
      const w = word();
      const p = path.slice();
      if (p.length < 3) {
        ctx.sfx.wrong();
        replay(current, 'shake');
        ctx.mascot.say(S.tooShort, 'think', 3000);
        return;
      }
      const shown = upper(w);
      if (isTarget(dict, cfg, w) && board.words.some(([x]) => x === w)) {
        if (found[w]) {
          ctx.sfx.tap();
          replay(current, 'shake');
          ctx.mascot.say(S.already, 'think', 2500);
          setPath([]);
          return;
        }
        found[w] = true;
        const pts = points(p.length);
        score += pts;
        ctx.sfx.correct();
        flashTiles(p, 'good');
        setPath([]);
        renderSlots();
        const left = board.words.filter(([x]) => !found[x]).length;
        if (!left) {
          score += 5;
          ctx.celebrate('big');
          ctx.mascot.say(S.allFound, 'cheer', 4000);
          reveal(true);
        } else {
          if (p.length >= 5) ctx.celebrate('small');
          ctx.mascot.say(Math.random() < 0.5 ? S.great(shown, pts) : `${praise()} +${pts}`, 'happy', 2000);
        }
        return;
      }
      if (isWord(dict, w)) {
        if (bonus.indexOf(w) >= 0) {
          ctx.sfx.tap();
          ctx.mascot.say(S.already, 'think', 2500);
        } else {
          bonus.push(w);
          score += 1;
          ctx.sfx.pop();
          flashTiles(p, 'good');
          ctx.mascot.say(S.bonus(shown) + ' +1', 'happy', 2500);
        }
        setPath([]);
        renderSlots();
        return;
      }
      // Not a word: no penalty, kids are allowed to experiment.
      ctx.sfx.wrong();
      replay(current, 'shake');
      ctx.mascot.say(S.notWord(shown), 'think', 3000);
      setPath([]);
    }

    function hint() {
      if (revealed) return;
      // Shortest word not found yet that still has hidden letters.
      const start = cfg.firstLetter ? 1 : 0;
      const cand = board.words.filter(([w]) => !found[w] && Math.max(hints[w] || 0, start) < w.length - 1);
      if (!cand.length) {
        ctx.mascot.say(S.noHint, 'think', 3000);
        return;
      }
      const [w, p] = cand[0];
      const shown = Math.max(hints[w] || 0, start) + 1;
      hints[w] = shown;
      score = Math.max(0, score - 1);
      ctx.sfx.pop();
      setPath([]);
      renderSlots();
      tileEls.forEach((el) => el.classList.remove('glow'));
      p.slice(0, shown).forEach((i) => tileEls[i].classList.add('glow'));
      later(() => tileEls.forEach((el) => el.classList.remove('glow')), 3500);
      ctx.mascot.say(`${S.hinted} ${S.hintCost}`, 'think', 3500);
    }

    function reveal(all: boolean) {
      revealed = true;
      setPath([]);
      const n = board.words.filter(([w]) => found[w]).length;
      shares.push(board.words.length ? n / board.words.length : 1);
      renderSlots();
      if (!all) ctx.mascot.say(S.revealed, 'wave', 5000);
      ctx.setProgress(boardNo + 1, BOARDS);
    }

    function mainAction() {
      ctx.sfx.tap();
      if (!revealed) return reveal(false);
      boardNo++;
      if (boardNo >= BOARDS) return end();
      newBoard();
    }

    function end() {
      const avg = shares.reduce((s, x) => s + x, 0) / shares.length;
      const stars: Stars = avg >= 0.7 ? 3 : avg >= 0.45 ? 2 : avg >= 0.2 || score > 0 ? 1 : 0;
      const best = Number(storage.get(bestKey(ctx.level))) || 0;
      if (score > best) storage.set(bestKey(ctx.level), String(score));
      const message = score > best ? `${S.score(score)} – ${S.record}` : `${S.score(score)} (${S.best}: ${best})`;
      ctx.finish({ stars, message });
    }

    function newBoard() {
      let recent: string[] = [];
      try { recent = JSON.parse(storage.get(recentKey(ctx.lang)) || '[]'); } catch { /* ignore */ }
      board = generate(dict, cfg, recent) || generate(dict, cfg, [])!;
      storage.set(recentKey(ctx.lang), JSON.stringify([board.seed].concat(recent).slice(0, 40)));
      path = [];
      found = {};
      bonus = [];
      hints = {};
      revealed = false;
      tileEls.forEach((el, i) => {
        el.textContent = tileLabel(board.tiles[i]);
        el.className = 'wg-tile';
        replay(el, 'pop');
      });
      setPath([]);
      renderSlots();
      if (boardNo === BOARDS - 1) ctx.mascot.say(S.last, 'wave', 2500);
    }

    ctx.setProgress(0, BOARDS);
    newBoard();
    ctx.mascot.say(cfg.bigWord ? `${S.intro} ${S.introBig}` : S.intro, 'wave', 6000);
  }

  return () => {
    alive = false;
    stopResize();
  };
}

const game: GameModule = {
  id: 'words',
  order: 9,
  title: { en: 'Word Grid', sk: 'Slovná mriežka' },
  tagline: { en: 'Find words hidden in the letters', sk: 'Nájdi slová ukryté v písmenách' },
  color: '#FF5D8F',
  icon: ICON,
  howTo: [
    { en: 'Tap letters that touch each other – sideways or diagonally – to make a word.', sk: 'Ťukaj na písmená, ktoré sa dotýkajú – vedľa seba alebo šikmo – a poskladaj slovo.' },
    { en: 'Each letter can be used once in a word. Find as many words as you can!', sk: 'Každé písmeno môžeš v slove použiť len raz. Nájdi čo najviac slov!' },
    { en: 'Longer words give more points. Stuck? Show all words and go on to the next board.', sk: 'Dlhšie slová dávajú viac bodov. Nevieš ďalej? Ukáž všetky slová a choď na ďalšiu mriežku.' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Short everyday words, first letters shown', sk: 'Krátke známe slová, prvé písmeno je ukázané' } },
    { id: 'medium', description: { en: 'More words, up to 6 letters', sk: 'Viac slov, až 6 písmen' } },
    { id: 'hard', description: { en: 'Lots of words and one long word', sk: 'Veľa slov a jedno dlhé slovo' } },
  ],
  mount,
};
export default game;
