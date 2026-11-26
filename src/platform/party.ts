/**
 * Shared "party" multiplayer for quiz games (2–4 kids at one touch screen).
 *
 * Each player gets a colour lane with the same options in its own shuffled order
 * (copying the neighbour's position does not help). Everyone answers once; a lane that has answered
 * only shows "Voted" (its pick is not highlighted, so it can't be copied). Answers are revealed when
 * all players have answered or a countdown (started by the first answer) runs out.
 * On reveal, a lane's own pick is green when right and grey when wrong; the right answer it
 * missed only gets a green outline.
 * Right = 1 point, fastest right = 2 points.
 *
 * The game owns the layout: it places `party.lanes`, `party.timer` and `party.nextBtn`
 * wherever it likes, renders the question itself and calls `party.ask()` once per round.
 */
import type { GameContext } from './types';
import { h, replay } from './dom';
import { shuffle } from './util';
import { T } from './config';
import { ICONS } from './icons';

/** Once the first player has answered, the others have this long. */
export const ANSWER_MS = 10000;

/** Lane accent + light lane background (no color-mix for old browsers). */
export const PLAYER_COLORS = [
  { color: '#FF4D5E', tint: '#FFE6E8' },
  { color: '#3DA5FF', tint: '#E1F1FF' },
  { color: '#4CC95B', tint: '#E4F7E6' },
  { color: '#FFD23F', tint: '#FFF6D1' },
];

const kid = (color: string) =>
  `<svg viewBox="0 0 26 30"><g stroke="#2B2440" stroke-width="2.2" stroke-linejoin="round"><path d="M3 29v-4a10 10 0 0 1 20 0v4z" fill="${color}"/><circle cx="13" cy="9.5" r="6.2" fill="#FFE0C2"/></g></svg>`;
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="#FFD23F" stroke="#2B2440" stroke-width="2" stroke-linejoin="round"/></svg>';

/** "How many players?" screen with 1–4 buttons. */
export function playerPicker(ctx: GameContext, onPick: (count: number) => void, max = 4): HTMLElement {
  const S = T().party;
  ctx.mascot.say(S.hello, 'wave', 4000);
  return h('div', { class: 'pty-setup' },
    h('div', { class: 'pty-setup-q' }, S.howMany),
    h('div', { class: 'pty-counts' },
      ...Array.from({ length: max }, (_, i) => i + 1).map((n) =>
        h('button', { class: 'btn pty-count', onClick: () => { ctx.sfx.tap(); onPick(n); } },
          h('span', { class: 'pty-count-icons', html: PLAYER_COLORS.slice(0, n).map((p) => kid(p.color)).join('') }),
          h('span', null, S.players(n)),
        ),
      ),
    ),
    h('div', { class: 'pty-rules' }, S.rules),
  );
}

export interface PartyPlayer {
  name: string;
  score: number;
  /** rounds answered correctly (for the stars) */
  correct: number;
  /** index into this round's shown options, or -1 */
  pick: number;
  /** answer order within the round (0 = first) */
  order: number;
  lane: HTMLElement;
  /** the lane's option container (games may size its content) */
  opts: HTMLElement;
  status: HTMLElement;
  scoreEl: HTMLElement;
}

export interface PartyRound<T> {
  options: T[];
  isRight(o: T): boolean;
  /**
   * Builds one option button (no click handler needed – the party attaches it).
   * `i` is its position in the lane: style by position, never by value, so lanes can't be copied by colour.
   */
  button(o: T, p: PartyPlayer, i: number): HTMLButtonElement;
  /** Extra decoration for a wrong pick on reveal (e.g. show what it really is). */
  markWrong?(b: HTMLButtonElement, o: T): void;
  /** Called on reveal, after scoring. Returns an optional sentence appended to the owl's message. */
  onReveal?(right: PartyPlayer[]): string | void;
  /** true on the last round: the next button says "Results". */
  last: boolean;
}

export interface Party {
  players: PartyPlayer[];
  lanes: HTMLElement;
  timer: HTMLElement;
  nextBtn: HTMLButtonElement;
  /** Start a round: fill every lane with its own shuffled options. */
  ask<T>(round: PartyRound<T>): void;
  /** Winner sentence for the result card + the best player's right answers (for stars). */
  result(): { message: string; bestCorrect: number };
  destroy(): void;
}

