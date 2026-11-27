/** Inline SVG pictures for Memory Pairs (sticker style, ink outline #2B2440). */

const INK = '#2B2440';
const g = (body: string, sw = 3) =>
  `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

function starPath(cx: number, cy: number, R: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }
  return d + 'Z';
}

function rays(cx: number, cy: number, r1: number, r2: number, n: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((Math.PI * 2) / n) * i;
    d += `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`;
  }
  return d;
}

function petals(): string {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
    s += `<circle cx="${(32 + Math.cos(a) * 11).toFixed(1)}" cy="${(24 + Math.sin(a) * 11).toFixed(1)}" r="8" fill="#7B5CFF"/>`;
  }
  return s;
}

/** Pictures for the easy / medium level (all clearly different in shape and colour). */
export const PICTURES: string[] = [
  // apple
  g(`<path d="M32 21c-6-5-21-4-21 12 0 13 9 23 14 23 3 0 4-2 7-2s4 2 7 2c5 0 14-10 14-23 0-16-15-17-21-12z" fill="#FF4D5E"/><path d="M32 21c0-5 1-9 5-12" fill="none"/><path d="M36 15c4-6 11-6 13-3-3 6-9 7-13 3z" fill="#4CC95B"/>`),
  // sun
  g(`<path d="${rays(32, 32, 19, 28, 8)}" fill="none" stroke-width="4"/><circle cx="32" cy="32" r="13" fill="#FFD23F"/>`),
  // star
  g(`<path d="${starPath(32, 34, 26, 11)}" fill="#FF8A3D"/>`),
  // heart
  g(`<path d="M32 55C14 42 7 33 7 23a12.5 12.5 0 0 1 25-4 12.5 12.5 0 0 1 25 4c0 10-7 19-25 32z" fill="#FF5D8F"/>`),
  // fish
  g(`<path d="M44 32l15-12v24z" fill="#3DA5FF"/><path d="M6 32c9-14 29-16 40 0-11 16-31 14-40 0z" fill="#3DA5FF"/><circle cx="17" cy="29" r="3" fill="${INK}" stroke="none"/><path d="M28 24c3 5 3 11 0 16" fill="none"/>`),
  // house
  g(`<rect x="14" y="30" width="36" height="25" fill="#FFD23F"/><path d="M7 33 32 10l25 23z" fill="#FF4D5E"/><rect x="27" y="40" width="10" height="15" fill="#7B5CFF"/><rect x="40" y="36" width="6" height="6" fill="#fff"/>`),
  // tree
  g(`<rect x="27" y="38" width="10" height="19" fill="#B5793E"/><circle cx="32" cy="26" r="18" fill="#4CC95B"/><path d="M24 22a8 8 0 0 1 7-6" fill="none" stroke="#fff" stroke-width="2.5"/>`),
  // flower
  g(`<path d="M32 36v21" stroke="#4CC95B" stroke-width="5"/><path d="M32 50c-2-6-9-8-13-6 2 6 9 8 13 6z" fill="#4CC95B"/>${petals()}<circle cx="32" cy="24" r="7" fill="#FFD23F"/>`),
  // basketball
  g(`<circle cx="32" cy="32" r="24" fill="#FF8A3D"/><path d="M8 32h48M32 8v48M15 15c7 7 7 27 0 34M49 15c-7 7-7 27 0 34" fill="none" stroke-width="2.5"/>`),
  // car
  g(`<path d="M5 46v-9l7-2 7-11h23l9 11 8 2v9z" fill="#1FC2AE"/><path d="M22 27h9v8H17zM35 27h6l6 8H35z" fill="#E1F1FF"/><circle cx="18" cy="47" r="6" fill="${INK}"/><circle cx="46" cy="47" r="6" fill="${INK}"/><circle cx="18" cy="47" r="2" fill="#fff" stroke="none"/><circle cx="46" cy="47" r="2" fill="#fff" stroke="none"/>`),
  // moon
  g(`<path d="M38 7a25 25 0 1 0 19 39A21 21 0 0 1 38 7z" fill="#FFE27A"/><path d="${starPath(50, 16, 6, 2.6)}" fill="#FFD23F" stroke-width="2"/>`),
  // rocket
  g(`<path d="M22 34l-9 13h10zM42 34l9 13H41z" fill="#FF4D5E"/><path d="M26 45h12l-6 13z" fill="#FFD23F"/><path d="M32 5c10 8 13 22 10 40H22c-3-18 0-32 10-40z" fill="#fff"/><circle cx="32" cy="24" r="6" fill="#3DA5FF"/>`),
  // cat
  g(`<path d="M12 34 14 9l14 11h8l14-11 2 25" fill="#A9A3B8"/><ellipse cx="32" cy="37" rx="21" ry="18" fill="#A9A3B8"/><circle cx="24" cy="34" r="2.8" fill="${INK}" stroke="none"/><circle cx="40" cy="34" r="2.8" fill="${INK}" stroke="none"/><path d="M29 41h6l-3 3z" fill="#FF5D8F" stroke-width="2"/><path d="M8 38l11 2M8 45l11-2M56 38l-11 2M56 45l-11-2" stroke-width="2"/>`),
  // mushroom
  g(`<path d="M24 35h16l3 20H21z" fill="#FFF6E9"/><path d="M6 36a26 24 0 0 1 52 0z" fill="#FF4D5E"/><circle cx="22" cy="25" r="4" fill="#fff" stroke-width="2"/><circle cx="38" cy="20" r="3" fill="#fff" stroke-width="2"/><circle cx="44" cy="30" r="3" fill="#fff" stroke-width="2"/>`),
];

/** Face-down side: a little owl head (Huhu's cards). */
export const CARD_BACK = g(
  `<path d="M14 22 12 8l12 8M50 22l2-14-12 8" fill="#5B3FD9"/><path d="M32 12c13 0 22 9 22 22 0 12-9 21-22 21s-22-9-22-21c0-13 9-22 22-22z" fill="#5B3FD9"/><circle cx="23" cy="32" r="8" fill="#fff"/><circle cx="41" cy="32" r="8" fill="#fff"/><circle cx="24" cy="33" r="3.2" fill="${INK}" stroke="none"/><circle cx="40" cy="33" r="3.2" fill="${INK}" stroke="none"/><path d="M29 41h6l-3 5z" fill="#FF8A3D" stroke-width="2"/>`,
  2.6,
);

/** Analogue clock face with the hands at h:m (colours as in the Clock Quiz). */
export function clockSvg(hr: number, m: number): string {
  const P = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)}`;
  };
  let ticks = '';
  for (let i = 0; i < 12; i++) ticks += `M${P(i % 3 ? 82 : 76, i * 30)}L${P(92, i * 30)}`;
  let nums = '';
  [12, 3, 6, 9].forEach((n) => {
    const [x, y] = P(62, n * 30).split(' ');
    nums += `<text x="${x}" y="${y}">${n}</text>`;
  });
  const hourDeg = (hr % 12) * 30 + m * 0.5;
  const minDeg = m * 6;
  return `<svg viewBox="-106 -106 212 212" class="mem-clock">
<circle r="102" fill="#3DA5FF" stroke="${INK}" stroke-width="5"/><circle r="94" fill="#fff" stroke="${INK}" stroke-width="3"/>
<path d="${ticks}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>${nums}
<path d="M0 10L${P(48, hourDeg)}" stroke="#FF8A3D" stroke-width="13" stroke-linecap="round"/>
<path d="M0 14L${P(78, minDeg)}" stroke="#7B5CFF" stroke-width="8" stroke-linecap="round"/>
<circle r="9" fill="${INK}"/><circle r="4" fill="#FFD23F"/></svg>`;
}

