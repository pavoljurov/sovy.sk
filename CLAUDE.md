# CLAUDE.md

Read **README.md** first. It describes the architecture, the GameModule contract, the
step-by-step guide for adding a game, and the project conventions (isolation, touch-TV UX,
EN/SK texts and Slovak wording rules, visual style).

Quick rules:
- New game = new folder `src/games/<id>/index.ts` (default export `GameModule`). It is auto-discovered.
  Do not modify `src/platform/` for a single game.
- Every user-visible string must exist in both `en` and `sk` (`const sk: typeof en = …`).
- Must work on old touch-screen-TV browsers (outdated Android Chrome/WebView). Follow
  README → "Older browsers": no new JS APIs without a polyfill in `src/platform/compat.ts`, and
  CSS fallbacks for `:has()`, `color-mix()`, `cq*`, `dvh`, `aspect-ratio`.
- Before finishing: `npm run build` must pass; check every level in both languages at
  1920×1080 (TV) and ~390×844 (phone portrait).
