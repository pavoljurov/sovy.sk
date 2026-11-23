import type { Stars } from './types';

export const randInt = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 3 stars for ≤ threeMax mistakes, 2 stars for ≤ twoMax, otherwise 1. */
export function starsFromMistakes(mistakes: number, threeMax: number, twoMax: number): Stars {
  if (mistakes <= threeMax) return 3;
  if (mistakes <= twoMax) return 2;
  return 1;
}
