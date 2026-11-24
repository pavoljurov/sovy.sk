import { h } from './dom';
import { games } from './registry';
import { Mascot, mascotSvg } from './mascot';
import { sfx } from './sfx';
import { CONFETTI, confetti } from './effects';
import { getBest, saveBest } from './storage';
import { APP, T } from './config';
import { getLang, LANGS, setLang, tx } from './i18n';
import { ICONS, starsHtml } from './icons';
import { pick } from './util';
import type { GameContext, GameModule, GameResult, LevelInfo } from './types';

const mascot = new Mascot();
let root: HTMLElement;
let cleanup: (() => void) | null = null;

export function startApp(el: HTMLElement): void {
  root = el;
  window.addEventListener('hashchange', render);
  // Long-press on a touchscreen should not open menus or select text.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  render();
}

function go(hash: string): void {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render(): void {
  cleanup?.();
  cleanup = null;
  mascot.hush();
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  document.body.classList.remove('has-result');
  root.replaceChildren();
  const { slogan } = T();
  document.title = `${APP.name}${APP.tld} — ${slogan.before}${slogan.highlight}${slogan.after}`;

  const [section, gameId, levelId] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'play' && gameId) {
    const game = games.find((g) => g.id === gameId);
    if (!game) return go('#/');
    const level = game.levels.find((l) => l.id === levelId);
    root.append(level ? gameScreen(game, level) : levelScreen(game));
  } else {
    root.append(homeScreen());
  }
}

/* ---------- shared bits ---------- */

function iconButton(icon: string, label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  return h('button', { class: `btn btn-icon ${cls}`, 'aria-label': label, title: label, html: icon, onClick });
}

function tools(inGame = false): HTMLElement {
  const ui = T().ui;
  return h(
    'div',
    { class: 'tools' },
    iconButton(ICONS.settings, ui.settings, () => openSettings(inGame)),
    iconButton(ICONS.fullscreen, ui.fullscreen, () => {
      if (document.fullscreenElement) void document.exitFullscreen?.();
      else void document.documentElement.requestFullscreen?.().catch(() => {});
    }),
  );
}

function logo(): HTMLElement {
  return h(
    'div',
    { class: 'logo' },
    h('div', { class: 'logo-mark', html: mascotSvg() }),
    h(
      'div',
      { class: 'logo-text' },
      h('span', { class: 'logo-name' }, APP.name, h('small', null, APP.tld)),
      h('span', { class: 'logo-tagline' }, T().tagline),
    ),
  );
}

const levelName = (lvl: LevelInfo) => (lvl.label ? tx(lvl.label) : T().levelNames[lvl.id]);

/* ---------- settings ---------- */

function openSettings(inGame: boolean): void {
  sfx.tap();
  const ui = T().ui;
  const close = () => overlay.remove();

  const langButtons = LANGS.map((l) =>
    h(
      'button',
      {
        class: `btn choice ${l.id === getLang() ? 'active' : ''}`,
        onClick: () => {
          sfx.tap();
          close();
          if (l.id !== getLang()) {
            setLang(l.id);
            render();
          }
        },
      },
      h('span', { class: 'flag', html: l.flag }),
      l.name,
    ),
  );

  const soundButtons: HTMLButtonElement[] = [true, false].map((on) =>
    h(
      'button',
      {
        class: `btn choice ${sfx.isMuted() === !on ? 'active' : ''}`,
        onClick: () => {
          sfx.setMuted(!on);
          soundButtons.forEach((x, i) => x.classList.toggle('active', (i === 0) === on));
        },
      },
      h('span', { html: on ? ICONS.soundOn : ICONS.soundOff }),
      on ? ui.on : ui.off,
    ),
  );

  const overlay = h(
    'div',
    { class: 'overlay', onClick: (e: Event) => e.target === overlay && close() },
    h(
      'div',
      { class: 'card settings-card', role: 'dialog', 'aria-label': ui.settings },
      h('h2', null, h('span', { html: ICONS.settings }), ui.settings),
      h('div', null, h('div', { class: 'settings-label' }, ui.language), h('div', { class: 'settings-row' }, langButtons)),
      inGame ? h('p', { class: 'settings-note' }, ui.restartNote) : null,
      h('div', null, h('div', { class: 'settings-label' }, ui.sound), h('div', { class: 'settings-row' }, soundButtons)),
      h('button', { class: 'btn btn-big btn-go', onClick: close }, ui.close),
    ),
  );
  document.body.append(overlay);
}

