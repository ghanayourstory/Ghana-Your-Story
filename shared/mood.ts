// Mood, Sims-style: a handful of "moodlets" that say why you feel the way you
// do, each worth a little up or down. Poverty, faith, family set-up or
// disability are never a mood penalty; neglected needs and stress are.
export interface MoodInput {
  stats: { energy: number; hunger: number; health: number; social: number; fun: number; hygiene: number; bladder: number };
  homeTier: string;
  comfort: number;
  partnered: boolean;
  rentArrears: boolean;
  hasCar: boolean;
  helpedFamily?: boolean;
  missingHome?: boolean;
}
export interface Moodlet {
  id: string;
  icon: string;
  label: string;
  why: string;
  value: number;
}
export interface Mood {
  score: number;
  label: string;
  face: string;
  moodlets: Moodlet[];
}

export const NEEDS = [
  { key: "hunger", label: "Hunger", icon: "🍲", tip: "Eat at a chop bar, buy street food or cook at home." },
  { key: "energy", label: "Energy", icon: "⚡", tip: "Sleep or nap at home. Coffee helps a little." },
  { key: "bladder", label: "Bladder", icon: "🚻", tip: "Use the toilet at home, or the pay toilet at a station, market or mall." },
  { key: "hygiene", label: "Hygiene", icon: "🚿", tip: "Shower or bath at home. Swimming helps too." },
  { key: "fun", label: "Fun", icon: "🎉", tip: "TV, football, music, going out, the beach." },
  { key: "social", label: "Social", icon: "💬", tip: "Talk to people, sit with the neighbours, go on dates." },
] as const;

export function moodOf(m: MoodInput): Mood {
  const s = m.stats;
  const out: Moodlet[] = [];
  const add = (id: string, icon: string, label: string, why: string, value: number) => out.push({ id, icon, label, why, value });
  if (s.hunger < 20) add("starving", "😫", "Starving", "You need food now.", -3);
  else if (s.hunger < 40) add("hungry", "🍲", "Hungry", "Your stomach is talking.", -1);
  else if (s.hunger > 85) add("full", "😋", "Full belly", "A good meal makes everything better.", 1);
  if (s.energy < 15) add("exhausted", "🥱", "Exhausted", "You can barely keep your eyes open.", -3);
  else if (s.energy < 35) add("tired", "😪", "Tired", "A nap would help.", -1);
  else if (s.energy > 85) add("rested", "🌅", "Well rested", "A full night's sleep.", 1);
  if (s.bladder < 15) add("bursting", "😣", "Bursting!", "Find a toilet. Quickly.", -3);
  else if (s.bladder < 35) add("toilet", "🚻", "Needs the toilet", "It can wait a little.", -1);
  if (s.hygiene < 20) add("smelly", "🦨", "Smelly", "People notice. A bath would help.", -2);
  else if (s.hygiene > 85) add("fresh", "✨", "Fresh and clean", "Just bathed.", 1);
  if (s.fun < 20) add("bored", "😑", "Bored stiff", "Do something you enjoy.", -2);
  else if (s.fun > 80) add("fun", "😄", "Having a good time", "Life is sweet today.", 1);
  if (s.social < 20) add("lonely", "😔", "Lonely", "Call someone, or sit with the neighbours.", -2);
  else if (s.social > 80) add("connected", "🤝", "Feeling connected", "Good people around you.", 1);
  if (s.health < 30) add("unwell", "🤒", "Unwell", "See a doctor or rest.", -2);
  if (["villa", "penthouse", "mansion"].includes(m.homeTier)) add("living_large", "🏰", "Living large", "Your home is something else.", 2);
  else if (["apartment", "townhouse"].includes(m.homeTier)) add("nice_place", "🏠", "Nice place", "Your home is comfortable.", 1);
  if (m.comfort >= 4) add("comfy", "🛋️", "Comfy home", "You've furnished it well.", 1);
  if (m.partnered) add("in_love", "❤️", "In love", "Someone special in your life.", 2);
  if (m.helpedFamily) add("helped_family", "🤲", "Helped the family", "You came through for someone at home.", 1);
  if (m.missingHome) add("missing_home", "🏡", "Missing home", "It's been a while since you called home.", -1);
  if (m.hasCar) add("wheels", "🚗", "Got wheels", "No more waiting for trotros.", 1);
  if (m.rentArrears) add("rent_due", "🧾", "Rent is overdue", "The landlord has been calling.", -2);
  const score = out.reduce((a, b) => a + b.value, 0);
  const [label, face] = score >= 4 ? ["Very happy", "😄"] : score >= 1 ? ["Happy", "🙂"] : score >= -1 ? ["Fine", "😐"] : score >= -4 ? ["Uncomfortable", "😕"] : ["Miserable", "😞"];
  return { score, label, face, moodlets: out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) };
}