export function createParty(ctx: GameContext, count: number, onNext: () => void): Party {
  const S = T().party;
  let alive = true;
  let timer = 0;
  let phase: 'idle' | 'answer' | 'reveal' = 'idle';
  let answered = 0;
  let reveal = () => {};

  const players: PartyPlayer[] = PLAYER_COLORS.slice(0, count).map((pc, i) => {
    const status = h('span', { class: 'pty-status' });
    const scoreEl = h('span', null, '0');
    const opts = h('div', { class: 'pty-opts' });
    const lane = h('div', { class: 'pty-lane', style: { '--c': pc.color, '--t': pc.tint } },
      h('div', { class: 'pty-head' },
        h('span', { class: 'pty-badge' }, String(i + 1)),
        status,
        h('span', { class: 'pty-score', html: ICONS.star }, scoreEl),
      ),
      opts,
    );
    return { name: S.player(i + 1), score: 0, correct: 0, pick: -1, order: 0, lane, opts, status, scoreEl };
  });

  const timerFill = h('i');
  const timerEl = h('div', { class: 'pty-timer' }, timerFill);
  // touch-action: none on the lanes – several kids tapping at once must not pinch-zoom the page
  const lanes = h('div', { class: `pty-lanes n${count}` }, ...players.map((p) => p.lane));
  const nextBtn: HTMLButtonElement = h('button', {
    class: 'btn btn-go btn-big pty-next',
    onClick: () => {
      if (phase !== 'reveal' || nextBtn.disabled) return;
      ctx.sfx.tap();
      phase = 'idle';
      onNext();
    },
  });
  nextBtn.style.display = 'none';

  function startCountdown() {
    timerFill.style.transition = 'none';
    timerFill.style.width = '100%';
    timerEl.classList.add('on');
    void timerFill.offsetWidth;
    timerFill.style.transition = `width ${ANSWER_MS}ms linear`;
    timerFill.style.width = '0%';
    ctx.mascot.say(S.hurry, 'think', 2500);
    timer = window.setTimeout(() => alive && phase === 'answer' && reveal(), ANSWER_MS);
  }

  function ask<T>(round: PartyRound<T>) {
    answered = 0;
    nextBtn.style.display = 'none';
    timerEl.classList.remove('on');
    const shown: T[][] = [];
    players.forEach((p, pi) => {
      p.pick = -1;
      p.lane.className = 'pty-lane';
      p.status.className = 'pty-status';
      p.status.textContent = '';
      shown[pi] = shuffle(round.options);
      p.opts.replaceChildren(...shown[pi].map((o, oi) => {
        const b = round.button(o, p, oi);
        const choose = () => {
          if (phase !== 'answer' || p.pick >= 0) return;
          p.pick = oi;
          p.order = answered++;
          ctx.sfx.tap();
          // no highlight on the picked button – the neighbours must not see what was chosen
          p.opts.querySelectorAll('button').forEach((x) => (x.disabled = true));
          p.lane.classList.add('voted');
          p.status.className = 'pty-status voted';
          p.status.textContent = `✓ ${S.voted}`;
          replay(p.status, 'pop');
          if (answered >= players.length) reveal();
          else if (answered === 1) startCountdown();
        };
        // pointerdown, not click: browsers drop "click" when two fingers touch the screen at once
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(); });
        b.addEventListener('click', choose);
        return b;
      }));
    });

    reveal = () => {
      phase = 'reveal';
      clearTimeout(timer);
      timer = 0;
      timerEl.classList.remove('on');
      const isRight = (p: PartyPlayer, pi: number) => p.pick >= 0 && round.isRight(shown[pi][p.pick]);
      const right = players.filter(isRight).sort((a, b) => a.order - b.order);
      const fastest = right[0];
      players.forEach((p, pi) => {
        const ok = isRight(p, pi);
        const pts = ok ? (p === fastest ? 2 : 1) : 0;
        p.score += pts;
        if (ok) p.correct++;
        p.lane.className = `pty-lane revealed ${ok ? 'got' : 'miss'}`;
        p.opts.querySelectorAll('button').forEach((b, i) => {
          b.disabled = true;
          const o = shown[pi][i];
          if (i === p.pick) b.classList.add('mine');
          if (round.isRight(o)) b.classList.add('right');
          else if (i === p.pick) {
            b.classList.add('wrong');
            if (round.markWrong) round.markWrong(b, o);
          }
        });
        p.status.className = `pty-status ${ok ? 'ok' : 'no'}`;
        p.status.textContent = `+${pts}`;
        if (p === fastest) p.status.append(h('span', { class: 'pty-bolt', html: BOLT }));
        p.scoreEl.textContent = String(p.score);
        replay(p.status, 'pop');
      });
      nextBtn.textContent = round.last ? S.results : S.next;
      nextBtn.style.display = '';
      nextBtn.disabled = true; // a kid still tapping must not skip the reveal
      setTimeout(() => (nextBtn.disabled = false), 900);

      const tail = (round.onReveal && round.onReveal(right)) || '';
      if (right.length) { ctx.sfx.correct(); ctx.celebrate('small'); } else ctx.sfx.wrong();
      const msg = right.length === players.length ? S.everyone : right.length ? S.fastest(fastest.name) : S.nobody;
      ctx.mascot.say(tail ? `${msg} ${tail}` : msg, right.length ? 'happy' : 'think', 4000);
    };
    phase = 'answer';
  }

  function result() {
    const best = Math.max(...players.map((p) => p.score));
    const bestCorrect = Math.max(...players.map((p) => p.correct));
    const winners = players.filter((p) => p.score === best);
    let message = winners.length === 1
      ? S.winner(winners[0].name, S.points(best))
      : S.tie(winners.map((p) => p.name).join(', '), S.points(best));
    const rest = players.filter((p) => p.score !== best).sort((a, b) => b.score - a.score);
    if (rest.length) message += '  ' + rest.map((p) => `${p.name}: ${S.points(p.score)}`).join(' · ');
    return { message, bestCorrect };
  }

  ctx.mascot.say(S.intro, 'wave', 4500);
  return {
    players, lanes, timer: timerEl, nextBtn, ask, result,
    destroy: () => { alive = false; clearTimeout(timer); },
  };
}
