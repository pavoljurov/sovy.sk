import { h } from './dom';

const COLORS = ['#FF5D8F', '#FFD23F', '#3DA5FF', '#4CC95B', '#7B5CFF', '#FF8A3D'];

/** Piece counts. Each piece is its own GPU layer, so keep these low for weak TV hardware. */
export const CONFETTI = { small: 20, big: 40 } as const;

export function confetti(count: number = CONFETTI.small): void {
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    const piece = h('i', {
      style: {
        left: `${Math.random() * 100}%`,
        background: COLORS[i % COLORS.length],
        animationDelay: `${Math.random() * 0.5}s`,
        animationDuration: `${1.6 + Math.random() * 1.4}s`,
        '--dx': `${(Math.random() - 0.5) * 30}vw`,
        '--rot': `${360 + Math.random() * 720}deg`,
        borderRadius: Math.random() < 0.4 ? '50%' : '0.15em',
      },
    });
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3500);
}
