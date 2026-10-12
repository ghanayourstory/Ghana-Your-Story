// Townsfolk: three named people in every regional town that the hand-written
// cast doesn't cover yet: a market trader, a lorry-station driver and a
// clinic nurse. They keep a daily routine you can watch (walking in from the
// station, to church on Sunday, home at night), you can befriend them, and
// each one's favour does something real in their town. Names follow the main
// languages of the region; hand-written characters can replace them later.
import { MUSLIM_MAJORITY, REGIONAL_DISTRICTS, REGIONAL_PLACES } from "./regional.ts";
import { REGIONAL_NPCS } from "./people-regional.ts";
import { namePool } from "./family.ts";
import { TOWN_BY_ID, type RegionId } from "./ghana.ts";
import { hash32 } from "./rng.ts";
import type { Npc, ScheduleBlock } from "./people.ts";

const memory = ["I still remember when {memory}.", "Ever since {memory}, you're one of us."];
const SKINS = ["#3B2416", "#4A2E1C", "#5A3520", "#5C3A22", "#6B4129", "#7A4A2C"];
const SHIRTS = ["#2E7D4F", "#C8452C", "#E3A857", "#2E86AB", "#F2EEE4", "#7A2E5A", "#0E7C86", "#B9824F"];

type Lang = "akan" | "ewe" | "muslim" | "north";
function langOf(region: RegionId): Lang {
  if (region === "volta" || region === "oti") return "ewe";
  if (MUSLIM_MAJORITY.includes(region)) return "muslim";
  if (region === "upper_east" || region === "upper_west") return "north";
  return "akan";
}
const WELCOME: Record<Lang, (town: string) => string[]> = {
  akan: (t) => [`Akwaaba! You're new in ${t}?`, "Ɛte sɛn? Come, come, don't stand in the sun."],
  ewe: (t) => [`Woezɔ! Welcome to ${t}.`, "Ŋdi! You're a visitor, eh? You're welcome."],
  muslim: (t) => [`Salaam alaikum! You've come to ${t}?`, "You're welcome. Sit, let them bring you water."],
  north: (t) => [`You're welcome to ${t}. Sit down, take water first.`, "Ah, a visitor! Greet the elders and you'll be fine here."],
};
const TITLE: Record<Lang, { trader: string; nurse: string }> = {
  akan: { trader: "Auntie", nurse: "Nurse" },
  ewe: { trader: "Auntie", nurse: "Nurse" },
  muslim: { trader: "Hajia", nurse: "Nurse" },
  north: { trader: "Madam", nurse: "Nurse" },
};
function goodsOf(region: RegionId): string {
  if (["northern", "savannah", "north_east", "upper_east", "upper_west"].includes(region)) return "Grain & shea butter";
  if (region === "volta" || region === "oti") return "Fish & gari";
  if (region === "central" || region === "western") return "Smoked fish";
  return "Plantain & cassava";
}

export const TOWNSFOLK: Npc[] = [];
export const TOWNSFOLK_COLORS: Record<string, string> = {};

