// Careers: what kind of work each job is, how you get it, how you grow in
// it, and the small decisions a shift brings. Employers, pay and outcomes are
// game content (fictional); nothing here states real Ghanaian wages, labour
// rules or qualifications. Pay is in GH₵ per shift (salaried jobs accrue and
// pay monthly on the 28th, in the game).

import type { Job } from "./world.ts";

export type EmploymentType = "formal" | "public" | "contract" | "informal" | "apprenticeship";
export type Sector = "health" | "education" | "construction" | "retail" | "hospitality" | "transport" | "agriculture" | "energy" | "finance" | "public_service" | "tech" | "creative" | "security" | "tourism";

export const SECTOR_LABEL: Record<Sector, string> = {
  health: "🏥 Health & care", education: "🎓 Teaching", construction: "🔧 Trades & repair", retail: "🧺 Retail & trading", hospitality: "🍲 Food & hospitality",
  transport: "🚐 Transport & logistics", agriculture: "🌱 Farming & cocoa", energy: "⛽ Mining & energy", finance: "🏦 Banking & finance", public_service: "🏛️ Public service",
  tech: "💻 Technology", creative: "🎨 Crafts & creative", security: "🛡️ Security", tourism: "🧭 Tourism",
};
export const TYPE_LABEL: Record<EmploymentType, string> = {
  formal: "Formal employment (payslip)", public: "Public service", contract: "Contract / gig (paid per job)", informal: "Informal, paid in cash daily", apprenticeship: "Apprenticeship (learning while earning a little)",
};

interface Profile {
  sector: Sector;
  type: EmploymentType;
  /** Rank titles from entry to head (5 levels). */
  ladder: [string, string, string, string, string];
  /** Daily cost of getting there and working (transport, uniform upkeep), GH₵: shown, not hidden. */
  workCost: number;
  /** Courses that help you get it or grow in it. */
  courses: string[];
}
const P = (sector: Sector, type: EmploymentType, ladder: Profile["ladder"], workCost: number, courses: string[] = []): Profile => ({ sector, type, ladder, workCost, courses });

