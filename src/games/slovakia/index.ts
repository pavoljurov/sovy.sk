import type { GameContext, GameModule, LevelId, Stars } from '../../platform/types';
import { h, onResize, replay } from '../../platform/dom';
import { shuffle } from '../../platform/util';
import { storage } from '../../platform/storage';
import { pickLang } from '../../platform/i18n';
import { PLACES, REGIONS, type Category, type Place } from './places';
import { DANUBE, H, NEIGHBOURS, REGION_PATHS, RIVERS, SLOVAKIA, W, project, unproject } from './map';
import './slovakia.css';

const SK_ICON_PATH = 'M60 32.1L57.7 37.9L56.1 39.6L55.6 42.4L52 43L49 39.7L45.9 40.8L42.9 39.6L40 40.1L38.2 43.9L34.3 46.1L31.3 44.7L30.2 45L29.4 46.8L23.6 47.5L22.7 48.5L23.4 50.5L21.9 51.4L13.7 51.8L11.2 50.6L8.8 48.1L6.2 47.5L4 42.6L6 36.5L7.2 35.3L10.8 36L14 34.3L14.5 33L16.1 32.5L16.9 29.3L20.8 25.9L24.5 25.7L24.8 27.4L26.6 27.3L29.6 24.2L31.4 27.2L32.8 27.3L32.9 30.4L34.4 29.8L35.5 30.6L36.4 28.6L38.1 27.4L41.8 27.2L44.1 28.9L45.6 27.9L45.4 27L46.8 27.2L47.4 26.5L52.9 27.6L55.1 30.2L60 32.1Z';
/** Map pin: tip at (0,0), 1 unit ≈ 1/34 of the pin height. */
const PIN = 'M0 0C-3-8-12-13-12-22A12 12 0 1 1 12-22C12-13 3-8 0 0Z';
const ICON = `<svg viewBox="0 0 64 64"><path d="${SK_ICON_PATH}" fill="#4CC95B" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/><g transform="translate(40 38) scale(1.05)"><path d="${PIN}" fill="#FF4D5E" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-22" r="4.5" fill="#fff" stroke="#2B2440" stroke-width="2.5"/></g></svg>`;

/* ---------- difficulty ---------- */

interface Cfg {
  rounds: number;
  /** highest place tier in the pool (1 = only famous places) */
  tier: 1 | 2 | 3;
  /** draw the borders of the 8 regions */
  regions: boolean;
  /** highlight the target's region and name it */
  showRegion: boolean;
  /** average km (of the best player) for 3 / 2 stars */
  stars: [number, number];
}

const CFG: Record<LevelId, Cfg> = {
  easy: { rounds: 6, tier: 1, regions: true, showRegion: true, stars: [15, 35] },
  medium: { rounds: 8, tier: 2, regions: true, showRegion: false, stars: [20, 40] },
  hard: { rounds: 10, tier: 3, regions: false, showRegion: false, stars: [25, 50] },
};

/** km: "almost exact" and "good" guesses */
const EXACT = 10;
const GOOD = 30;

const COLORS = ['#FF4D5E', '#3DA5FF', '#4CC95B', '#FFD23F'];

/* ---------- texts ---------- */

