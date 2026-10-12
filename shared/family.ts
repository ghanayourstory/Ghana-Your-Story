// Your family: parents, brothers and sisters, a grandmother, living in the
// hometown you chose. They have their own lives: they call, ask for help now
// and then, send you things, and are glad when you visit. Names follow the
// main languages of the region; real families vary, and players can always
// meet relatives with other names in play.
import { mulberry32 } from "./rng.ts";
import { TOWN_BY_ID, type RegionId } from "./ghana.ts";

export type FamilyRole = "mother" | "father" | "grandmother" | "brother" | "sister";
export interface FamilyMember {
  role: FamilyRole;
  name: string;
  age: number;
  town: string;
  feminine: boolean;
}

type Pool = { m: string[]; f: string[]; surnames: string[]; mum: string; dad: string; gran: string };
const AKAN: Pool = { m: ["Kwame", "Kofi", "Yaw", "Kwaku", "Kwabena", "Kwasi", "Kojo", "Kwadwo"], f: ["Ama", "Akua", "Yaa", "Afua", "Abena", "Adwoa", "Esi", "Efua", "Akosua"], surnames: ["Mensah", "Owusu", "Boateng", "Asante", "Osei", "Appiah", "Agyeman", "Ofori", "Amoah"], mum: "Maa", dad: "Paa", gran: "Nana" };
const GA: Pool = { m: ["Nii Armah", "Nii Lante", "Nii Odartey", "Nii Ayi", "Nii Okai"], f: ["Naa Ayeley", "Naa Dedei", "Naa Korkor", "Naa Adjeley", "Naa Shormeh"], surnames: ["Tetteh", "Quaye", "Lamptey", "Ankrah", "Quartey", "Annan", "Sowah"], mum: "Mama", dad: "Daddy", gran: "Naa" };
const EWE: Pool = { m: ["Kodzo", "Kwami", "Selasi", "Elikem", "Mawuli", "Edem", "Yao"], f: ["Afi", "Dzifa", "Enyonam", "Esinam", "Akpene", "Delali", "Abla"], surnames: ["Agbeko", "Ahiable", "Dzokoto", "Kpodo", "Amegashie", "Gbedemah", "Akakpo"], mum: "Dada", dad: "Papa", gran: "Mama" };
const NORTH: Pool = { m: ["Abdul-Rahman", "Fuseini", "Issah", "Alhassan", "Yakubu", "Abubakari", "Iddrisu"], f: ["Amina", "Mariama", "Salamatu", "Fati", "Hawa", "Ayishetu", "Rahinatu"], surnames: ["Iddrisu", "Abdulai", "Mahama", "Seidu", "Alhassan", "Sulemana", "Yakubu"], mum: "Ma", dad: "Baba", gran: "Mma" };
const UPPER_EAST: Pool = { m: ["Atia", "Ayinbisa", "Akolgo", "Anabila", "Aduko", "Azure"], f: ["Atampoka", "Ayamba", "Asibi", "Akolpoka", "Adongo", "Azumah"], surnames: ["Ayamga", "Atinga", "Akolgo", "Anabila", "Aduko", "Apuri"], mum: "Ma", dad: "Ba", gran: "Yaaba" };
const UPPER_WEST: Pool = { m: ["Bayor", "Der", "Naa-Ile", "Kuuire", "Dery", "Sebastian"], f: ["Mwinsuur", "Ninfaa", "Ziem", "Faustina", "Mwinbelle", "Gifty"], surnames: ["Dery", "Bayor", "Kuuire", "Naa", "Kanton", "Saanuo"], mum: "Ma", dad: "Saa", gran: "Mma" };

export function namePool(region: RegionId): Pool {
  if (region === "greater_accra") return GA;
  if (region === "volta" || region === "oti") return EWE;
  if (region === "northern" || region === "savannah" || region === "north_east") return NORTH;
  if (region === "upper_east") return UPPER_EAST;
  if (region === "upper_west") return UPPER_WEST;
  return AKAN;
}

/** The family you start with: parents, a grandmother, an older and a younger sibling. */
export function makeFamily(seed: number, hometown: string, surname: string | null): FamilyMember[] {
  const rnd = mulberry32(seed * 2654435761 >>> 0);
  const town = TOWN_BY_ID[hometown];
  const pool = namePool(town?.region ?? "ashanti");
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const sn = surname ?? pick(pool.surnames);
  const out: FamilyMember[] = [
    { role: "mother", name: `${pool.mum} ${pick(pool.f)}`, age: 50 + Math.floor(rnd() * 12), town: hometown, feminine: true },
    { role: "father", name: `${pool.dad} ${pick(pool.m)} ${sn}`, age: 55 + Math.floor(rnd() * 12), town: hometown, feminine: false },
    { role: "grandmother", name: `${pool.gran} ${pick(pool.f)}`, age: 74 + Math.floor(rnd() * 12), town: hometown, feminine: true },
  ];
  const olderBrother = rnd() < 0.5;
  out.push({ role: olderBrother ? "brother" : "sister", name: pick(olderBrother ? pool.m : pool.f), age: 30 + Math.floor(rnd() * 6), town: rnd() < 0.5 ? "kumasi" : hometown, feminine: !olderBrother });
  const youngerBrother = rnd() < 0.5;
  out.push({ role: youngerBrother ? "brother" : "sister", name: pick(youngerBrother ? pool.m : pool.f), age: 14 + Math.floor(rnd() * 4), town: hometown, feminine: !youngerBrother });
  return out;
}

