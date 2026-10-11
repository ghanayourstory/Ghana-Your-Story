import { rand01 } from "./rng.ts";

// Game time is an integer count of minutes since the game epoch.
// The epoch is Monday 6 January 2025, 00:00 in Accra (GMT, no DST).
export const EPOCH_UTC_MS = Date.UTC(2025, 0, 6, 0, 0, 0);
export const START_MINUTE = 7 * 60; // players wake up at 07:00 on day one
export const MINUTES_PER_DAY = 24 * 60;

/** How many game minutes pass per real second while the player is in the city. */
export const TIME_SCALE = 1;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export type Season = "Harmattan" | "Dry season" | "Major rains" | "August break" | "Minor rains";
export type Weather = "sunny" | "cloudy" | "hazy" | "rain" | "storm";

export interface GameDate {
  minute: number;
  day: number; // days since epoch, 0-based
  hour: number;
  min: number;
  weekday: (typeof WEEKDAYS)[number];
  weekdayIndex: number;
  date: number;
  month: number; // 0-11
  monthName: (typeof MONTHS)[number];
  year: number;
  season: Season;
  isWeekend: boolean;
  isNight: boolean;
  label: string;
  clock: string;
}

export function dayOf(minute: number): number {
  return Math.floor(minute / MINUTES_PER_DAY);
}

export function seasonForMonth(month: number): Season {
  if (month === 11 || month <= 1) return "Harmattan";
  if (month === 2) return "Dry season";
  if (month >= 3 && month <= 6) return "Major rains";
  if (month === 7) return "August break";
  return "Minor rains";
}

export function toGameDate(minute: number): GameDate {
  const d = new Date(EPOCH_UTC_MS + minute * 60_000);
  const hour = d.getUTCHours();
  const min = d.getUTCMinutes();
  const weekdayIndex = d.getUTCDay();
  const month = d.getUTCMonth();
  const clock = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return {
    minute,
    day: dayOf(minute),
    hour,
    min,
    weekday: WEEKDAYS[weekdayIndex],
    weekdayIndex,
    date: d.getUTCDate(),
    month,
    monthName: MONTHS[month],
    year: d.getUTCFullYear(),
    season: seasonForMonth(month),
    isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    isNight: hour < 6 || hour >= 19,
    label: `${WEEKDAYS[weekdayIndex].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[month].slice(0, 3)} ${d.getUTCFullYear()}`,
    clock,
  };
}

/** Month index since epoch (Jan 2025 = 0) — used for monthly billing. */
export function monthIndex(minute: number): number {
  const d = new Date(EPOCH_UTC_MS + minute * 60_000);
  return (d.getUTCFullYear() - 2025) * 12 + d.getUTCMonth();
}

/** Weather is a pure function of the day and a 6-hour block so everyone sees the same sky. */
export function weatherAt(minute: number): Weather {
  const gd = toGameDate(minute);
  const block = Math.floor(gd.hour / 6);
  const r = rand01(`weather:${gd.day}:${block}`);
  const dayWet = rand01(`wetday:${gd.day}`);
  switch (gd.season) {
    case "Harmattan":
      return r < 0.55 ? "hazy" : r < 0.9 ? "sunny" : "cloudy";
    case "Dry season":
      return r < 0.6 ? "sunny" : r < 0.85 ? "cloudy" : "rain";
    case "Major rains":
      if (dayWet < 0.55) return r < 0.25 ? "storm" : r < 0.7 ? "rain" : "cloudy";
      return r < 0.5 ? "cloudy" : "sunny";
    case "August break":
      return r < 0.6 ? "cloudy" : r < 0.9 ? "sunny" : "rain";
    case "Minor rains":
      if (dayWet < 0.35) return r < 0.15 ? "storm" : r < 0.6 ? "rain" : "cloudy";
      return r < 0.55 ? "sunny" : "cloudy";
  }
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Akwasidae falls every 42 days, always on a Sunday (day 0 of the game is a Monday). */
export const AKWASIDAE_OFFSET = 6;
export const daysToAkwasidae = (day: number) => (((AKWASIDAE_OFFSET - day) % 42) + 42) % 42;
