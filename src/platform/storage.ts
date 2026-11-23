const PREFIX = 'sovy:';

/** localStorage wrapper that never throws (private mode, blocked storage, …). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};

export function getBest(gameId: string, level: string): number {
  const v = Number(storage.get(`best:${gameId}:${level}`));
  return Number.isFinite(v) ? v : 0;
}

export function saveBest(gameId: string, level: string, stars: number): void {
  if (stars > getBest(gameId, level)) storage.set(`best:${gameId}:${level}`, String(stars));
}