export interface FamilyRequest {
  reason: string;
  amount: number; // GH₵
  dueDay: number;
}

/** What someone might ask for, by who they are. */
export function requestFor(m: { role: FamilyRole; age: number }, rnd: () => number): Omit<FamilyRequest, "dueDay"> {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const round = (n: number) => Math.round(n / 10) * 10;
  if (m.role === "grandmother") return pick([{ reason: "medicine from the pharmacy", amount: round(60 + rnd() * 80) }, { reason: "a new cloth for the festival", amount: round(80 + rnd() * 120) }]);
  if (m.role === "mother") return pick([{ reason: "stock for her market table", amount: round(150 + rnd() * 200) }, { reason: "a hospital bill", amount: round(120 + rnd() * 180) }, { reason: "the church harvest contribution", amount: round(50 + rnd() * 100) }]);
  if (m.role === "father") return pick([{ reason: "roofing sheets for the family house", amount: round(300 + rnd() * 500) }, { reason: "a funeral contribution for a relative", amount: round(100 + rnd() * 200) }]);
  if (m.age < 20) return pick([{ reason: "school fees", amount: round(200 + rnd() * 250) }, { reason: "exam registration", amount: round(80 + rnd() * 80) }, { reason: "textbooks and a calculator", amount: round(60 + rnd() * 90) }]);
  return pick([{ reason: "rent until month end", amount: round(200 + rnd() * 300) }, { reason: "a loan for their shop", amount: round(250 + rnd() * 350) }]);
}

export const ROLE_LABEL: Record<FamilyRole, string> = { mother: "Mother", father: "Father", grandmother: "Grandmother", brother: "Brother", sister: "Sister" };

// ---------------------------------------------------------------------------
// Where family members are during the week, and chores you can help with at
// the family house. Schoolchildren are at school on weekdays, parents work,
// grandma is home. Worship day follows the region (Friday prayers where most
// people are Muslim, Sunday service elsewhere).

export type Whereabouts = "home" | "school" | "work" | "worship" | "asleep";
const MUSLIM_REGIONS: RegionId[] = ["northern", "savannah", "north_east"];

export function familyWhereabouts(m: { role: FamilyRole; age: number }, hometown: string, weekday: number, hour: number): Whereabouts {
  if (hour < 5 || hour >= 22) return "asleep";
  const region = TOWN_BY_ID[hometown]?.region ?? "ashanti";
  const muslim = MUSLIM_REGIONS.includes(region);
  if (muslim ? weekday === 5 && hour >= 12 && hour < 14 : weekday === 0 && hour >= 8 && hour < 11) return m.role === "grandmother" && m.age >= 80 ? "home" : "worship";
  const weekdayTime = weekday >= 1 && weekday <= 5;
  if (m.age < 18) return weekdayTime && hour >= 7 && hour < 14 ? "school" : "home";
  if (m.role === "grandmother" || m.age >= 70) return "home";
  return (weekdayTime || weekday === 6) && hour >= 8 && hour < 16 ? "work" : "home";
}

export const WHEREABOUTS_LABEL: Record<Whereabouts, string> = { home: "at home", school: "at school", work: "at work", worship: "at church or the mosque", asleep: "asleep" };

export interface Chore {
  id: string;
  name: string;
  minutes: number;
  energy: number;
  /** Who it's with: everyone at home, or a specific role. */
  with: "all" | "young";
  blurb: string;
}

/** Chores at the family house; the cooking one depends on the region's food. */
export function choresFor(hometown: string): Chore[] {
  const region = TOWN_BY_ID[hometown]?.region ?? "ashanti";
  const cook: Chore =
    region === "volta" || region === "oti" ? { id: "cook", name: "Turn the akple", minutes: 60, energy: 10, with: "all", blurb: "Stand at the pot and turn the dough till your arm burns." }
    : ["northern", "savannah", "north_east", "upper_east", "upper_west"].includes(region) ? { id: "cook", name: "Stir the TZ", minutes: 60, energy: 10, with: "all", blurb: "Stir the TZ with the big paddle while someone picks ayoyo leaves." }
    : region === "greater_accra" ? { id: "cook", name: "Turn the banku", minutes: 60, energy: 10, with: "all", blurb: "Banku needs a strong arm. Grandma supervises." }
    : region === "central" || region === "western" ? { id: "cook", name: "Grind pepper for the fish", minutes: 45, energy: 6, with: "all", blurb: "Pepper, onion and tomato in the asanka while the fish fries." }
    : { id: "cook", name: "Pound the fufu", minutes: 60, energy: 14, with: "all", blurb: "You pound, someone turns. Don't lose a finger." };
  return [
    { id: "water", name: "Fetch water", minutes: 45, energy: 12, with: "all", blurb: "Buckets from the standpipe or borehole, for cooking and bathing." },
    { id: "sweep", name: "Sweep the compound", minutes: 30, energy: 6, with: "all", blurb: "Early-morning sweeping with a broom of palm fronds." },
    cook,
    { id: "homework", name: "Help with homework", minutes: 60, energy: 4, with: "young", blurb: "Maths and English for the young one, at the table under the bulb." },
  ];
}