type Dir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const en = {
  howMany: 'How many players?',
  hello: 'Play alone or with friends – up to 4 players!',
  players: (n: number) => (n === 1 ? '1 player' : `${n} players`),
  player: (i: number) => `Player ${i}`,
  where: 'Where is it?',
  turn: (p: string) => `${p}: tap the map!`,
  tapMap: 'Tap the map!',
  done: 'Done',
  next: 'Next',
  finish: 'Results',
  less: 'Fewer km = better',
  intro: 'Where is this place? Tap the spot on the map!',
  introMulti: 'Take turns! While one player taps, the others don’t look.',
  yourTurn: (p: string) => `${p}, your turn! No peeking, everyone else!`,
  exact: (km: number) => `Wow! Only ${km} km away!`,
  good: (km: number) => `Good! ${km} km away.`,
  far: (name: string, dir: Dir, r: number) => `${name} is further ${en.dirs[dir]}, in the ${REGIONS[r].en}.`,
  best: (p: string, km: number) => `${p} is closest: ${km} km!`,
  regionIs: (r: number) => `It is in the ${REGIONS[r].en}.`,
  region: (r: number): string => REGIONS[r].en,
  dirs: { n: 'north', ne: 'north-east', e: 'east', se: 'south-east', s: 'south', sw: 'south-west', w: 'west', nw: 'north-west' } as Record<Dir, string>,
  soloEnd: (total: number, avg: number) => `Total ${total} km, about ${avg} km per place.`,
  winner: (p: string, total: number) => `${p} wins with ${total} km!`,
  tie: (ps: string, total: number) => `It’s a tie! ${ps}: ${total} km.`,
  neighbours: ['Czechia', 'Poland', 'Ukraine', 'Hungary', 'Austria'],
  cats: {
    city: 'Town', castle: 'Castle', peak: 'Mountain', water: 'Lake / water', cave: 'Cave',
    village: 'Village', church: 'Church / monastery', spa: 'Spa', nature: 'Nature', sight: 'Sight',
  } as Record<Category, string>,
};
const sk: typeof en = {
  howMany: 'Koľko hráčov hrá?',
  hello: 'Hrať sa dá aj s kamarátmi – až 4 hráči!',
  players: (n) => (n === 1 ? '1 hráč' : `${n} hráči`),
  player: (i) => `Hráč ${i}`,
  where: 'Kde to je?',
  turn: (p) => `${p}: ťukni na mapu!`,
  tapMap: 'Ťukni na mapu!',
  done: 'Hotovo',
  next: 'Ďalej',
  finish: 'Výsledky',
  less: 'Menej km = lepšie',
  intro: 'Kde je toto miesto? Ťukni na mape na to miesto!',
  introMulti: 'Striedajte sa! Kým jeden ťuká, ostatní nepozerajú.',
  yourTurn: (p) => `Na rade je ${p}. Ostatní nepozerajú!`,
  exact: (km) => `Wow! Len ${km} km vedľa!`,
  good: (km) => `Dobre! ${km} km vedľa.`,
  far: (name, dir, r) => `${name} je ďalej ${sk.dirs[dir]}, ${REGIONS[r].skIn}.`,
  best: (p, km) => `Najbližšie je ${p}: ${km} km!`,
  regionIs: (r) => `Leží ${REGIONS[r].skIn}.`,
  region: (r) => REGIONS[r].sk,
  dirs: { n: 'na sever', ne: 'na severovýchod', e: 'na východ', se: 'na juhovýchod', s: 'na juh', sw: 'na juhozápad', w: 'na západ', nw: 'na severozápad' },
  soloEnd: (total, avg) => `Spolu ${total} km, priemerne ${avg} km na jedno miesto.`,
  winner: (p, total) => `Vyhráva ${p} – spolu ${total} km!`,
  tie: (ps, total) => `Remíza! ${ps}: ${total} km.`,
  neighbours: ['Česko', 'Poľsko', 'Ukrajina', 'Maďarsko', 'Rakúsko'],
  cats: {
    city: 'Mesto', castle: 'Hrad / zámok', peak: 'Vrch', water: 'Jazero / voda', cave: 'Jaskyňa',
    village: 'Obec', church: 'Kostol / kláštor', spa: 'Kúpele', nature: 'Príroda', sight: 'Zaujímavosť',
  },
};

/* ---------- category icons (24×24, ink outline) ---------- */