/* ---------- home ---------- */

function homeScreen(): HTMLElement {
  const slot = h('aside', { class: 'mascot-slot' });
  mascot.attach(slot);
  setTimeout(() => mascot.say(pick(T().greetings), 'wave', 6000), 300);

  const cards = games.map((g, i) => {
    const earned = g.levels.reduce((sum, l) => sum + getBest(g.id, l.id), 0);
    return h(
      'button',
      {
        class: 'card game-card',
        style: { '--c': g.color, animationDelay: `${i * 80}ms` },
        onClick: () => {
          sfx.tap();
          go(`#/play/${g.id}`);
        },
      },
      h('div', { class: 'game-card-icon', html: g.icon }),
      h('div', { class: 'game-card-title' }, tx(g.title)),
      h('div', { class: 'game-card-tag' }, tx(g.tagline)),
      h(
        'div',
        { class: 'game-card-stars' },
        h('span', { html: ICONS.star, class: 'star on' }),
        ` ${earned} / ${g.levels.length * 3}`,
      ),
    );
  });

  const { slogan, intro } = T();
  const hero = h(
    'section',
    { class: 'home-hero' },
    h('h1', { class: 'home-slogan' }, slogan.before, h('em', null, slogan.highlight), slogan.after),
    h('p', { class: 'home-intro' }, intro),
  );

  return h(
    'div',
    { class: 'screen home' },
    h('header', { class: 'topbar' }, logo(), hero, tools()),
    h('div', { class: 'home-body' }, slot, h('div', { class: 'game-grid' }, cards)),
  );
}

/* ---------- level select ---------- */

const LEVEL_COLORS = ['#4CC95B', '#FFB020', '#FF5D8F'];

function levelScreen(game: GameModule): HTMLElement {
  const slot = h('aside', { class: 'mascot-slot' });
  mascot.attach(slot);
  setTimeout(() => mascot.say(pick(T().levelHints), 'think', 5000), 250);

  const cards = game.levels.map((lvl, i) =>
    h(
      'button',
      {
        class: 'card level-card',
        style: { '--c': LEVEL_COLORS[i] ?? game.color, animationDelay: `${i * 90}ms` },
        onClick: () => {
          sfx.tap();
          go(`#/play/${game.id}/${lvl.id}`);
        },
      },
      h('div', { class: 'level-pips' }, ...Array.from({ length: i + 1 }, () => h('i'))),
      h('div', { class: 'level-label' }, levelName(lvl)),
      h('div', { class: 'level-desc' }, tx(lvl.description)),
      h('div', { class: 'level-stars', html: starsHtml(getBest(game.id, lvl.id)) }),
    ),
  );

  return h(
    'div',
    { class: 'screen level-screen', style: { '--game': game.color } },
    h(
      'header',
      { class: 'topbar' },
      iconButton(ICONS.home, T().ui.home, () => go('#/')),
      h('div', { class: 'title-pill' }, h('span', { class: 'title-icon', html: game.icon }), tx(game.title)),
      tools(),
    ),
    h('div', { class: 'level-body' }, slot, h('div', { class: 'level-main' }, howTo(game), game.howTo?.length ? h('h2', { class: 'level-heading' }, T().ui.chooseLevel) : null, h('div', { class: 'level-grid' }, cards))),
  );
}

