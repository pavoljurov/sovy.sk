# sovy.sk 🦉

Educational mini-games for children aged **8–10** at a school club. The main device is a
**touchscreen TV**; tablets, laptops and phones must work too. The mascot is **Huhu**, a purple
owl in a graduation cap who talks to the kids in a speech bubble and shows up in the games.

- **Static site, no backend.** Progress (best stars) lives in the browser's `localStorage`.
- **TypeScript only**, with no UI framework. Vite compiles it to plain JS/CSS in `dist/`.
- **Two languages:** Slovak and English, switchable in the ⚙️ Settings panel.
- **Runs on old browsers.** Touch-screen TVs often have an outdated built-in Android browser /
  WebView. The current version is confirmed to work there; every new game must keep it that way
  (see [Older browsers](#older-browsers-touch-screen-tvs)).
- **Games are isolated plugins.** Adding or removing a game never touches the platform code.

---

## Commands

```bash
npm install
npm run dev        # dev server on all interfaces (open from the TV / phone on the same Wi-Fi)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

`dist/` uses relative paths (`base: './'` in `vite.config.ts`), so it can be copied to any web
server, subfolder, GitHub Pages or a USB stick. Fonts load from Google Fonts ("Baloo 2"), with a
rounded system font as the offline fallback.

---

## Project layout

```
index.html                 ← single page; mounts #app; ES5 error banner for old browsers
public/favicon.svg         ← owl icon
src/
  main.ts                  ← imports global CSS, calls startApp()
  platform/                ← THE SHELL. Shared by all games; normally not edited when adding games.
    compat.ts              ← polyfills for old browsers (imported first in main.ts)
    types.ts               ← GameModule / GameContext / LevelInfo contract  ★ read first
    registry.ts            ← auto-discovers games via import.meta.glob('../games/*/index.ts')
    app.ts                 ← router + screens: home → level select → game → result overlay; settings modal
    mascot.ts              ← Huhu: mascotSvg() + Mascot class (speech bubble, moods)
    i18n.ts                ← Lang, Text, Dict, tx(), pickLang(), getLang(), setLang(), LANGS (flags)
    config.ts              ← branding (APP, MASCOT_NAME) + all platform texts (EN/SK); praise()
    sfx.ts                 ← synthesized sounds (WebAudio, no audio files); mute state
    effects.ts             ← confetti()
    storage.ts             ← safe localStorage wrapper; getBest()/saveBest()
    dom.ts                 ← h() element factory, replay(), onResize()
    util.ts                ← randInt, pick, shuffle, sleep, starsFromMistakes
    party.ts               ← shared 2–4 player "colour lanes" quiz mode (player picker, lanes, countdown, scores)
    icons.ts               ← UI icons (home, settings, star…), starsHtml()
    styles.css             ← global design system (colors, buttons, cards, mascot moods, layouts)
  games/
    clock/   index.ts + clock.css    ← Clock Quiz (analogue clock, 24h time with day-part badge)
    math/    index.ts + math.css     ← Math Balloons (+/− , missing numbers)
    sudoku/  index.ts + sudoku.css   ← Sudoku 4×4 shapes / 4×4 numbers / 9×9
    robot/   index.ts + robot.css    ← Robot Path (program arrows / forward+turn on a grid)
    chessmaze/ index.ts + logic.ts + chessmaze.css ← Chess Maze (move a rook/bishop/knight past guarded squares)
    flags/   index.ts + countries.ts + flags.css + svg/  ← World Flags (flag quiz; SVGs from flag-icons, MIT)
    g2048/   index.ts + g2048.css    ← 2048 (slide and merge number tiles)
    slovakia/ index.ts + places.ts + map.ts + slovakia.css ← Blind Map of Slovakia (tap where a place is; 1–4 players)
    words/   index.ts + logic.ts + words.css + data/ ← Word Grid (find words in a 3×3 letter grid)
scripts/
  build-words.mjs          ← offline: rebuilds the Word Grid word lists (not part of the site build)
```

### How the app flows

Hash routing (`app.ts`):

| URL                        | Screen                                                  |
|----------------------------|---------------------------------------------------------|
| `#/`                       | Home: logo, owl greeting, one card per game             |
| `#/play/<gameId>`          | Level select: "How to play" steps + 2 or 3 level cards with best stars |
| `#/play/<gameId>/<level>`  | Game screen: top bar + `stage` + owl column             |

On every route change, `render()` calls the previous game's cleanup function, clears the DOM and
builds the new screen. "Play again" re-renders the same hash, so the game is mounted fresh.
Changing the language in Settings also re-renders (a running game restarts).

The game screen layout: **top bar** (home button, game title + level badge, progress dots or bar,
settings, fullscreen), then the **stage** (white rounded card the game draws into) and the **owl
column** on the right. On portrait screens (`max-aspect-ratio: 1/1`) the owl moves below the stage.

---

## The game contract (`src/platform/types.ts`)

```ts
interface GameModule {
  id: string;                 // URL-safe, unique; also the localStorage key and CSS class: .game-<id>
  title: Text;                // { en: '…', sk: '…' }
  tagline: Text;
  color: string;              // home card colour (hex)
  icon: string;               // inline SVG markup, viewBox ~64×64, ink outline #2B2440
  order?: number;             // home screen position (clock 1, math 2, sudoku 3, robot 4, chessmaze 5, flags 6, g2048 7, slovakia 8, words 9)
  hidden?: boolean;           // true = temporarily hidden from home screen
  players?: number;           // max kids playing together (e.g. 4); > 1 shows a "1–4" multiplayer badge on the home card
  howTo?: Text[];             // 2–4 short "how to play" steps, shown on the level-select screen
  levels: LevelInfo[];        // 2 or 3 items: { id: 'easy'|'medium'|'hard', description: Text, label?: Text }
  mount(stage: HTMLElement, ctx: GameContext): () => void;   // returns cleanup
}

interface GameContext {
  level: 'easy' | 'medium' | 'hard';
  lang: 'en' | 'sk';
  mascot: { say(text, mood?, ms?): void; mood(mood): void };  // moods: idle happy cheer think sad wave
  sfx: { tap(); correct(); wrong(); pop(); step(); win() };
  celebrate(size?: 'small' | 'big'): void;   // confetti
  setProgress(done: number, total: number): void;  // ≤12 → dots, >12 → progress bar
  finish(result: { stars: 0|1|2|3; message?: string }): void;  // shows result card, saves best stars
}
```

Level names (Easy/Medium/Hard and Ľahká/Stredná/Ťažká) come from the platform. A game only
gives a `description` per level (and an optional custom `label`).

---

## Adding a new game: step by step

1. **Create the folder** `src/games/<id>/` with `index.ts` (and usually `<id>.css`).
2. **Export a `GameModule` as default.** It is picked up automatically by `registry.ts`; there
   is no list to edit.
3. **Build it** following the template and conventions below. Give it `howTo` steps, so a
   teacher or parent opening it for the first time knows what to do.
4. **Check it:** run `npm run build` (must pass with no TS errors), then play every level in
   both languages, at TV size (1920×1080) and at phone portrait size (≈390×844). Check it
   against the [Older browsers](#older-browsers-touch-screen-tvs) rules (no unsupported JS APIs,
   CSS fallbacks in place).

Remove a game by deleting its folder, or set `hidden: true` to hide it temporarily.

### Template

```ts
import type { GameContext, GameModule, LevelId } from '../../platform/types';
import { h, replay } from '../../platform/dom';            // also: onResize
import { starsFromMistakes } from '../../platform/util';    // also: randInt, pick, shuffle, sleep
import { praise } from '../../platform/config';            // also: MASCOT_NAME
import { pickLang } from '../../platform/i18n';
import './shapes.css';
// tsconfig has noUnusedLocals: import only what you use.

const ICON = `<svg viewBox="0 0 64 64">…</svg>`;

// 1) Difficulty = data. One row per level; generation code reads only from here.
interface Cfg { rounds: number; choices: number }
const CFG: Record<LevelId, Cfg> = {
  easy:   { rounds: 8, choices: 3 },
  medium: { rounds: 8, choices: 4 },
  hard:   { rounds: 10, choices: 6 },
};

// 2) All texts, per language. `sk` must have the same shape as `en` (typeof en).
const en = {
  intro: 'Find the circle!',
  hint: (n: number) => `Look again – there are ${n} sides.`,
};
const sk: typeof en = {
  intro: 'Nájdi kruh!',
  hint: (n) => `Pozri sa ešte raz – má ${n} strany.`,
};

function mount(stage: HTMLElement, ctx: GameContext): () => void {
  const cfg = CFG[ctx.level];
  const S = pickLang({ en, sk });
  let alive = true;                       // guard for timers / async after unmount
  let round = 0, mistakes = 0;
  const later = (fn: () => void, ms: number) => setTimeout(() => alive && fn(), ms);

  const root = h('div', { class: 'shp' });
  stage.append(root);

  function next() {
    if (round >= cfg.rounds) return ctx.finish({ stars: starsFromMistakes(mistakes, 1, 3) });
    ctx.setProgress(round, cfg.rounds);
    const answer = 0;                     // index of the correct choice (generate real content here)
    root.replaceChildren(
      ...Array.from({ length: cfg.choices }, (_, i) => {
        const b: HTMLButtonElement = h('button', {
          class: 'btn shp-choice',
          onClick: () => (i === answer ? onCorrect() : onWrong(b)),
        }, String(i + 1));
        return b;
      }),
    );
  }
  function onCorrect() {
    ctx.sfx.correct(); ctx.celebrate('small');
    ctx.mascot.say(praise(), 'happy', 1800);
    round++; later(next, 1300);
  }
  function onWrong(el: HTMLElement) {
    mistakes++; ctx.sfx.wrong(); replay(el, 'shake');
    ctx.mascot.say(S.hint(3), 'think', 4000);
  }

  ctx.mascot.say(S.intro, 'wave', 4000);
  next();
  return () => { alive = false; /* clear intervals, rAF, ResizeObserver… */ };
}

const game: GameModule = {
  id: 'shapes',
  order: 5,
  title: { en: 'Shape Hunt', sk: 'Hľadanie tvarov' },
  tagline: { en: 'Find the right shape', sk: 'Nájdi správny tvar' },
  color: '#1FC2AE',
  icon: ICON,
  howTo: [
    { en: 'Look at the shapes.', sk: 'Pozri sa na tvary.' },
    { en: 'Tap the circle.', sk: 'Ťukni na kruh.' },
  ],
  levels: [
    { id: 'easy', description: { en: '3 shapes', sk: '3 tvary' } },
    { id: 'medium', description: { en: '4 shapes', sk: '4 tvary' } },
    { id: 'hard', description: { en: '6 shapes, tricky colours', sk: '6 tvarov, zradné farby' } },
  ],
  mount,
};
export default game;
```

### Platform helpers games may use

| Helper | From | Purpose |
|---|---|---|
| `h(tag, props, ...children)` | `dom.ts` | Create elements. `class`, `html` (innerHTML), `style` (object, supports `--vars`), `onClick`…, other keys → attributes |
| `replay(el, 'shake' \| 'pop')` | `dom.ts` | Restart a CSS animation class |
| `onResize(el, (w, h) => …)` | `dom.ts` | ResizeObserver; returns unsubscribe (call it in cleanup) |
| `randInt, pick, shuffle, sleep` | `util.ts` | Randomness / async delays |
| `starsFromMistakes(m, threeMax, twoMax)` | `util.ts` | Standard star scoring |
| `praise()` | `config.ts` | Random "Great job!" / "Výborne!" in current language |
| `MASCOT_NAME` | `config.ts` | "Huhu" |
| `mascotSvg()` | `mascot.ts` | The owl as SVG, to use as a character inside a game (Robot Path does this) |
| `pickLang({ en, sk })`, `tx(text)` | `i18n.ts` | Choose strings for the current language |
| `playerPicker(ctx, onPick)`, `createParty(ctx, count, onNext)` | `party.ts` | 1–4 player quiz mode: "How many players?" screen, then colour lanes at the bottom. The game renders the question and places `party.lanes`, `party.timer`, `party.nextBtn`; each round it calls `party.ask({ options, isRight, button, onReveal, last })`. The party shuffles options per lane, locks one answer per player (the lane then only shows "✓ Voted" with all options dimmed the same – the pick is not highlighted, so neighbours can't copy it), starts the 10 s countdown, scores (right = 1, fastest right = 2) and reveals: the lane's own pick turns green when right (`.right.mine`) or grey when wrong (`.wrong`); a right answer it missed only gets a green outline (`.right`). At the end `party.result()` gives the winner sentence and the best player's right answers (for stars). Used by Clock and Math; set `players: 4` on the module. |

---

## Conventions (please keep them)

**Isolation**
- A game imports only from `src/platform/*` and its own folder. Never import from another game.
- Prefix all CSS selectors with a short game prefix (`.clk-`, `.m-`, `.sdk-`, `.rb-`) or
  `.game-<id>` (the class the platform puts on the stage). No global selectors in game CSS.
- Do not edit `src/platform/` just for one game. Only add something there if several games need it.

**Lifecycle**
- Everything lives inside `stage`. Anything you start (timeouts, intervals, `requestAnimationFrame`,
  ResizeObserver, `async` loops) must stop in the cleanup function. Use an `alive` flag and check it
  after every `await`/timeout.
- Call `ctx.setProgress()` as rounds advance, and `ctx.finish()` **once** at the end.

**Difficulty and content**
- Content is **generated randomly** each play (no fixed level files). Each level is a row in the
  `CFG` table at the top of the game file. Validate generated puzzles: sudoku checks for a unique
  solution, and robot uses BFS to check the goal is reachable within the step limit.
- 2 or 3 levels. Easy should be really easy for an 8-year-old.
- Stars: count mistakes, then `starsFromMistakes`. A wrong answer should not end the round; let the
  kid retry, with a hint from the owl.

**Touch-TV UX**
- Big targets: buttons are at least about 2.5em (the root font size scales with the screen:
  `clamp(15px, .85vw + .85vh, 30px)`). Use `em` units, not px, for UI sizes.
- No hover-only interactions, no drag-only interactions (tap/buttons first), no keyboard required.
- The stage must fit without scrolling. For square boards, measure the stage with `onResize()` and
  set the size in px (see sudoku/robot). Handle portrait with `@media (max-aspect-ratio: 1/1)`.
- Test at 1920×1080 and 390×844.

**Owl and feedback**
- Use `ctx.mascot.say()` for intro, hints and praise. Keep messages short (1–2 sentences).
  Moods: `wave` (intro), `happy`/`cheer` (success), `think` (hint), `sad` (failed attempt).
- Hints should explain *why*, e.g. "the short hand shows the hour", not just "wrong".
- Sounds: `tap` for UI taps, `correct`, `wrong`, `pop`, `step` (movement), `win` (the platform plays it on finish).

**Texts and languages**
- Never hard-code user-visible text. Put all strings in the `en` and `sk` objects (`sk: typeof en`
  makes TypeScript enforce matching keys). Functions are fine for strings with numbers.
- Slovak rules used across the project:
  - Address the child in the 2nd person singular (ty): "Ťukni", "Vyber".
  - **Avoid gendered past-tense forms addressed to the child** ("Zvládol si", "Vyriešila si").
    Use neutral wording instead: "Hotovo!", "Hádanka je vyriešená!".
  - The owl is feminine in Slovak ("sovička Huhu", "je na teba hrdá"). Her first-person lines avoid
    past tense where possible ("Bum! Tu je kameň!").
  - English never uses a pronoun for the owl; it says "Huhu".
- Slovak uses "Ťukni" for tap, "Štart" for go, and the level names Ľahká / Stredná / Ťažká.

**Older browsers (touch-screen TVs)**

See the full section [Older browsers](#older-browsers-touch-screen-tvs). Short version: no CSS
`:has()`, `color-mix()`, container query units (`cq*`), `dvh`/`svh` or `aspect-ratio` without a
fallback, and no new JS APIs without checking support.

**Visual style**
- Cartoon "sticker" look: thick ink outlines (`#2B2440`), solid drop shadow, rounded corners,
  bright flat colours.
- Palette (CSS vars in `styles.css`): `--ink #2b2440`, `--purple #7b5cff`, `--orange #ff8a3d`,
  `--yellow #ffd23f`, `--teal #1fc2ae`, `--pink #ff5d8f`, `--blue #3da5ff`, `--green #4cc95b`,
  `--red #ff4d5e`, background `--bg #fff6e9`.
- Reusable classes: `.btn` (set `--b` for colour) plus `.btn-big`, `.btn-go` (green), `.btn-alt`
  (blue), `.btn-warn` (orange), `.btn-icon`; `.card`; animation classes `.shake` and `.pop`.
- Draw graphics as inline SVG (not emoji, which render differently on TVs), with the same ink
  outline style. Game icons are 64×64 SVGs on a white circle.

## Older browsers (touch-screen TVs)

The main device is a touch-screen TV whose built-in browser is an **old Android Chrome / WebView**
that never gets updated. The current version has been confirmed to work on it. **Every new game
(and every change) must keep working there**, so treat modern web features as "needs a fallback".

**What is already set up (don't remove it)**
- `vite.config.ts` → `build.target: 'es2019'`: new JS *syntax* (`?.`, `??`, class fields…) is
  compiled down automatically. This does **not** add missing *APIs* (methods/objects).
- `src/platform/compat.ts`: polyfills, imported first in `main.ts`. Currently
  `Element.replaceChildren`. If a new game needs another missing API, add a small polyfill here
  (that is a valid reason to touch `src/platform/`) rather than inside the game.
- `index.html`: a plain ES5 diagnostic banner. If the app fails to start, the TV shows the error
  message and the browser's `userAgent` on screen. Use it to find the exact browser version when
  something breaks. Keep it ES5.

**JavaScript rules**
- Syntax is fine (it is transpiled). For built-in **APIs**, check
  [caniuse.com](https://caniuse.com) / MDN and avoid anything newer than about **Chrome 80**
  unless it has a fallback or a polyfill in `compat.ts`. Examples to avoid or polyfill:
  `Array.prototype.at`, `Object.hasOwn`, `String.prototype.replaceAll`, `structuredClone`,
  `Array.prototype.findLast`, `Promise.any`, `AbortSignal.timeout`, `crypto.randomUUID`.
- `replaceChildren` is safe (polyfilled). `ResizeObserver` (via `onResize()`) and Pointer Events
  are used by existing games and work on the TV.
- Wrap optional browser features (audio, fullscreen, vibration) in `try`/`catch` or feature
  checks, and catch rejected promises (`.catch(() => {})`, not `void`), so a missing feature
  never breaks the game.

**CSS rules**: always give a fallback line first, or use `@supports`
- `:has()` → toggle a class from JS instead (see `body.has-result` in `app.ts`).
- `color-mix()` → plain colour first, `color-mix` inside `@supports` (see `.howto` in `styles.css`).
- Container query units (`cqw`, `cqh`) → a `vw`/`vh` fallback declaration on the line before
  (see `flags.css`).
- `dvh`, `svh`, `lvh` → a `vh` declaration on the line before (see `clock.css`).
- `aspect-ratio` → `@supports not (aspect-ratio: 1) { … }` with an explicit height (see
  `clock.css`, `math.css`), or size square boards in px from `onResize()` like sudoku/robot.
- Also avoid without a fallback: CSS nesting, `@container`, `@layer`, `:is()`/`:where()`,
  `inset`, `translate`/`rotate`/`scale` as separate properties, `100svh`, `text-wrap`.
  A fallback line before the modern one is enough: old browsers ignore what they don't understand.

**Checking**
- `npm run build` must pass, then test in an old browser if possible: the TV itself, or an old
  Chromium / Android emulator WebView. The `userAgent` from the banner tells you which version to
  emulate.
- Before finishing a game, grep its files for the features listed above.

---

## Existing games (reference implementations)

| Game | File | Levels | Notes |
|---|---|---|---|
| **Clock Quiz** | `games/clock` | whole hours / quarters / 5 min (1–4 players) | 24h answers (0:00–23:59). A part-of-day badge (night/morning/late morning/afternoon/evening) is chosen so that `h` and `h+12` are always different parts. Read mode (multiple choice) and set mode (turn hands with buttons). Slovak time words go to the *next* hour ("pol tretej", "štvrť na štyri"). Distractors model real mistakes (other half of day, next hour, swapped hands). **2–4 players** (`party.ts`): "read" rounds show the big clock and time buttons in each lane; instead of setting the clock, "find" rounds show a time and each lane picks one of 3–4 small clock faces (all faces differ, sized by `fit()`). |
| **Math Balloons** | `games/math` | ≤10 with dots / ≤20 / ≤50 + missing number (1–4 players) | Answers are floating balloon buttons. Tracks a streak. **2–4 players** (`party.ts`): the equation stays on top, every lane gets 4 balloon buttons (colour by position, not value, so lanes can't be copied by colour); no streak. |
| **Sudoku** | `games/sudoku` | 4×4 shapes / 4×4 numbers / 9×9 | Generator shuffles a base pattern, then removes cells while a solver confirms exactly one solution. Supports rectangular boxes (e.g. 6×6 = 2×3) via `br`/`bc`. 3 "help" hints. |
| **Robot Path** | `games/robot` | 5×5 arrows / 6×6 + batteries / 6×6 forward+turn | The kid builds a command list, the owl executes it step by step. BFS validates reachability; the program-length limit is per level. 5 puzzles per session. |
| **Chess Maze** | `games/chessmaze` | rook 6×6 / bishop 7×7 / knight 7×7 | Move your piece to the flag without stopping on a square an enemy piece (rook/bishop/knight) attacks. Enemies are static and cannot be captured; sliding pieces cannot jump over pieces. Dots show legal moves; a tap on a guarded square counts as a mistake and the attacker wiggles. "Danger" (3 per game) reveals guarded squares for the current puzzle. Pure logic in `logic.ts`; the generator uses BFS and requires the danger to make the route longer than on a free board. 5 puzzles per session. |
| **World Flags** | `games/flags` | Europe, 3 choices / well-known world flags / all 195 countries (1–4 players) | Two question types: "which country has this flag?" (name buttons) and "find the flag" (2×2 flag buttons). Country names (EN/SK), continents, the well-known set and groups of look-alike flags live in `countries.ts`. Easy avoids look-alikes as distractors; hard prefers them, then the same continent. A wrong answer reveals what it really is (its flag or name); a 2nd mistake gives a continent hint. **1–4 players:** solo keeps retry + owl hints; with 2–4 players each kid gets a colour lane at the bottom with the same options in its own shuffled order (no copying the neighbour), one answer each (a lane that answered only shows "✓ Voted", the pick is not highlighted), answers stay hidden until everyone has answered or a 10 s countdown (started by the first answer) runs out. Right = 1 point, fastest right = 2; stars from the best player's right answers. Lane buttons react on `pointerdown` (simultaneous multi-touch drops `click`) and lanes have `touch-action: none` (no pinch-zoom). Flag SVGs are copied from [flag-icons](https://github.com/lipis/flag-icons) (MIT, licence in `svg/`) and loaded as asset URLs. |
| **2048** | `games/g2048` | reach 128 (only 2s spawn) / 512 / 2048, all 4×4 | Classic 2048. Move with a swipe on the board, the on-screen arrow pad, or the keyboard (arrows/WASD). Tiles are absolutely positioned and slide with a CSS transform; the inner `.g2-face` pops on a merge. 5 undos (snapshots); undos used = mistakes for stars. When no move is left, the owl offers Undo or Finish (0 stars, shows the biggest tile). The id is `g2048` because a CSS class cannot start with a digit. |
| **Blind Map of Slovakia** | `games/slovakia` | famous places, region highlighted / well-known places, region borders / all ~300 places | A place name is shown; each of 1–4 players taps the map in turn (other players' pins stay hidden), then the real spot, the 10/30 km rings and each distance appear. Score = km off (haversine), lowest total wins; stars from the best player's average km. `places.ts`: ~300 towns, castles, peaks, lakes, caves, villages, churches, spas and sights with tier (1 famous … 3 all) and region; coordinates and names from Wikidata (CC0), names tidied by hand. `map.ts`: Slovakia, regions, neighbours and rivers from Natural Earth 1:10m (public domain), simplified and projected to km (`project`/`unproject`). Places not seen recently are picked first (`sovy:slovakia:recent`), so the pool cycles before repeating; one game mixes categories and never asks two places within 15 km. |
| **Word Grid** | `games/words` | short everyday words, first letters shown / up to 6 letters / all lengths + one 6+ letter word | Boggle-style 3×3 grid: tap (or swipe across) touching letters, diagonals included, each tile once per word. Slovak "ch" is one tile (encoded as `C` internally). 5 boards per game; each board shows empty slots for its target words. "Show all words" reveals the missed ones (tap a word to trace it on the grid), then "Next board". Points: 3 letters = 1, 4 = 2, 5 = 3, 6+ = 5, all words on a board +5, any other real word +1 (bonus), hint −1. Stars from the average share of words found; best score per level in `sovy:words:best:<level>`. `logic.ts`: solver (DFS + binary search over a sorted word array) and generator (plants a word along a random path, fills the rest by letter frequency, keeps boards whose word count fits the level). Words load on demand per language (`import('…?raw')`). `data/<lang>-target.tsv`: hand-curated words children know, base forms only, tier 1 (very common) / 2; edit by hand, then run `node scripts/build-words.mjs`, which checks them and regenerates `data/<lang>-accept.txt` (bonus words: Hunspell base forms of 3–7 letters, rude words removed; SCOWL / MPL licences in `data/`). |

---

## Platform details

- **Settings modal** (`app.ts → openSettings`): language (flag buttons), sound on/off.
- **i18n** (`i18n.ts`): `Lang = 'en' | 'sk'`. First visit: browser language (`sk`/`cs` → Slovak,
  else English). Choice saved in localStorage. Missing translations fall back to `en`.
  **To add a language:** extend `Lang` and `LANGS` (name + flag SVG), then add a dictionary next to
  `en`/`sk` in `config.ts` and in every game.
- **Storage keys** (prefix `sovy:`): `best:<gameId>:<level>` (0–3), `lang`, `muted`.
- **Branding:** `APP`, `MASCOT_NAME` and the home-page `slogan` / `intro` texts in `config.ts`; the owl artwork is in `mascot.ts`
  (`mascotSvg`) and `public/favicon.svg`; the page title is in `index.html`.
- **Mascot moods** are CSS-driven: `data-mood` on `.mascot` toggles SVG parts (`.owl-eyes-happy`,
  `.m-open` beak, `.m-sad` brows, tassel swing for `think`, wing waves).
- **Long-press context menu is disabled** (touch TV). Fullscreen button in the top bar.

## Ideas / backlog

- Seeded "puzzle of the day" so a whole group plays the same puzzles.
- Hand-crafted level packs (e.g. fixed robot maps) next to the random generators.
- More games: shapes & symmetry, money counting, multiplication, spelling (SK diacritics), memory pairs.
- Word Grid: inflected forms (plurals, Slovak cases) as targets; a bigger 4×4 level.

---

## License

The **code** is licensed under [0BSD](LICENSE): you can use, copy, modify and distribute it for
any purpose, with or without fee, and no attribution is required.

Third-party **data** keeps its own licence, with the licence text next to it: flag SVGs
(`src/games/flags/svg/`, MIT), map data (Natural Earth, public domain), place names (Wikidata,
CC0), and the Word Grid bonus-word lists (`src/games/words/data/`: SCOWL for English, Slovak
Hunspell under MPL 1.1). Word frequencies from FrequencyWords (CC BY-SA 4.0) were used to pick
candidates for the hand-curated Word Grid lists.

The **sovy.sk name** and the **Huhu owl mascot** (name and artwork: `mascotSvg()` in
`src/platform/mascot.ts` and `public/favicon.svg`) are **not** covered by the license. If you
publish your own fork, please give it your own name and mascot: see **Branding** under
[Platform details](#platform-details) for where they live.
