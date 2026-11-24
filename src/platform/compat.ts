/**
 * Small fallbacks for older browsers, e.g. the outdated Android browsers built into
 * touch-screen TVs and interactive panels. Imported first in main.ts.
 */

// Element.replaceChildren: Chrome 86+, Safari 14+. We use it everywhere to redraw.
if (typeof Element !== 'undefined' && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
    while (this.lastChild) this.removeChild(this.lastChild);
    this.append(...nodes);
  };
}

export {};
