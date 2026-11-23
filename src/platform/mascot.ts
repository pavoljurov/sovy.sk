import { h, replay } from './dom';
import { sfx } from './sfx';
import { pick } from './util';
import { MASCOT_NAME, T } from './config';
import type { Mood } from './types';

const INK = '#2B2440';
const BODY = '#8E6CF0';
const WING = '#6A4BD6';
const FACE = '#CBBBFF';
const BEAK = '#FF8A3D';

/** Huhu the owl as SVG. Exported so games can use the owl as a game character too. */
export function mascotSvg(cls = ''): string {
  return `
<svg class="owl ${cls}" viewBox="0 0 200 230" aria-hidden="true">
 <g class="owl-body">
  <g class="owl-wing owl-wing-l"><path d="M46 106C18 126 14 170 32 196c14-12 22-42 22-74z" fill="${WING}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>
  <g class="owl-wing owl-wing-r"><path d="M154 106c28 20 32 64 14 90-14-12-22-42-22-74z" fill="${WING}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>
  <path d="M66 206q7 14 14 0 7 14 14 0z" fill="${BEAK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M106 206q7 14 14 0 7 14 14 0z" fill="${BEAK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M52 84L38 34l46 26z" fill="${BODY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M148 84l14-50-46 26z" fill="${BODY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M100 46c52 0 72 46 72 94 0 50-30 72-72 72s-72-22-72-72c0-48 20-94 72-94z" fill="${BODY}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="100" cy="170" rx="46" ry="36" fill="#FFE9C7"/>
  <path d="M74 160q6.5 8 13 0 6.5 8 13 0 6.5 8 13 0 6.5 8 13 0M80 178q6.5 8 13 0 6.5 8 13 0 6.5 8 13 0" fill="none" stroke="#E2B784" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="74" cy="108" r="31" fill="${FACE}"/><circle cx="126" cy="108" r="31" fill="${FACE}"/>
  <g class="owl-eyes-open">
   <circle cx="74" cy="108" r="22" fill="#fff" stroke="${INK}" stroke-width="5"/>
   <circle cx="126" cy="108" r="22" fill="#fff" stroke="${INK}" stroke-width="5"/>
   <g class="owl-pupils">
    <circle cx="76" cy="110" r="11" fill="${INK}"/><circle cx="128" cy="110" r="11" fill="${INK}"/>
    <circle cx="80" cy="105" r="4" fill="#fff"/><circle cx="132" cy="105" r="4" fill="#fff"/>
   </g>
  </g>
  <g class="owl-eyes-happy" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round">
   <path d="M56 114q18-24 36 0"/><path d="M108 114q18-24 36 0"/>
  </g>
  <g class="owl-mouth m-sad" stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M54 84l32-10"/><path d="M146 84l-32-10"/></g>
  <ellipse cx="48" cy="138" rx="10" ry="6" fill="#FF5D8F" opacity=".55"/>
  <ellipse cx="152" cy="138" rx="10" ry="6" fill="#FF5D8F" opacity=".55"/>
  <path class="owl-mouth m-smile" d="M89 125q11-5 22 0l-11 20z" fill="${BEAK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <g class="owl-mouth m-open">
   <path d="M90 128h20l-10 25z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
   <path d="M95 140h10l-5 9z" fill="#FF5D8F"/>
   <path d="M88 123q12-5 24 0l-12 13z" fill="${BEAK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  </g>
  <g class="owl-cap">
   <path d="M76 50v13q24 13 48 0V50z" fill="${INK}"/>
   <path d="M52 45l48-18 48 18-48 17z" fill="#3A3157" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
   <g class="owl-tassel">
    <path d="M100 44l32 9v19" fill="none" stroke="#FFD23F" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="132" cy="76" r="5.5" fill="#FFD23F" stroke="${INK}" stroke-width="2.5"/>
   </g>
   <circle cx="100" cy="44" r="4" fill="#FFD23F"/>
  </g>
 </g>
</svg>`;
}

/** The single on-screen owl that follows the kid from screen to screen. */
export class Mascot {
  readonly el: HTMLDivElement;
  private bubble: HTMLDivElement;
  private timer = 0;

  constructor() {
    this.bubble = h('div', { class: 'bubble', role: 'status', 'aria-live': 'polite' });
    const figure = h('button', {
      class: 'mascot-figure',
      'aria-label': MASCOT_NAME,
      html: mascotSvg(),
      onClick: () => this.poke(),
    });
    this.el = h('div', { class: 'mascot', 'data-mood': 'idle' }, this.bubble, figure);
  }

  attach(slot: HTMLElement): void {
    slot.append(this.el);
  }

  setMood(mood: Mood): void {
    this.el.dataset.mood = mood;
    replay(this.el, 'jump');
  }

  say(text: string, mood: Mood = 'happy', ms = 4000): void {
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    replay(this.bubble, 'pop');
    this.setMood(mood);
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hush(), ms);
  }

  hush(): void {
    clearTimeout(this.timer);
    this.bubble.classList.remove('show');
    this.el.dataset.mood = 'idle';
  }

  private poke(): void {
    sfx.pop();
    this.say(pick(T().pokes), pick(['happy', 'cheer', 'wave'] as const), 3500);
  }
}