for (const d of REGIONAL_DISTRICTS) {
  if (d.city === "accra") continue;
  if (REGIONAL_NPCS.filter((n) => n.district === d.id).length >= 2) continue;
  const region = TOWN_BY_ID[d.city]?.region ?? "ashanti";
  const lang = langOf(region);
  const pool = namePool(region);
  const places = REGIONAL_PLACES.filter((p) => p.district === d.id);
  const find = (k: string) => places.find((p) => p.kind === k);
  const market = find("market"), station = find("transport"), clinic = find("clinic"), food = find("food"), church = find("church"), mosque = find("mosque");
  if (!market || !station || !clinic) continue;
  const town = d.name;
  const h = hash32(d.id);
  const used = new Set<string>();
  const pick = <T,>(xs: T[], salt: number) => {
    // Different people in one town get different names.
    for (let k = 0; k < xs.length; k++) {
      const x = xs[(hash32(`${d.id}:${salt}:${k}`) + k) % xs.length];
      if (typeof x !== "string" || !used.has(x)) { if (typeof x === "string") used.add(x); return x; }
    }
    return xs[hash32(`${d.id}:${salt}`) % xs.length];
  };
  const surname = (salt: number) => pick(pool.surnames, salt);
  const look = (feminine: boolean, salt: number, headwear: "cap" | "headwrap" | "none") => ({
    skin: SKINS[hash32(`${d.id}:s${salt}`) % SKINS.length], shirt: SHIRTS[hash32(`${d.id}:t${salt}`) % SHIRTS.length], pants: feminine ? SHIRTS[hash32(`${d.id}:p${salt}`) % SHIRTS.length] : "#2B2B2B", hair: "#1A1410",
    feminine, height: feminine ? 1.6 + ((h >>> salt) % 8) / 100 : 1.7 + ((h >>> salt) % 10) / 100, build: 0.95 + ((h >>> (salt + 2)) % 20) / 100, headwear,
  });
  const sunday: ScheduleBlock[] = !MUSLIM_MAJORITY.includes(region) && church ? [{ days: "sunday", from: 8, to: 11, place: church.id }] : [];
  const evening: ScheduleBlock[] = food ? [{ days: "all", from: 18, to: 20, place: food.id }] : [];
  const greet = (stranger: string[]) => ({
    stranger,
    acquaintance: ["You're back! How is the body?", `Ah, ${town} is catching you small small.`],
    friend: ["My friend! Come, sit with me.", "You've become one of us. Everybody is asking about you."],
    close: ["You're family now. My house is your house.", "When you're away, people ask me where you went."],
  });
  const base = { district: d.id, romanceable: false };
  const lineBase = {
    yes: [] as string[], no: ["Hahaha! Go and find someone your own size."],
    coldRep: "People have been talking about you. Do your business and go well.",
    tired: "You look tired. Go and rest, the day is long.",
  };

  // 1. The market trader.
  const tf = pick(pool.f, 1);
  TOWNSFOLK.push({
    ...base,
    id: `tf_${d.id}_trader`,
    name: `${TITLE[lang].trader} ${tf} ${surname(2)}`,
    role: `${goodsOf(region)} seller, ${market.name}`,
    personality: "Quick with numbers and quicker with a joke. Knows what everything costs and who owes whom.",
    goal: "Build a proper lock-up shop and stop packing up every evening.",
    likes: { chat: 3, advice: 1, compliment: 2 },
    gift: { item: "a tin of Milo", cost: 30 },
    favour: { threshold: 35, ask: `Let me buy from your suppliers`, reward: `stock at ${market.name} costs you 5% less from now on.`, unlock: `trader_${market.id}` },
    schedule: [{ days: "weekday", from: 6, to: 17, place: market.id }, { days: "weekend", from: 7, to: 14, place: market.id }, ...sunday],
    look: look(true, 4, "headwrap"),
    lines: {
      ...lineBase,
      greet: greet(WELCOME[lang](town)),
      chat: [
        `Market day here is something else. You can't even pass.`,
        "Prices went up again. Transport, transport, transport.",
        `Have you been to ${d.landmark}? Everybody who comes to ${town} must see it.`,
        "My daughter wants to be a lawyer. Every coin I make is for her school fees.",
        "Buy in the morning, sell before the sun is hot. That's the secret.",
      ],
      advice: ["Don't sell on credit to people you don't know.", "Fruit doesn't wait. Sell it today or throw it tomorrow.", "Greet everybody. Customers remember who greeted them."],
      complimentLiked: ["Ei, you have a sweet mouth! Take one extra."],
      complimentDisliked: ["Sweet words don't reduce prices, my dear."],
      gift: ["Ah, for me? You're a good person. Thank you."],
      favourYes: "Come with me tomorrow at dawn. I'll introduce you to the women who bring the goods in. Tell them I sent you.",
      favourNo: "Hmm, my suppliers? Let me know you a little better first.",
      late: "We've packed up. Come tomorrow early.",
      memory,
    },
  });
  TOWNSFOLK_COLORS[`tf_${d.id}_trader`] = "#C8452C";

  // 2. The driver at the lorry station.
  const dm = pick(pool.m, 6);
  TOWNSFOLK.push({
    ...base,
    id: `tf_${d.id}_driver`,
    name: `${dm} ${surname(7)}`,
    role: `Trotro driver, ${station.name}`,
    personality: "Talks to every passenger, knows every pothole between here and the next three towns.",
    goal: "Own his bus outright instead of working and paying.",
    likes: { chat: 2, advice: 2, compliment: 1 },
    gift: { item: "a cold Malta", cost: 12 },
    favour: { threshold: 35, ask: "Vouch for me at the station", reward: "the whole station knows you're good people (+6 standing).", unlock: `driver_${d.id}` },
    schedule: [{ days: "all", from: 5, to: 18, place: station.id }, ...(MUSLIM_MAJORITY.includes(region) && mosque ? [{ days: "all" as const, from: 12, to: 13, place: mosque.id }] : []), ...evening],
    look: look(false, 8, lang === "muslim" ? "cap" : "none"),
    lines: {
      ...lineBase,
      greet: greet(WELCOME[lang](town)),
      chat: [
        "The road to the next town is finished on paper. On the ground, hmm.",
        "Fuel prices are killing us. Passengers don't want to hear it.",
        `Everybody comes through ${station.name} sooner or later.`,
        "One day I'll buy my own bus. Then I'll rest small.",
        "Police at the barrier know me now. They just wave.",
      ],
      advice: ["Never sit by the door on a long trip.", "Leave early. The road is kinder before the heat.", "Keep small change. Nobody has change."],
      complimentLiked: ["Hahaha! You can talk. Sit in front next time."],
      complimentDisliked: ["Compliments don't buy fuel, my friend."],
      gift: ["Ah, you know what a driver needs! Thank you."],
      favourYes: "Come, let me introduce you to the station master. From today, you're known here.",
      favourNo: "Let me see you around more first. The station has long memory.",
      late: "Last car has left. Come back at dawn.",
      memory,
    },
  });
  TOWNSFOLK_COLORS[`tf_${d.id}_driver`] = "#2E86AB";

  // 3. The nurse at the clinic.
  const nf = pick(pool.f, 10);
  TOWNSFOLK.push({
    ...base,
    id: `tf_${d.id}_nurse`,
    name: `${TITLE[lang].nurse} ${nf} ${surname(11)}`,
    role: `Nurse, ${clinic.name}`,
    personality: "Calm, firm and kind. Has seen everything and still asks how your mother is.",
    goal: "Get a proper ambulance for the town.",
    likes: { chat: 1, advice: 3, compliment: 1 },
    gift: { item: "a basket of fruit", cost: 40 },
    favour: { threshold: 40, ask: "Look after me when I'm sick", reward: `clinic and pharmacy visits in ${town} cost you half.`, unlock: `nurse_${d.id}` },
    schedule: [{ days: "weekday", from: 7, to: 16, place: clinic.id }, { days: "weekend", from: 8, to: 12, place: clinic.id }, ...sunday, ...evening],
    look: look(true, 12, "none"),
    lines: {
      ...lineBase,
      greet: greet(WELCOME[lang](town)),
      chat: [
        "Sleep under your net. Malaria doesn't care who you are.",
        "We have one doctor for the whole district. One.",
        "Drink water. In this heat, people forget.",
        "The young ones ride motorbikes without helmets, then they come to me.",
        "I've delivered half the babies in this town. They still greet me as Nurse.",
      ],
      advice: ["Don't wait until you're very sick. Come early.", "Wash your hands before you eat, especially from the roadside.", "Rest is also medicine."],
      complimentLiked: ["Hmm, thank you. Now drink your water."],
      complimentDisliked: ["Flattery won't skip you in the queue."],
      gift: ["Fruit! Finally somebody who listens to me."],
      favourYes: "If you fall sick, come straight to me. Don't queue. And don't tell everybody.",
      favourNo: "Let me know you a bit first. Then we'll see.",
      late: "The clinic is on night duty only. If it's serious, go in.",
      memory,
    },
  });
  TOWNSFOLK_COLORS[`tf_${d.id}_nurse`] = "#1F7A4D";
}
