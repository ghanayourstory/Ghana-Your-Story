// Per-device accessibility preferences: interface size and reduced motion.
export type UiScale = 1 | 1.15 | 1.3;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function getUiScale(): UiScale {
  const v = Number(read("sika.uiScale"));
  return v === 1.15 || v === 1.3 ? v : 1;
}
export function getReduceMotion(): boolean {
  const v = read("sika.reduceMotion");
  if (v !== null) return v === "1";
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}
export function applyA11y(scale = getUiScale(), reduce = getReduceMotion()) {
  document.documentElement.style.setProperty("--ui-scale", String(scale));
  document.documentElement.classList.toggle("reduce-motion", reduce);
}
export function setUiScale(s: UiScale) { write("sika.uiScale", String(s)); applyA11y(); }
export function setReduceMotion(on: boolean) { write("sika.reduceMotion", on ? "1" : "0"); applyA11y(); }