const BULB = `<svg viewBox="0 0 24 24"><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.5.9 1.1.9 1.8v.9h5.8v-.9c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5z" fill="#fff" stroke="#2B2440" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 19.5h5M10.5 22h3" stroke="#2B2440" stroke-width="1.8" stroke-linecap="round"/><path d="M12 6.5a2.8 2.8 0 0 0-2.8 2.8" stroke="#FF8A3D" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;

/** "How to play" story strip: numbered step cards, scrolls sideways on narrow screens. */
function howTo(game: GameModule): HTMLElement | null {
  if (!game.howTo?.length) return null;
  return h(
    'section',
    { class: 'howto' },
    h('h2', { class: 'howto-title' }, h('span', { html: BULB }), T().ui.howTo),
    h(
      'ol',
      { class: 'howto-steps' },
      game.howTo.map((step, i) =>
        h(
          'li',
          { class: 'howto-step', style: { animationDelay: `${i * 90}ms` } },
          h('span', { class: 'howto-num' }, i + 1),
          h('span', { class: 'howto-text' }, tx(step)),
        ),
      ),
    ),
  );
}

/* ---------- game ---------- */

function gameScreen(game: GameModule, level: LevelInfo): HTMLElement {
  const stage = h('main', { class: `stage game-${game.id}` });
  const progress = h('div', { class: 'progress' });
  const slot = h('aside', { class: 'mascot-slot' });
  mascot.attach(slot);

  const screen = h(
    'div',
    { class: 'screen game-screen', style: { '--game': game.color } },
    h(
      'header',
      { class: 'topbar' },
      iconButton(ICONS.back, T().ui.back, () => go(`#/play/${game.id}`)),
      h(
        'div',
        { class: 'title-pill' },
        h('span', { class: 'title-icon', html: game.icon }),
        h('span', { class: 'title-text' }, tx(game.title)),
        h('span', { class: 'level-badge' }, levelName(level)),
      ),
      progress,
      tools(true),
    ),
    h('div', { class: 'game-body' }, stage, slot),
  );

  let finished = false;
  let lastTotal = 0;
  const ctx: GameContext = {
    level: level.id,
    lang: getLang(),
    mascot: { say: (t, m, d) => mascot.say(t, m, d), mood: (m) => mascot.setMood(m) },
    sfx,
    celebrate: (size = 'small') => confetti(CONFETTI[size]),
    setProgress(done, total) {
      lastTotal = total;
      if (total > 12) {
        progress.replaceChildren(
          h('div', { class: 'progress-bar' }, h('i', { style: { width: `${(100 * done) / total}%` } })),
        );
        return;
      }
      progress.replaceChildren(
        ...Array.from({ length: total }, (_, i) =>
          h('i', { class: i < done ? 'done' : i === done ? 'current' : '' }),
        ),
      );
    },
    finish(result) {
      if (finished) return;
      finished = true;
      if (lastTotal) ctx.setProgress(lastTotal, lastTotal);
      saveBest(game.id, level.id, result.stars);
      setTimeout(() => showResult(game, result), 500);
    },
  };

  // Mount after the screen is in the DOM so games can measure their stage.
  requestAnimationFrame(() => {
    if (!stage.isConnected) return;
    const unmount = game.mount(stage, ctx);
    cleanup = () => {
      finished = true;
      unmount();
    };
  });
  return screen;
}

function showResult(game: GameModule, result: GameResult): void {
  if (!document.querySelector(`.game-${game.id}`)) return; // the kid already left the game
  const t = T();
  sfx.win();
  if (result.stars >= 2) confetti(CONFETTI.big);
  mascot.say(result.stars === 3 ? t.resultCheer3 : t.resultCheer, 'cheer', 6000);

  const overlay = h(
    'div',
    { class: 'overlay result-overlay' },
    h(
      'div',
      { class: 'card result-card' },
      h('div', { class: 'result-stars', html: starsHtml(result.stars) }),
      h('h2', null, pick(t.resultTitles[result.stars] ?? t.resultTitles[1])),
      result.message ? h('p', null, result.message) : null,
      h(
        'div',
        { class: 'result-actions' },
        h('button', { class: 'btn btn-big btn-go', onClick: () => go(location.hash) }, h('span', { html: ICONS.replay }), t.ui.playAgain),
        h('button', { class: 'btn btn-big btn-alt', onClick: () => go(`#/play/${game.id}`) }, h('span', { html: ICONS.levels }), t.ui.levels),
        h('button', { class: 'btn btn-big btn-alt', onClick: () => go('#/') }, h('span', { html: ICONS.home }), t.ui.home),
      ),
    ),
  );
  document.body.classList.add('has-result');
  document.body.append(overlay);
}
