import type { Lang, Text } from './i18n';
export type { Lang, Text } from './i18n';

/**
 * The contract between the platform and every game.
 * Games only depend on this file and on the helpers in src/platform/ —
 * the platform never imports a specific game.
 */

export type LevelId = 'easy' | 'medium' | 'hard';

export interface LevelInfo {
  id: LevelId;
  /** Optional custom name; defaults to Easy / Medium / Hard in the current language. */
  label?: Text;
  /** One line telling kids/teachers what this level contains. */
  description: Text;
}

export type Stars = 0 | 1 | 2 | 3;

export interface GameResult {
  stars: Stars;
  /** Optional custom sentence shown on the result card. */
  message?: string;
}

export type Mood = 'idle' | 'happy' | 'cheer' | 'think' | 'sad' | 'wave';

export interface MascotApi {
  /** The owl says something in a speech bubble. */
  say(text: string, mood?: Mood, durationMs?: number): void;
  mood(mood: Mood): void;
}

export interface SfxApi {
  tap(): void;
  correct(): void;
  wrong(): void;
  pop(): void;
  step(): void;
  win(): void;
}

export interface GameContext {
  readonly level: LevelId;
  /** Current UI language. Games pick their texts with pickLang() from platform/i18n. */
  readonly lang: Lang;
  readonly mascot: MascotApi;
  readonly sfx: SfxApi;
  /** Confetti burst. */
  celebrate(size?: 'small' | 'big'): void;
  /** Updates the progress dots in the top bar (e.g. question 3 of 10). */
  setProgress(done: number, total: number): void;
  /** Ends the game and shows the result card. Call once. */
  finish(result: GameResult): void;
}

export interface GameModule {
  /** Unique, URL-safe id. Also used for saving stars. */
  id: string;
  title: Text;
  tagline: Text;
  /** Card colour on the home screen. */
  color: string;
  /** Inline SVG markup for the game card. */
  icon: string;
  /** Sort order on the home screen (lower = first). */
  order?: number;
  /** Set true to temporarily hide a game without deleting it. */
  hidden?: boolean;
  /**
   * 2–4 short "how to play" steps, shown as a story strip on the level-select screen.
   * One sentence each, written for an 8-year-old.
   */
  howTo?: Text[];
  /** 2 or 3 difficulty levels. */
  levels: LevelInfo[];
  /**
   * Render the game into `stage`. Return a cleanup function that stops
   * timers/animations and removes listeners added outside `stage`.
   */
  mount(stage: HTMLElement, ctx: GameContext): () => void;
}