/** Keyed by the job's base id (town copies share it: trotro_mate__adum → trotro_mate). */
const PROFILES: Record<string, Profile> = {
  market_loader: P("retail", "informal", ["Loader", "Loader", "Head loader", "Gang leader", "Gang leader"], 0),
  trotro_mate: P("transport", "informal", ["Mate", "Mate", "Senior mate", "Line supervisor", "Station master's aide"], 0, ["driving_b"]),
  waakye_server: P("hospitality", "informal", ["Server", "Server", "Head server", "Kitchen hand", "Supervisor"], 0, ["catering"]),
  beach_bar_staff: P("hospitality", "informal", ["Host", "Host", "Senior host", "Bar supervisor", "Bar manager"], 6),
  call_centre: P("finance", "formal", ["Agent", "Agent", "Senior agent", "Team lead", "Floor manager"], 18, ["ict"]),
  bank_teller: P("finance", "formal", ["Teller", "Bank officer", "Senior officer", "Branch supervisor", "Branch manager"], 22, ["accounting", "mba"]),
  property_agent: P("finance", "contract", ["Agent", "Agent", "Senior agent", "Lead agent", "Principal"], 15),
  software_dev: P("tech", "formal", ["Junior developer", "Developer", "Senior developer", "Lead developer", "Head of engineering"], 20, ["ict", "mba"]),
  chop_cook: P("hospitality", "informal", ["Cook", "Cook", "Head cook", "Kitchen supervisor", "Kitchen supervisor"], 0, ["catering"]),
  barber_apprentice: P("creative", "apprenticeship", ["Apprentice", "Apprentice", "Barber", "Senior barber", "Master barber"], 0),
  tailor_apprentice: P("creative", "apprenticeship", ["Apprentice", "Apprentice", "Seamstress / tailor", "Senior tailor", "Master tailor"], 0, ["tailoring"]),
  night_watchman: P("security", "formal", ["Guard", "Guard", "Senior guard", "Shift supervisor", "Security supervisor"], 4),
  nursing_aide: P("health", "public", ["Nursing aide", "Nursing aide", "Senior aide", "Ward assistant lead", "Ward coordinator"], 8, ["nursing"]),
  pupil_teacher: P("education", "contract", ["Tutor", "Tutor", "Senior tutor", "Lead tutor", "Programme head"], 6),
  fitting_mechanic: P("construction", "informal", ["Mechanic", "Mechanic", "Senior mechanic", "Workshop lead", "Master mechanic"], 0, ["mechanic"]),
  delivery_rider: P("transport", "contract", ["Rider", "Rider", "Top rider", "Fleet captain", "Fleet captain"], 0, ["riding_a"]),
  ride_driver: P("transport", "contract", ["Driver", "Driver", "Top-rated driver", "Fleet lead", "Fleet lead"], 0, ["driving_b"]),
  hotel_manager: P("hospitality", "formal", ["Duty manager", "General manager", "General manager", "Group manager", "Director"], 25, ["mba"]),
  kejetia_trader: P("retail", "informal", ["Shop assistant", "Shop assistant", "Senior assistant", "Stall manager", "Stall manager"], 0),
  fitter: P("construction", "apprenticeship", ["Apprentice", "Apprentice", "Fitter", "Senior fitter", "Master fitter"], 0, ["mechanic"]),
  shea_processor: P("agriculture", "informal", ["Processor", "Processor", "Senior processor", "Group leader", "Cooperative lead"], 0, ["agribusiness"]),
  waterfall_guide: P("tourism", "contract", ["Guide", "Guide", "Senior guide", "Lead guide", "Head guide"], 0, ["tour_guide"]),
  yam_loader: P("agriculture", "informal", ["Loader", "Loader", "Head loader", "Gang leader", "Gang leader"], 0),
  cashew_clerk: P("agriculture", "formal", ["Clerk", "Clerk", "Senior clerk", "Warehouse supervisor", "Warehouse manager"], 6, ["accounting", "agribusiness"]),
  cashew_buyer: P("agriculture", "contract", ["Buying agent", "Buying agent", "Senior agent", "District buyer", "Regional buyer"], 10, ["agribusiness"]),
  harbour_clerk: P("transport", "formal", ["Tally clerk", "Tally clerk", "Senior clerk", "Shed supervisor", "Shed manager"], 12, ["accounting"]),
  rig_technician: P("energy", "formal", ["Technician", "Technician", "Senior technician", "Lead technician", "Supervisor"], 15, ["mechanic"]),
  cocoa_clerk: P("agriculture", "formal", ["Purchasing clerk", "Purchasing clerk", "Senior clerk", "District officer", "District officer"], 6, ["accounting", "agribusiness"]),
  ahafo_cocoa_clerk: P("agriculture", "formal", ["Purchasing clerk", "Purchasing clerk", "Senior clerk", "District officer", "District officer"], 6, ["accounting", "agribusiness"]),
  teacher_tamale: P("education", "public", ["Teaching assistant", "Teaching assistant", "Teacher (game rank)", "Senior teacher", "Head of department"], 6),
  park_ranger: P("tourism", "public", ["Ranger assistant", "Ranger assistant", "Ranger (game rank)", "Senior ranger", "Head ranger"], 0, ["tour_guide"]),
  basket_weaver: P("creative", "informal", ["Weaver", "Weaver", "Senior weaver", "Group leader", "Master weaver"], 0),
  bead_maker: P("creative", "informal", ["Bead maker", "Bead maker", "Senior bead maker", "Workshop lead", "Master bead maker"], 0),
  kente_apprentice: P("creative", "apprenticeship", ["Apprentice", "Apprentice", "Weaver", "Senior weaver", "Master weaver"], 0),
  farmhand: P("agriculture", "informal", ["Farmhand", "Farmhand", "Senior farmhand", "Team leader", "Farm supervisor"], 0, ["agribusiness"]),
  fishing_crew: P("agriculture", "informal", ["Crew", "Crew", "Senior crew", "Net master", "Canoe captain's mate"], 0),
  pond_guide: P("tourism", "informal", ["Guide", "Guide", "Senior guide", "Lead guide", "Lead guide"], 0, ["tour_guide"]),
  falls_guide: P("tourism", "informal", ["Guide", "Guide", "Senior guide", "Lead guide", "Lead guide"], 0, ["tour_guide"]),
  lodge_receptionist: P("hospitality", "formal", ["Receptionist", "Receptionist", "Senior receptionist", "Front office lead", "Lodge manager"], 4),
};
const FALLBACK = P("retail", "informal", ["Worker", "Worker", "Senior", "Lead", "Head"], 0);

