import type { GameModule } from './types';
import { tx } from './i18n';

/**
 * Games are discovered automatically: every folder src/games/<name>/ with an
 * index.ts that default-exports a GameModule shows up on the home screen.
 * To remove a game, delete its folder (or set `hidden: true`).
 */
const modules = import.meta.glob<{ default: GameModule }>('../games/*/index.ts', { eager: true });

export const games: GameModule[] = Object.values(modules)
  .map((m) => m.default)
  .filter((g): g is GameModule => !!g && !g.hidden)
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || tx(a.title).localeCompare(tx(b.title)));
