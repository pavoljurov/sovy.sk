const s = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  home: s('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>'),
  back: s('<path d="M15 5l-7 7 7 7"/>'),
  soundOn: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  fullscreen: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  replay: s('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>'),
  levels: s('<path d="M5 20v-5M12 20V10M19 20V4"/>'),
  /** three kids side by side: the "multiplayer" badge */
  players:
    '<svg viewBox="0 0 44 26" aria-hidden="true"><g stroke="#2B2440" stroke-width="2.2" stroke-linejoin="round">' +
    '<path d="M2 25v-3a7 7 0 0 1 14 0v3z" fill="#3DA5FF"/><circle cx="9" cy="9.5" r="4.6" fill="#FFE0C2"/>' +
    '<path d="M28 25v-3a7 7 0 0 1 14 0v3z" fill="#4CC95B"/><circle cx="35" cy="9.5" r="4.6" fill="#FFE0C2"/>' +
    '<path d="M13 25v-4a9 9 0 0 1 18 0v4z" fill="#FF4D5E"/><circle cx="22" cy="7.5" r="5.8" fill="#FFE0C2"/></g></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.3l2.95 6.1 6.7.95-4.85 4.7 1.15 6.65L12 17.55 6.05 20.7l1.15-6.65L2.35 9.35l6.7-.95z"/></svg>',
};

export function starsHtml(filled: number, total = 3): string {
  let out = '';
  for (let i = 0; i < total; i++) out += `<span class="star ${i < filled ? 'on' : ''}">${ICONS.star}</span>`;
  return out;
}