export const baseJobId = (id: string) => id.split("__")[0];
export function profileOf(job: Job): Profile {
  return PROFILES[baseJobId(job.id)] ?? FALLBACK;
}
/** Jobs that need an application and an interview; the rest start on the spot. */
export const needsInterview = (job: Job) => {
  const t = profileOf(job).type;
  return t === "formal" || t === "public" || !!job.salaried;
};
/** Changing job within a sector keeps some seniority (game rule). */
export const rankOnSwitch = (fromJob: Job | null, fromRank: number, toJob: Job) =>
  fromJob && profileOf(fromJob).sector === profileOf(toJob).sector ? Math.max(0, fromRank - 1) : 0;

export const SHIFTS_PER_RANK_HINT = "Promotion: enough shifts at this level and a good recent record (average performance 90% or better).";

// ---------------------------------------------------------------------------
// Interviews and on-shift decisions (short, role-appropriate, game content).

export interface Choice { id: string; label: string; score: number; note: string }
export interface Scenario { id: string; prompt: string; choices: Choice[] }
const S = (id: string, prompt: string, choices: [string, string, number, string][]): Scenario => ({ id, prompt, choices: choices.map(([cid, label, score, note]) => ({ id: cid, label, score, note })) });

export const INTERVIEW: Scenario = S("interview", "The panel asks: \"Tell us about a time you handled pressure at work or at home.\"", [
  ["specific", "Give a specific example: what happened, what you did, what you learned", 1, "Clear, honest and specific. The panel takes notes."],
  ["general", "Say you're hard-working and never get stressed", 0.4, "Polite, but they wanted an example."],
  ["joke", "Make a joke and change the subject", 0.1, "They smile, but it doesn't help."],
]);