const ink = 'stroke="#2B2440" stroke-width="1.8" stroke-linejoin="round"';
const CAT_ICON: Record<Category, string> = {
  city: `<rect x="3" y="9" width="7" height="12" fill="#FFD23F" ${ink}/><rect x="10" y="4" width="8" height="17" fill="#3DA5FF" ${ink}/><rect x="18" y="12" width="3.5" height="9" fill="#FF8A3D" ${ink}/>`,
  castle: `<path d="M4 21V9h3v2h2V9h3v2h2V9h3v12z" fill="#C9B8FF" ${ink}/><path d="M10 21v-5a2 2 0 0 1 4 0v5z" fill="#2B2440"/><path d="M12 9V2l5 2-5 2" fill="#FF4D5E" ${ink}/>`,
  peak: `<path d="M1.5 21L9 7l4 6 3-4 6.5 12z" fill="#9AD17F" ${ink}/><path d="M9 7l-2.4 4.5 2.4-1 2 1.6z" fill="#fff" ${ink}/>`,
  water: `<path d="M2 9c3-2.5 5 2.5 8 0s5 2.5 8 0 3 1 4 1M2 14c3-2.5 5 2.5 8 0s5 2.5 8 0 3 1 4 1M2 19c3-2.5 5 2.5 8 0s5 2.5 8 0 3 1 4 1" fill="none" stroke="#3DA5FF" stroke-width="2.4" stroke-linecap="round"/>`,
  cave: `<path d="M1.5 21C2 10 7 4 12 4s10 6 10.5 17z" fill="#B59A7A" ${ink}/><path d="M7 21c0-5 2.2-9 5-9s5 4 5 9z" fill="#2B2440"/>`,
  village: `<path d="M3 11l9-7 9 7" fill="#FF4D5E" ${ink}/><rect x="5" y="10.5" width="14" height="10.5" fill="#FFF6E9" ${ink}/><rect x="10" y="14" width="4" height="7" fill="#FF8A3D" ${ink}/>`,
  church: `<path d="M12 1.5v5M9.5 3.5h5" stroke="#2B2440" stroke-width="1.8" stroke-linecap="round"/><path d="M8 21V10l4-4 4 4v11z" fill="#FFD23F" ${ink}/><path d="M3 21v-7l5-3v10zM21 21v-7l-5-3v10z" fill="#FFF6E9" ${ink}/>`,
  spa: `<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#1FC2AE" ${ink}/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  nature: `<path d="M12 2l6 9h-3l4 6H5l4-6H6z" fill="#4CC95B" ${ink}/><rect x="10.5" y="17" width="3" height="5" fill="#B5793E" ${ink}/>`,
  sight: `<path d="M12 2.5l2.8 6 6.4.7-4.8 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4-4.8-4.4 6.4-.7z" fill="#FF8A3D" ${ink}/>`,
};
const catIcon = (c: Category) => `<svg viewBox="0 0 24 24">${CAT_ICON[c]}</svg>`;

/* ---------- helpers ---------- */

const RECENT_KEY = 'slovakia:recent';

/** Great-circle distance in km. */
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
const placeDist = (a: Place, b: Place) => distKm(a.lat, a.lon, b.lat, b.lon);

function loadRecent(): string[] {
  try {
    const v = JSON.parse(storage.get(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Picks the places for one game. Places not seen recently come first (in random order),
 * then the ones seen longest ago, so the whole pool cycles before anything repeats.
 * A game mixes categories and never asks two places closer than 15 km to each other.
 */
function choosePlaces(pool: Place[], n: number): Place[] {
  const recent = loadRecent();
  const age = new Map(recent.map((id, i) => [id, i] as [string, number]));
  const fresh = shuffle(pool.filter((p) => !age.has(p.id)));
  const seen = pool.filter((p) => age.has(p.id)).sort((a, b) => (age.get(a.id) ?? 0) - (age.get(b.id) ?? 0));
  const ordered = [...fresh, ...seen];
  const maxPerCat = Math.ceil(n / 3);
  const out: Place[] = [];
  for (const strict of [true, false]) {
    for (const p of ordered) {
      if (out.length >= n) break;
      if (out.indexOf(p) >= 0) continue;
      if (strict && (out.filter((q) => q.cat === p.cat).length >= maxPerCat || out.some((q) => placeDist(p, q) < 15))) continue;
      out.push(p);
    }
  }
  const ids = out.map((p) => p.id);
  storage.set(RECENT_KEY, JSON.stringify([...recent.filter((id) => ids.indexOf(id) < 0), ...ids].slice(-400)));
  return shuffle(out);
}

/** Compass direction from a to b, both in map coordinates (y grows to the south). */
function direction(ax: number, ay: number, bx: number, by: number): Dir {
  const deg = (Math.atan2(-(by - ay), bx - ax) * 180) / Math.PI; // 0 = east, 90 = north
  const dirs: Dir[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  return dirs[(Math.round(deg / 45) + 8) % 8];
}

const NS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}, ...kids: (Element | string)[]): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  for (const c of kids) el.append(c);
  return el;
}

/** Neighbour labels: [lat, lon, rotation] in the same order as the texts. */
const NEIGHBOUR_LABELS: [number, number, number][] = [
  [49.33, 17.3, 0], [49.68, 19.05, 0], [48.75, 22.72, 90], [47.79, 19.6, 0], [48.45, 16.72, -90],
];

/* ---------- game ---------- */

interface Player {
  name: string;
  color: string;
  total: number;
  guess: [number, number] | null;
  last: number;
}

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  const name = (p: Place) => (ctx.lang === 'sk' ? p.sk : p.en);
  const places = choosePlaces(PLACES.filter((p) => p.tier <= cfg.tier), cfg.rounds);

  let alive = true;
  let round = 0;
  let turn = 0;
  let phase: 'guess' | 'reveal' = 'guess';
  let players: Player[] = [];
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);

  const root = h('div', { class: 'sm' });
  stage.append(root);

  /* ---- player count ---- */
  function renderSetup() {
    const pinSvg = (c: string) =>
      `<svg viewBox="-14 -36 28 38"><path d="${PIN}" fill="${c}" stroke="#2B2440" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-22" r="4.5" fill="#fff" stroke="#2B2440" stroke-width="2.5"/></svg>`;
    root.className = 'sm sm-setup-mode';
    root.replaceChildren(
      h('div', { class: 'sm-setup' },
        h('div', { class: 'sm-setup-q' }, S.howMany),
        h('div', { class: 'sm-counts' },
          ...[1, 2, 3, 4].map((n) =>
            h('button', { class: 'btn sm-count', onClick: () => { ctx.sfx.tap(); start(n); } },
              h('span', { class: 'sm-count-pins', html: COLORS.slice(0, n).map(pinSvg).join('') }),
              h('span', null, S.players(n)),
            ),
          ),
        ),
      ),
    );
  }

  /* ---- game screen ---- */
  const nameEl = h('div', { class: 'sm-name' });
  const catEl = h('div', { class: 'sm-cat' });
  const regionEl = h('div', { class: 'sm-region' });
  const head = h('div', { class: 'sm-head' }, catEl, nameEl, regionEl);
  const mapSvg = svg('svg', { class: 'sm-map', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }) as SVGSVGElement;
  const mapBox = h('div', { class: 'sm-mapbox' }, mapSvg);
  const chips = h('div', { class: 'sm-players' });
  const action: HTMLButtonElement = h('button', { class: 'btn btn-go btn-big sm-action', onClick: onAction });
  const bar = h('div', { class: 'sm-bar' }, chips, action);

  const highlight = svg('path', { class: 'sm-highlight', d: '' });
  const overlay = svg('g', { class: 'sm-overlay' });
  {
    const base = svg('g');
    NEIGHBOURS.forEach((d) => base.append(svg('path', { class: 'sm-neigh', d })));
    S.neighbours.forEach((label, i) => {
      const [lat, lon, rot] = NEIGHBOUR_LABELS[i];
      const [x, y] = project(lat, lon);
      base.append(svg('text', { class: 'sm-neigh-label', x, y, transform: rot ? `rotate(${rot} ${x} ${y})` : '' }, label));
    });
    base.append(svg('path', { class: 'sm-land', d: SLOVAKIA }), highlight);
    if (cfg.regions) REGION_PATHS.forEach((d) => base.append(svg('path', { class: 'sm-regline', d })));
    base.append(
      svg('path', { class: 'sm-river', d: RIVERS }),
      svg('path', { class: 'sm-river sm-danube', d: DANUBE }),
      svg('path', { class: 'sm-border', d: SLOVAKIA }),
    );
    mapSvg.append(base, overlay);
  }

  /** map units per CSS pixel (the SVG is letter-boxed with "meet") */
  let unit = 1;
  let em = 16;
  function measure() {
    const r = mapSvg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) unit = Math.max(W / r.width, H / r.height);
    em = parseFloat(getComputedStyle(root).fontSize) || 16;
  }

  function toMap(e: MouseEvent): [number, number] {
    const r = mapSvg.getBoundingClientRect();
    const s = Math.max(W / r.width, H / r.height);
    const ox = (r.width - W / s) / 2;
    const oy = (r.height - H / s) / 2;
    return [(e.clientX - r.left - ox) * s, (e.clientY - r.top - oy) * s];
  }

  mapSvg.addEventListener('click', (e) => {
    if (phase !== 'guess' || !players.length) return;
    const [x, y] = toMap(e);
    if (x < 0 || y < 0 || x > W || y > H) return;
    const p = players[turn];
    const first = !p.guess;
    p.guess = [x, y];
    ctx.sfx.pop();
    drawOverlay(true);
    if (first) updateBar();
  });

  function pinEl(p: Player, fresh: boolean): SVGElement {
    const s = (em * 2.1 * unit) / 34;
    const [x, y] = p.guess as [number, number];
    // the outer <g> places the pin; the inner one is free for the CSS drop animation
    return svg('g', { transform: `translate(${x} ${y}) scale(${s})` },
      svg('g', { class: fresh ? 'sm-pin sm-drop' : 'sm-pin' },
        svg('path', { d: PIN, fill: p.color }),
        svg('circle', { cx: 0, cy: -22, r: 4.5, fill: '#fff' }),
      ),
    );
  }

  function drawOverlay(fresh = false) {
    const place = places[round];
    overlay.replaceChildren();
    if (!place) return;
    if (phase === 'guess') {
      const p = players[turn];
      if (p && p.guess) overlay.append(pinEl(p, fresh));
      return;
    }
    const [tx, ty] = project(place.lat, place.lon);
    const fs = em * 0.85 * unit;
    for (const r of [EXACT, GOOD]) overlay.append(svg('circle', { class: 'sm-ring', cx: tx, cy: ty, r }));
    players.forEach((p) => {
      if (p.guess) overlay.append(svg('line', { class: 'sm-line', x1: p.guess[0], y1: p.guess[1], x2: tx, y2: ty, stroke: p.color }));
    });
    players.forEach((p) => {
      if (!p.guess) return;
      overlay.append(pinEl(p, false));
      overlay.append(svg('text', { class: 'sm-km', x: p.guess[0], y: p.guess[1] + fs * 1.1, 'font-size': fs, 'stroke-width': fs * 0.25 }, `${p.last} km`));
    });
    const s = (em * 1.6 * unit) / 24;
    overlay.append(
      svg('g', { class: 'sm-target', transform: `translate(${tx} ${ty}) scale(${s})` },
        svg('circle', { r: 5, fill: '#fff', stroke: '#2B2440', 'stroke-width': 2.4 }),
        svg('circle', { r: 2, fill: '#2B2440' }),
      ),
    );
    const left = tx > W * 0.75;
    overlay.append(svg('text', {
      class: 'sm-target-label', x: tx + (left ? -1 : 1) * em * 0.9 * unit, y: ty - em * 0.6 * unit,
      'text-anchor': left ? 'end' : 'start', 'font-size': em * 1.05 * unit, 'stroke-width': em * 0.28 * unit,
    }, name(place)));
  }

  function updateBar() {
    chips.replaceChildren(
      ...players.map((p, i) => {
        const active = phase === 'guess' && i === turn;
        return h('div', { class: `sm-chip${active ? ' active' : ''}`, style: { '--c': p.color } },
          players.length > 1 ? h('span', { class: 'sm-chip-name' }, p.name) : null,
          phase === 'reveal'
            ? h('span', { class: 'sm-chip-add' }, `+${p.last}`)
            : players.length > 1 && i < turn ? h('span', { class: 'sm-chip-ok' }, '✓') : null,
          h('span', { class: 'sm-chip-total' }, `${p.total} km`),
        );
      }),
      h('div', { class: 'sm-less' }, S.less),
    );
    if (phase === 'guess') {
      action.textContent = S.done;
      action.disabled = !players[turn].guess;
    } else {
      action.textContent = round + 1 >= places.length ? S.finish : S.next;
      action.disabled = false;
    }
  }

  function start(n: number) {
    players = COLORS.slice(0, n).map((color, i) => ({ name: S.player(i + 1), color, total: 0, guess: null, last: 0 }));
    root.className = 'sm';
    root.replaceChildren(head, mapBox, bar);
    ctx.mascot.say(n > 1 ? S.introMulti : S.intro, 'wave', 4500);
    measure();
    beginRound();
  }

  function beginRound() {
    const place = places[round];
    ctx.setProgress(round, places.length);
    phase = 'guess';
    turn = 0;
    players.forEach((p) => (p.guess = null));
    catEl.innerHTML = catIcon(place.cat);
    catEl.append(h('span', null, S.cats[place.cat]));
    nameEl.textContent = name(place);
    regionEl.textContent = cfg.showRegion ? S.region(place.region) : '';
    regionEl.style.display = cfg.showRegion ? '' : 'none';
    highlight.setAttribute('d', cfg.showRegion ? REGION_PATHS[place.region] : '');
    replay(nameEl, 'pop');
    updateBar();
    drawOverlay();
    if (players.length > 1 && round > 0) ctx.mascot.say(S.yourTurn(players[0].name), 'idle', 3000);
  }

  function onAction() {
    if (phase === 'guess') {
      if (!players[turn].guess) return;
      ctx.sfx.tap();
      if (turn + 1 < players.length) {
        turn++;
        updateBar();
        drawOverlay();
        ctx.mascot.say(S.yourTurn(players[turn].name), 'idle', 3000);
        replay(chips, 'pop');
        return;
      }
      reveal();
    } else {
      ctx.sfx.tap();
      round++;
      if (round >= places.length) end();
      else beginRound();
    }
  }

  function reveal() {
    const place = places[round];
    phase = 'reveal';
    action.disabled = true;
    for (const p of players) {
      const [lat, lon] = unproject(...(p.guess as [number, number]));
      p.last = Math.round(distKm(lat, lon, place.lat, place.lon));
      p.total += p.last;
    }
    drawOverlay();
    updateBar();
    action.disabled = true;
    later(() => (action.disabled = false), 700);

    const best = Math.min(...players.map((p) => p.last));
    const winner = players.filter((p) => p.last === best)[0];
    if (best <= EXACT) { ctx.sfx.correct(); ctx.celebrate('small'); } else ctx.sfx.step();
    let msg: string;
    if (players.length > 1) msg = `${S.best(winner.name, best)} ${S.regionIs(place.region)}`;
    else if (best <= EXACT) msg = S.exact(best);
    else if (best <= GOOD) msg = `${S.good(best)} ${S.regionIs(place.region)}`;
    else {
      const [gx, gy] = winner.guess as [number, number];
      const [tx, ty] = project(place.lat, place.lon);
      msg = S.far(name(place), direction(gx, gy, tx, ty), place.region);
    }
    ctx.mascot.say(msg, best <= EXACT ? 'cheer' : best <= GOOD ? 'happy' : 'think', 5000);
  }

  function end() {
    const n = places.length;
    const bestTotal = Math.min(...players.map((p) => p.total));
    const avg = Math.round(bestTotal / n);
    const stars: Stars = avg <= cfg.stars[0] ? 3 : avg <= cfg.stars[1] ? 2 : 1;
    let message: string;
    if (players.length === 1) message = S.soloEnd(bestTotal, avg);
    else {
      const winners = players.filter((p) => p.total === bestTotal);
      message = winners.length === 1 ? S.winner(winners[0].name, bestTotal) : S.tie(winners.map((p) => p.name).join(', '), bestTotal);
      message += '  ' + players.filter((p) => p.total !== bestTotal).sort((a, b) => a.total - b.total)
        .map((p) => `${p.name}: ${p.total} km`).join(' · ');
    }
    ctx.finish({ stars, message: message.trim() });
  }

  const stopResize = onResize(mapBox, () => {
    measure();
    if (players.length) drawOverlay();
  });

  renderSetup();
  ctx.mascot.say(S.hello, 'wave', 4000);
  return () => {
    alive = false;
    stopResize();
  };
}

