// Today's hustle: three small goals a day, picked to fit the life you have
// (no "go to work" if you have no job). Skippable, one swap a day, and the
// reward is modest: they guide play, they don't replace it.
import { mulberry32 } from "./rng.ts";

export interface DailyGoalDef {
  id: string;
  icon: string;
  label: string;
  hint: string;
  target: number;
  /** Fictional GH₵ reward. */
  reward: number;
  /** Who gets offered this. */
  eligible: (c: DailyContext) => boolean;
}
export interface DailyContext {
  hasJob: boolean;
  hasBusiness: boolean;
  hasFarm: boolean;
  enrolled: boolean;
  hasKitchen: boolean;
  hasCar: boolean;
}
export interface DailyGoal {
  id: string;
  progress: number;
  done: boolean;
}
export interface DailyState {
  day: number;
  goals: DailyGoal[];
  swapped: boolean;
  bonusPaid: boolean;
  streak: number;
  lastFullDay: number;
}

const always = () => true;
export const DAILY_GOALS: Record<string, DailyGoalDef> = {
  shift: { id: "shift", icon: "💼", label: "Work a shift", hint: "Go to your workplace during shift hours.", target: 1, reward: 40, eligible: (c) => c.hasJob },
  job_hunt: { id: "job_hunt", icon: "📝", label: "Apply for a job", hint: "Places that are hiring show it on their door.", target: 1, reward: 30, eligible: (c) => !c.hasJob },
  eat_local: { id: "eat_local", icon: "🍲", label: "Eat at a chop bar or vendor", hint: "Waakye, banku, kelewele: any local spot.", target: 1, reward: 20, eligible: always },
  talk: { id: "talk", icon: "💬", label: "Talk to 2 people", hint: "Neighbours, vendors, coworkers.", target: 2, reward: 25, eligible: always },
  trotro: { id: "trotro", icon: "🚐", label: "Take a trotro", hint: "Catch one at a stop.", target: 1, reward: 20, eligible: (c) => !c.hasCar },
  drive: { id: "drive", icon: "🚗", label: "Drive somewhere in your own car", hint: "Travel by car from the map.", target: 1, reward: 25, eligible: (c) => c.hasCar },
  save: { id: "save", icon: "🏦", label: "Put GH₵50 or more in the bank", hint: "At a bank or a mobile-money agent.", target: 1, reward: 20, eligible: always },
  clean: { id: "clean", icon: "🚿", label: "Bath before you go out", hint: "Shower, compound bathroom or bucket bath.", target: 1, reward: 15, eligible: always },
  cook: { id: "cook", icon: "🍳", label: "Cook at home", hint: "Coal pot or kitchen.", target: 1, reward: 25, eligible: (c) => c.hasKitchen },
  explore: { id: "explore", icon: "🧭", label: "Find a place you haven't been", hint: "Walk around: new places get added to your map.", target: 1, reward: 30, eligible: always },
  fun: { id: "fun", icon: "🎉", label: "Do something fun", hint: "TV, football, music, the beach, a night out.", target: 1, reward: 20, eligible: always },
  business: { id: "business", icon: "🏪", label: "Check on your business", hint: "Collect the till in person.", target: 1, reward: 35, eligible: (c) => c.hasBusiness },
  class: { id: "class", icon: "📚", label: "Attend a class", hint: "Go to your course.", target: 1, reward: 30, eligible: (c) => c.enrolled },
  farm: { id: "farm", icon: "🌱", label: "Work on your farm", hint: "Plant or harvest.", target: 1, reward: 35, eligible: (c) => c.hasFarm },
  post: { id: "post", icon: "📸", label: "Post on Vibes", hint: "Share something from your day.", target: 1, reward: 15, eligible: always },
};
/** Bonus for doing all three. */
export const DAILY_BONUS = 60;

function eligibleIds(c: DailyContext) {
  return Object.values(DAILY_GOALS).filter((g) => g.eligible(c)).map((g) => g.id);
}

/** Three goals for this player and day, deterministic. */
export function pickDaily(playerId: number, day: number, c: DailyContext): string[] {
  const pool = eligibleIds(c);
  const rnd = mulberry32(playerId * 7919 + day * 104729);
  // Work or job hunting is usually one of them; the rest are a mix.
  const first = pool.includes("shift") ? "shift" : pool.includes("job_hunt") && rnd() < 0.7 ? "job_hunt" : null;
  const rest = pool.filter((id) => id !== first && id !== "shift" && id !== "job_hunt").sort(() => rnd() - 0.5);
  return [...(first ? [first] : []), ...rest].slice(0, 3);
}

/** A replacement for one goal: the next eligible one not already on the list. */
export function swapCandidate(playerId: number, day: number, c: DailyContext, current: string[]): string | null {
  const rnd = mulberry32(playerId * 31 + day * 977);
  const pool = eligibleIds(c).filter((id) => !current.includes(id)).sort(() => rnd() - 0.5);
  return pool[0] ?? null;
}
