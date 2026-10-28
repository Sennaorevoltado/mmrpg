/**
 * Elementos de mentira, só o bastante para os ouvintes de clique das fichas.
 */

export class FakeElement {
  constructor({ tag = "div", classes = [], dataset = {}, parent = null, value } = {}) {
    this.tag = tag;
    this.classList = new Set(classes);
    this.dataset = dataset;
    this.parent = parent;
    this.value = value;
    this.defaultPrevented = false;
  }

  /** Aceita `.classe`, `tag` e `tag.classe`. */
  matches(selector) {
    const [, tag, cls] = /^([a-z0-9]*)(?:\.([\w-]+))?$/i.exec(selector) ?? [];
    if (tag && tag !== this.tag) return false;
    if (cls && !this.classList.has(cls)) return false;
    return Boolean(tag || cls);
  }

  closest(selector) {
    let el = this;
    while (el) {
      if (el.matches(selector)) return el;
      el = el.parent;
    }
    return null;
  }
}

/** Raiz da ficha: guarda os ouvintes para os testes dispararem eventos. */
export function makeRoot() {
  const Base = globalThis.HTMLElement ?? class {};
  const root = new Base();
  root.listeners = {};
  root.addEventListener = (type, fn) => {
    (root.listeners[type] ??= []).push(fn);
  };
  root.querySelectorAll = () => [];
  root.fire = (type, event) => {
    for (const fn of root.listeners[type] ?? []) fn(event);
  };
  return root;
}

/** Um evento cujo alvo é o elemento dado. */
export function eventOn(target) {
  return {
    target,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
  };
}