const game: GameModule = {
  id: 'slovakia',
  order: 8,
  players: 4,
  title: { en: 'Blind Map of Slovakia', sk: 'Slepá mapa Slovenska' },
  tagline: { en: 'Find towns, castles and mountains', sk: 'Nájdi mestá, hrady a vrchy' },
  color: '#1FC2AE',
  icon: ICON,
  howTo: [
    { en: 'Choose how many players (1 to 4).', sk: 'Vyber, koľko hráčov hrá (1 až 4).' },
    { en: 'Read the name and tap the map where you think the place is.', sk: 'Prečítaj si názov a ťukni na mapu tam, kde je podľa teba to miesto.' },
    { en: 'Then the real spot appears with the distance in km.', sk: 'Potom sa ukáže správne miesto a vzdialenosť v km.' },
    { en: 'Fewest kilometres in total wins!', sk: 'Vyhráva ten, kto má spolu najmenej kilometrov!' },
  ],
  levels: [
    { id: 'easy', description: { en: 'Famous places, the region is shown', sk: 'Známe miesta, kraj je vyznačený' } },
    { id: 'medium', description: { en: 'More places, region borders', sk: 'Viac miest, hranice krajov' } },
    { id: 'hard', description: { en: `All ${PLACES.length} places, rivers only`, sk: `Všetkých ${PLACES.length} miest, len rieky` } },
  ],
  mount,
};
export default game;
