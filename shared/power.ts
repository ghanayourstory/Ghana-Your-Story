// Dumsor: scheduled power cuts (load-shedding). Every area belongs to a group;
// some weeks supply is steady, other weeks each group loses power for a
// morning or an evening on a rotating timetable that's published in advance.
// Deterministic, so the server and every screen agree.
import { MINUTES_PER_DAY } from "./calendar.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Load-shedding group for an area (A, B or C). */
export function powerGroup(district: string): number {
  return hash(district) % 3;
}

/** Is this a dumsor week? About half are. */
function shedWeek(day: number): boolean {
  return hash(`week:${Math.floor(day / 7)}`) % 100 < 50;
}

/** Today's outage window for an area, in hours [from, to), or null if the power stays on. */
export function outageWindow(district: string, day: number): [number, number] | null {
  if (!shedWeek(day)) return null;
  const k = (day + powerGroup(district)) % 3;
  return k === 0 ? [18, 24] : k === 1 ? [6, 12] : null;
}

export function powerOff(district: string, minute: number): boolean {
  const day = Math.floor(minute / MINUTES_PER_DAY);
  const w = outageWindow(district, day);
  if (!w) return false;
  const h = (minute % MINUTES_PER_DAY) / 60;
  return h >= w[0] && h < w[1];
}

export const GROUP_NAME = ["A", "B", "C"];
export const fmtHour = (h: number) => (h % 24 === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? `${h}am` : `${h - 12}pm`);