export const SHIFT_TASKS: Record<Sector, Scenario[]> = {
  transport: [
    S("short_fare", "A passenger is GH₵2 short of the fare and the trotro is about to move.", [["let_pay_later", "Let them ride; ask them to pay next time", 0.7, "Kind, a little loss; regulars remember you."], ["firm", "Politely ask them to get down at the next stop", 0.6, "Fair, if a bit cold."], ["shout", "Shout at them in front of everyone", 0.1, "The other passengers aren't impressed."]]),
    S("full_bus", "The bus is full but three more people are waving at the stop.", [["no_overload", "Pass them: no overloading", 1, "Safe and legal. The driver nods."], ["squeeze", "Squeeze them in on the gearbox", 0.2, "Unsafe; a police barrier ahead makes it worse."]]),
  ],
  health: [
    S("triage", "Three patients arrive at once: a feverish child, a man with a cut finger, an elderly woman short of breath.", [["breath_first", "Call the nurse to the woman short of breath first", 1, "Right call: breathing first."], ["child_first", "Start with the child; the mother is upset", 0.6, "Understandable, but not the most urgent."], ["arrival", "First come, first served", 0.3, "Fair-seeming, but not how triage works."]]),
    S("records", "A relative asks you to read out another patient's results.", [["refuse", "Explain you can't share other patients' information", 1, "Correct. Privacy matters."], ["share", "Read them out to be helpful", 0, "That's a serious breach."]]),
  ],
  education: [
    S("struggling", "A pupil keeps getting the same sums wrong and is close to tears.", [["slow", "Sit with them and go back one step", 1, "They get it, slowly. Confidence returns."], ["move_on", "Move on so the class keeps pace", 0.5, "The class keeps up; one pupil falls behind."], ["scold", "Tell them to try harder", 0.1, "Tears. Nothing learned."]]),
  ],
  hospitality: [
    S("rush", "Lunch rush: orders are piling up and a customer complains their food is cold.", [["replace", "Apologise and get a hot plate out first", 1, "They come back next week."], ["argue", "Say it left the kitchen hot", 0.2, "They post about it."], ["ignore", "Carry on with the queue", 0.4, "Fast, but one unhappy customer."]]),
    S("hygiene", "The water for washing plates is getting low and dirty.", [["change", "Stop and change it now", 1, "Clean plates; nobody falls ill."], ["later", "Finish the rush first", 0.5, "Risky."]]),
  ],
  retail: [
    S("haggle", "A customer haggles hard for the last three yards of a popular cloth.", [["fair", "Hold a fair price and throw in a small extra", 1, "Sale made, customer happy."], ["cave", "Give the price they want", 0.5, "Sold, but at a loss to the stall."], ["refuse", "Refuse to discuss price", 0.3, "They walk to the next stall."]]),
    S("count", "At closing, the cash is GH₵20 short of the sales book.", [["recount", "Recount and report it honestly to the owner", 1, "Turns out a note was stuck. Trust earned."], ["hide", "Top it up quietly from your pocket", 0.4, "The books balance, your pocket doesn't."]]),
  ],
  construction: [
    S("brakes", "A taxi driver wants his brake pads done 'quickly, no need to check the discs'.", [["check", "Check the discs anyway and explain", 1, "Worn discs: you've saved a life."], ["quick", "Do it quickly as asked", 0.4, "Fast money; the squeal comes back."]]),
  ],
  agriculture: [
    S("weigh", "A farmer's cocoa bags look a little wet on the scale.", [["fair_weigh", "Ask them to dry it properly; weigh it tomorrow", 1, "Fair grading; trust with the farmers grows."], ["dock", "Weigh it and dock a big amount", 0.4, "Legal, but the farmer feels cheated."], ["accept", "Weigh it as it is", 0.3, "The warehouse finds mould later."]]),
  ],
  energy: [
    S("permit", "A job needs a hot-work permit and the supervisor isn't answering.", [["wait", "Wait and keep calling", 1, "Safety first. The job runs late but safe."], ["go", "Start without the permit", 0, "A near miss. Serious trouble."]]),
  ],
  finance: [
    S("transfer", "A customer wants to send a large amount to someone they've 'only met online'.", [["warn", "Explain common scams and suggest they check first", 1, "They thank you later. It was a scam."], ["process", "Process it: it's their money", 0.4, "Quick, but they lose it."]]),
    S("queue", "The system goes down with a long queue waiting.", [["explain", "Tell the queue honestly and take details for callbacks", 1, "People are frustrated but respect it."], ["hide", "Say nothing and hope it comes back", 0.2, "The queue gets angry."]]),
  ],
  public_service: [
    S("form", "Someone has the wrong form and has travelled far.", [["help", "Help them fill the right one now", 1, "They leave relieved."], ["send_back", "Tell them to come back tomorrow", 0.3, "Correct, but unkind."]]),
  ],
  tech: [
    S("bug", "A bug is found an hour before the release.", [["delay", "Tell the team and delay the release", 1, "Released tomorrow, bug-free."], ["ship", "Ship it and fix later", 0.4, "Customers notice."]]),
  ],
  creative: [
    S("deadline", "A customer needs their outfit for a wedding tomorrow; you're behind.", [["honest", "Tell them now and work late to finish", 1, "Done, a little tired, very happy customer."], ["rush", "Rush it without fitting", 0.4, "It's a bit tight."]]),
  ],
  security: [
    S("stranger", "Someone without a visitor tag wants to go 'just quickly' to the ward.", [["check", "Politely check with reception first", 1, "Correct. It was fine, once checked."], ["wave", "Wave them through", 0.3, "Nothing happened this time."]]),
  ],
  tourism: [
    S("safety", "A visitor wants to climb onto wet rocks by the falls for a photo.", [["no", "Explain the danger and offer a better spot", 1, "Great photo, nobody hurt."], ["allow", "Let them; it's their choice", 0.2, "A slip and a twisted ankle."]]),
  ],
};
/** The decision for your next shift (deterministic, so the server can check it). */
export function shiftTask(job: Job, shiftsTotal: number, day: number): Scenario {
  const list = SHIFT_TASKS[profileOf(job).sector];
  return list[(shiftsTotal + day) % list.length];
}
