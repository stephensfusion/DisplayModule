import { userEvent } from 'vitest/browser';

import { NANO_MODULE_PARTS, NanoModulePortSection } from '../../testing/public-api';

// ------------------------------------------------------------------ queries

/** Required query. Throws a descriptive error so red-state failures are readable. */
export function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Expected element matching "${selector}"`);
  return el;
}

/** Port name element for a given section and name. */
export function portNameEl(root: ParentNode, section: NanoModulePortSection, name: string): HTMLElement {
  const els = Array.from(
    root.querySelectorAll<HTMLElement>(`${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.portName}`),
  );
  const el = els.find((e) => e.textContent?.trim() === name);
  if (!el) throw new Error(`Port name "${name}" not found in ${section}`);
  return el;
}

/** Port handle element (`.port`) by port id. */
export function portHandleById(root: ParentNode, id: string): HTMLElement {
  const el = Array.from(root.querySelectorAll<HTMLElement>(NANO_MODULE_PARTS.portHandle)).find(
    (e) => e.id === id,
  );
  if (!el) throw new Error(`Port handle with id "${id}" not found`);
  return el;
}

// ------------------------------------------------------------------ events

/** Dispatches a bubbling MouseEvent (synthetic: no default actions, no :hover). */
export function fireMouse(el: Element, type: string, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, ...init });
  el.dispatchEvent(event);
  return event;
}

/** Real pointer hover through Playwright (applies CSS :hover and fires pointer/mouse events). */
export async function realHover(el: Element): Promise<void> {
  await userEvent.hover(el);
}

/** Moves the real pointer away from an element. */
export async function realUnhover(el: Element): Promise<void> {
  await userEvent.unhover(el);
}

/** Real pointer click through Playwright (fires focus/blur default actions). */
export async function realClick(el: Element): Promise<void> {
  await userEvent.click(el);
}

// ----------------------------------------------------------------- tooltip

/** Normalised text of every visible `[role="tooltip"]` in the document. */
export function visibleTooltipTexts(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="tooltip"]'))
    .filter((t) => t.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
    .map((t) => normalise(t.textContent ?? ''));
}

/** First visible tooltip element, or null. */
export function visibleTooltip(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[role="tooltip"]')).find((t) =>
      t.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
    ) ?? null
  );
}

export function normalise(text: string): string {
  return text.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------ styles

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses every `rgb()/rgba()` occurrence in a computed style value. */
export function parseColors(value: string): Rgba[] {
  const out: Rgba[] = [];
  const re = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const alphaRaw = m[4];
    const a = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    out.push({ r: +m[1], g: +m[2], b: +m[3], a });
  }
  return out;
}

export function toHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance({ r, g, b }: Rgba): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Colour-bearing computed properties of an element (and its SVG paint). */
export function paintColors(el: Element): Rgba[] {
  const cs = getComputedStyle(el);
  const props = [
    cs.backgroundColor,
    cs.backgroundImage,
    cs.borderTopColor,
    cs.borderRightColor,
    cs.borderBottomColor,
    cs.borderLeftColor,
    cs.outlineColor,
    cs.boxShadow,
    cs.color,
    cs.fill,
    cs.stroke,
  ];
  return props.flatMap(parseColors).filter((c) => c.a > 0.05);
}

/** Colours painted by an element and its descendants. */
export function paintColorsDeep(el: Element): Rgba[] {
  return [el, ...Array.from(el.querySelectorAll('*'))].flatMap(paintColors);
}

/** Orange: hue 15°–50°, saturated, mid lightness. */
export function isOrange(c: Rgba): boolean {
  const { h, s, l } = toHsl(c);
  return h >= 15 && h <= 50 && s >= 0.5 && l >= 0.3 && l <= 0.8;
}

/** Green: hue 80°–170°, saturated, mid lightness. */
export function isGreen(c: Rgba): boolean {
  const { h, s, l } = toHsl(c);
  return h >= 80 && h <= 170 && s >= 0.35 && l >= 0.2 && l <= 0.8;
}

/** Effective (first opaque ancestor-or-self) background colour. */
export function effectiveBackground(el: Element): Rgba {
  let cur: Element | null = el;
  while (cur) {
    const [c] = parseColors(getComputedStyle(cur).backgroundColor);
    if (c && c.a > 0.5) return c;
    cur = cur.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** Visual "frame" of an element: border, outline and box-shadow. */
export function frameSignature(el: Element): string {
  const cs = getComputedStyle(el);
  return [
    cs.borderTopStyle,
    cs.borderTopWidth,
    cs.borderTopColor,
    cs.outlineStyle,
    cs.outlineWidth,
    cs.outlineColor,
    cs.boxShadow,
  ].join('|');
}

/** Numeric computed z-index (NaN for `auto`). */
export function zIndexOf(el: Element): number {
  return Number(getComputedStyle(el).zIndex);
}

/** True when an input shows a dashed underline (border-bottom or text-decoration). */
export function hasDashedUnderline(el: Element): boolean {
  const cs = getComputedStyle(el);
  const border = cs.borderBottomStyle === 'dashed' && parseFloat(cs.borderBottomWidth) > 0;
  const deco = cs.textDecorationLine.includes('underline') && cs.textDecorationStyle === 'dashed';
  return border || deco;
}

// ------------------------------------------------------------ accessibility

/** Simplified accessible-name computation (aria-labelledby, aria-label, label, text, title). */
export function accessibleName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return normalise(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
  }
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return normalise(aria);
  if (el instanceof HTMLInputElement && el.labels?.length) {
    return normalise(Array.from(el.labels).map((l) => l.textContent ?? '').join(' '));
  }
  const text = el instanceof HTMLInputElement ? '' : normalise(el.textContent ?? '');
  if (text) return text;
  return normalise(el.getAttribute('title') ?? el.getAttribute('placeholder') ?? '');
}
