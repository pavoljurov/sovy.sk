export type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/**
 * Tiny element factory.
 *   h('button', { class: 'btn', onClick: () => … }, 'Hello')
 * - `class`, `html` (innerHTML), `style` (object; supports --custom-props)
 * - `onXxx` functions become event listeners
 * - everything else becomes an attribute
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
          el.style.setProperty(sk.startsWith('--') ? sk : sk.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), sv);
        }
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Restart a CSS animation class (e.g. 'shake') on an element. */
export function replay(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** Calls `cb(width, height)` whenever the element resizes. Returns an unsubscribe function. */
export function onResize(el: HTMLElement, cb: (w: number, h: number) => void): () => void {
  const ro = new ResizeObserver(() => cb(el.clientWidth, el.clientHeight));
  ro.observe(el);
  return () => ro.disconnect();
}