/** Little player figure for the "how many players" buttons. */
export const kidSvg = (color: string) =>
  `<svg viewBox="0 0 26 30"><g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"><path d="M3 29v-4a10 10 0 0 1 20 0v4z" fill="${color}"/><circle cx="13" cy="9.5" r="6.2" fill="#FFE0C2"/></g></svg>`;

/** Home card icon: one card face-down, one face-up with a heart. */
export const ICON = `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3.2" stroke-linejoin="round">
<rect x="6" y="12" width="26" height="36" rx="5" fill="#7B5CFF" transform="rotate(-10 19 30)"/>
<g transform="rotate(-10 19 30)"><circle cx="15" cy="28" r="4" fill="#fff" stroke-width="2"/><circle cx="23" cy="28" r="4" fill="#fff" stroke-width="2"/><path d="M17.5 34h3l-1.5 2.5z" fill="#FF8A3D" stroke-width="1.5"/></g>
<rect x="31" y="14" width="26" height="36" rx="5" fill="#fff" transform="rotate(8 44 32)"/>
<path d="M44 42c-7-5-9-8.5-9-12a4.6 4.6 0 0 1 9-1.5 4.6 4.6 0 0 1 9 1.5c0 3.5-2 7-9 12z" fill="#FF5D8F" transform="rotate(8 44 32)" stroke-width="2.6"/>
</g></svg>`;
