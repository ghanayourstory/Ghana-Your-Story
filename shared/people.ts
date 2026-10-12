// The people of Ghana: Your Story: personalities, goals, daily routines and how they talk.
import { pick } from "./rng.ts";
import type { DistrictId } from "./world.ts";
import { REGIONAL_NPCS } from "./people-regional.ts";
import { TOWNSFOLK } from "./townsfolk.ts";

export type Topic = "chat" | "advice" | "compliment" | "gift" | "ask_out" | "favour" | "call";
export type Tier = "stranger" | "acquaintance" | "friend" | "close";

export interface ScheduleBlock {
  days: "all" | "weekday" | "weekend" | "sunday";
  from: number;
  to: number;
  place: string;
}

export interface Look {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  feminine: boolean;
  height: number; // metres
  build: number; // 0.85 slim .. 1.2 broad
  headwear?: "cap" | "headwrap" | "none";
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  district: DistrictId;
  personality: string;
  goal: string;
  /** How much they enjoy each topic (−2..+3). */
  likes: Record<Exclude<Topic, "ask_out" | "favour" | "gift" | "call">, number>;
  gift: { item: string; cost: number };
  romanceable: boolean;
  favour: { threshold: number; ask: string; reward: string; unlock: string };
  schedule: ScheduleBlock[];
  look: Look;
  lines: {
    greet: Record<Tier, string[]>;
    chat: string[];
    advice: string[];
    complimentLiked: string[];
    complimentDisliked: string[];
    gift: string[];
    yes: string[];
    no: string[];
    favourYes: string;
    favourNo: string;
    coldRep: string;
    late: string;
    tired: string;
    memory: string[];
  };
}

export const NPCS: Npc[] = [
  {
    id: "esi",
    name: "Auntie Esi Owusu",
    role: "Waakye seller, Osu",
    district: "osu",
    personality: "Warm, nosy and generous. Mothers everybody, remembers everything.",
    goal: "Turn her roadside stand into a proper restaurant with a signboard and chairs.",
    likes: { chat: 3, advice: 1, compliment: 2 },
    gift: { item: "a bag of Ayigbe biscuits", cost: 30 },
    romanceable: false,
    favour: { threshold: 45, ask: "Teach me your waakye secrets", reward: "Your food businesses earn 10% more.", unlock: "esi_recipe" },
    schedule: [
      { days: "all", from: 5, to: 14, place: "esi_waakye" },
      { days: "sunday", from: 15, to: 18, place: "osu_night_market" },
      { days: "weekday", from: 16, to: 19, place: "osu_night_market" },
    ],
    look: { skin: "#6B4226", shirt: "#E0A526", pants: "#7A2E2E", hair: "#1A1410", feminine: true, height: 1.62, build: 1.15, headwear: "headwrap" },
    lines: {
      greet: {
        stranger: ["Akwaaba! You look hungry, my dear. Waakye is ready.", "New face! Where are you from? Come and sit."],
        acquaintance: ["Ah, it's you again! The usual?", "Good morning o! Did you sleep well?"],
        friend: ["My child! I kept the egg aside for you.", "Ei, you've been working hard. I can see it on your face."],
        close: ["My son-daughter! Come here, let me look at you.", "You are family now. Sit, sit."],
      },
      chat: [
        "That Tetteh man raised everybody's rent again. Kaneshie people are suffering.",
        "One day I'll have chairs, a fan and a big signboard. 'Esi's Kitchen'. You watch.",
        "Dumsor spoiled my stew yesterday. Three hours, no light. Herh.",
        "Kwabena's trotro broke down on the motorway again. That boy and his engines!",
        "They say Yaa sold a plot in East Legon twice. Twice! I'm only saying what I heard.",
        "When it rains, nobody buys waakye. When it's hot, everybody wants sobolo. Business is weather.",
      ],
      advice: [
        "Eat before you work. An empty sack cannot stand.",
        "Every cedi you don't spend today is a brick for tomorrow.",
        "Food business is about the morning rush. Get there before the people.",
        "Don't borrow to show off. The bank doesn't care about your shoes.",
      ],
      complimentLiked: ["Ah! You and your sweet mouth. Take extra shito.", "Hehe, stop it. But say it again."],
      complimentDisliked: ["Flattery won't reduce the price, my dear."],
      gift: ["Ayigbe biscuits! You remembered! God bless you."],
      yes: [],
      no: ["Hahaha! Ei, at my age? Go and find somebody your size."],
      favourYes: "Come early tomorrow. The secret is patience and the leaves. Don't tell anybody.",
      favourNo: "My recipe? Hmm. Let me know you better first.",
      coldRep: "Hmm. People have been talking about you. Buy your food and go.",
      late: "I'm closing, my dear. Come back at dawn.",
      tired: "You look like you'll fall asleep in the waakye. Go and rest!",
      memory: ["I still remember when {memory}.", "Didn't I tell you? Ever since {memory}, I knew you'd go far."],
    },
  },
  {
    id: "kobby",
    name: "Kwabena “Kobby” Asante",
    role: "Trotro driver, Kaneshie",
    district: "kaneshie",
    personality: "Funny, loud, endlessly optimistic. A hustler with a big heart.",
    goal: "Own a fleet of five trotros and name them after his sisters.",
    likes: { chat: 3, advice: -1, compliment: 1 },
    gift: { item: "a cold Malta and kebab", cost: 25 },
    romanceable: false,
    favour: { threshold: 30, ask: "Get me a shift on your bus", reward: "You can work as a trotro mate any day, and trotro fares are free.", unlock: "kobby_ride" },
    schedule: [
      { days: "weekday", from: 5, to: 13, place: "kaneshie_station" },
      { days: "weekday", from: 17, to: 21, place: "blessed_hands" },
      { days: "weekend", from: 9, to: 15, place: "kaneshie_station" },
      { days: "weekend", from: 16, to: 22, place: "sunset_shack" },
    ],
    look: { skin: "#4A2E1C", shirt: "#2E86AB", pants: "#2B2B2B", hair: "#111", feminine: false, height: 1.76, build: 1.05, headwear: "cap" },
    lines: {
      greet: {
        stranger: ["Circle! Circle! Ah, you're not going? Chale, what's up?", "Massa, you look lost. Kaneshie can swallow you, o."],
        acquaintance: ["My guy! You dey?", "Chale! Back for more Kaneshie wahala?"],
        friend: ["My paddy! Today we chop money!", "Ei, the boss himself! Come, come."],
        close: ["Brother from another mother! When I get the fleet, one bus has your name on it.", "Where have you been? I was about to send search party!"],
      },
      chat: [
        "Fuel price went up again. I told the passengers, 'Blame Gov, not Kobby!'",
        "This bus is older than me but she never disappoints. Mostly.",
        "Five buses. Akua, Afua, Ama, Abena and Adwoa. Named after my sisters. You'll see.",
        "Uncle Ebo says Labadi Waves will win the league. That man has no eyes.",
        "The police at Kaneshie first junction know me by name. Not in a good way.",
        "One time a goat rode my trotro from Kasoa. It paid half fare.",
      ],
      advice: ["Morning is money. After 10 the passengers vanish.", "If you buy a trotro, buy a good mechanic first."],
      complimentLiked: ["Ah, you see it too! I'm a star!"],
      complimentDisliked: ["Hehe, don't bluff me, I know I'm fine."],
      gift: ["Malta! You know the way to a driver's heart."],
      yes: [],
      no: ["Chale, you're my paddy. Let's keep it that way!"],
      favourYes: "Done! Come to the station any morning. And trotro is free for you, my guy.",
      favourNo: "Small small. First let's know each other, my guy.",
      coldRep: "Eh. People are saying things about you. I don't want trouble at my station.",
      late: "Last trip is gone. Go home, it's late.",
      tired: "You're yawning more than my engine. Go and sleep.",
      memory: ["Ha! Remember when {memory}? Classic.", "Since {memory}, you're my real paddy."],
    },
  },
  {
    id: "akosua",
    name: "Akosua Mensah",
    role: "Treasury officer, Coastline Bank",
    district: "east_legon",
    personality: "Sharp, disciplined and dryly funny. Respects people who plan.",
    goal: "Become the youngest branch director in the bank's history.",
    likes: { chat: 1, advice: 3, compliment: -1 },
    gift: { item: "a book on African markets", cost: 180 },
    romanceable: true,
    favour: { threshold: 50, ask: "Could you look at my loan terms?", reward: "Your loan interest rate drops by 2 points.", unlock: "akosua_rate" },
    schedule: [
      { days: "weekday", from: 8, to: 17, place: "coastline_bank_hq" },
      { days: "weekday", from: 17, to: 19, place: "lagoon_cafe" },
      { days: "weekend", from: 9, to: 12, place: "legon_prime" },
      { days: "weekend", from: 19, to: 23, place: "legon_lounge" },
    ],
    look: { skin: "#5A3825", shirt: "#1F3A5F", pants: "#1A1A1A", hair: "#0D0D0D", feminine: true, height: 1.68, build: 0.92 },
    lines: {
      greet: {
        stranger: ["Good afternoon. Can I help you with an account?", "Hello. You're new to the bank?"],
        acquaintance: ["Ah, the saver. How are the numbers?", "Good to see you. Planning something?"],
        friend: ["There you are. I was just thinking about your portfolio. Strictly professionally.", "Hey you. Coffee later?"],
        close: ["Finally. My day just got better.", "You look good. Did you finally follow my budget?"],
      },
      chat: [
        "T-bill yields moved again this week. People sleep on them. Don't.",
        "My mother still thinks I count money all day with my hands.",
        "Everybody wants a V8. Nobody wants a budget.",
        "I run at Legon Prime on Saturdays. It's the only meeting I never cancel.",
        "The dollar moves, the cedi moves, and somehow rent only goes up.",
      ],
      advice: [
        "Keep three months of expenses in the bank before you invest a pesewa.",
        "T-bills are boring. Boring is how people get rich.",
        "Borrow for things that pay you back, like a business. Not for parties.",
        "Hold some dollars when the cedi is strong. Sell them when it isn't.",
      ],
      complimentLiked: ["Thank you."],
      complimentDisliked: ["Compliments are cheap. Show me a savings plan.", "Hm. Is that your negotiation strategy?"],
      gift: ["Oh, I've wanted this one. That's… thoughtful."],
      yes: ["Dinner at Skyline Lounge. Tomorrow at 8. Don't be late — I'm not.", "Okay. Yes. Skyline, tomorrow evening, 8 o'clock."],
      no: ["I like you, but I don't rush things. Ask me again some other time.", "Not yet. Let's see who you become."],
      favourYes: "Send me the file. There's a better rate for reliable customers, and you are one.",
      favourNo: "I can't bend rules for strangers. Bank with us longer.",
      coldRep: "I've heard some concerning things. I keep business professional.",
      late: "I'm off the clock. Talk tomorrow.",
      tired: "You look exhausted. Rest is also an investment.",
      memory: ["I keep thinking about when {memory}.", "You know, ever since {memory}, I've trusted you more."],
    },
  },
  {
    id: "selasi",
    name: "Selasi Agbeko",
    role: "DJ & painter, Labadi",
    district: "labadi",
    personality: "Free-spirited, perceptive and playful. Allergic to pretension.",
    goal: "Open a gallery-bar on the beach where young artists can sell their work.",
    likes: { chat: 2, advice: -1, compliment: 3 },
    gift: { item: "a set of acrylic paints", cost: 120 },
    romanceable: true,
    favour: { threshold: 25, ask: "Get me a spot behind the bar", reward: "You're hired at Sunset Shack without the charisma requirement.", unlock: "selasi_job" },
    schedule: [
      { days: "all", from: 10, to: 14, place: "labadi_beach" },
      { days: "all", from: 16, to: 24, place: "sunset_shack" },
      { days: "all", from: 0, to: 2, place: "sunset_shack" },
    ],
    look: { skin: "#3E2618", shirt: "#E35D3A", pants: "#E9DCC6", hair: "#0B0B0B", feminine: true, height: 1.7, build: 0.9 },
    lines: {
      greet: {
        stranger: ["You're standing in my light, stranger. Kidding. Hi.", "First time at the Shack? The sunset is free, the drinks aren't."],
        acquaintance: ["Oh hey, you came back. The vibe must be good.", "You again! Request a song, I dare you."],
        friend: ["My favourite regular! I saved you a seat by the speakers.", "There's my person. Sit, the sun is about to do its thing."],
        close: ["You're the best part of my evening. Don't tell the sunset.", "Come here, I painted something. It might be you."],
      },
      chat: [
        "I'm painting the fishermen's canoes. Every boat has a proverb on it, did you know?",
        "Rhythm House in Osu wants me to play. I said only if they let me play highlife.",
        "Nii Armah says the sea is angry this season. He's usually right.",
        "One day there'll be a gallery right here. Art on the walls, feet in the sand.",
        "Tourists ask if the horses are real. Bro. They are horses.",
      ],
      advice: ["Do one thing every day just because you love it. The money comes slower that way, but it stays."],
      complimentLiked: ["Okay, now you're making me blush. Keep going.", "Smooth. I'll allow it."],
      complimentDisliked: ["Hmm."],
      gift: ["Paints?! You actually listen when I talk. Wow."],
      yes: ["Tomorrow at sunset, here at the Shack. 7pm. Don't make me wait.", "Yes. Come find me at the Shack tomorrow, 7pm."],
      no: ["Not yet. I like slow songs.", "Ask me again when I know your middle name."],
      favourYes: "Done. Talk to the manager. Tell him Selasi sent you.",
      favourNo: "Let's be friends first, then we'll talk business.",
      coldRep: "People are talking about you here. Not good stuff. Fix it.",
      late: "Last song. Go home safe.",
      tired: "You're fading. Water, then bed.",
      memory: ["I keep thinking about when {memory}.", "Ever since {memory}, the Shack feels different."],
    },
  },
  {
    id: "nii",
    name: "Nii Armah Lartey",
    role: "Fisherman & community elder, La",
    district: "labadi",
    personality: "Patient, proud and wise. Speaks in proverbs. Respect is everything to him.",
    goal: "Keep La's young people working, and get the landing site a proper cold store.",
    likes: { chat: 1, advice: 3, compliment: -1 },
    gift: { item: "a bottle of schnapps for libation", cost: 90 },
    romanceable: false,
    favour: { threshold: 55, ask: "Will you speak for me in La?", reward: "+15 community standing, and beachfront land opens to you.", unlock: "nii_blessing" },
    schedule: [
      { days: "all", from: 5, to: 13, place: "fish_landing" },
      { days: "all", from: 16, to: 19, place: "labadi_beach" },
      { days: "sunday", from: 8, to: 11, place: "la_church" },
    ],
    look: { skin: "#3B2416", shirt: "#F7F3E8", pants: "#3E5641", hair: "#B5B5B5", feminine: false, height: 1.72, build: 1.1, headwear: "cap" },
    lines: {
      greet: {
        stranger: ["Ojekoo. You are not from La. What brings you to the sea?", "Mm. Young person. Greet first, then speak."],
        acquaintance: ["Ah, you came back. The sea remembers faces too.", "Ojekoo, my child."],
        friend: ["My son-daughter of La! Sit with an old man.", "You walk taller these days. Good."],
        close: ["You are one of us now. La knows your name.", "When I go to the ancestors, I'll tell them about you."],
      },
      chat: [
        "The canoe does not fear the wave; it fears the man who doesn't paddle.",
        "Fish is getting far from the shore. The big ships take everything at night.",
        "When I was your age, Labadi had no hotels. Only nets and stars.",
        "The Homowo festival is when we hoot at hunger. You must come.",
        "A cold store. That's all this landing needs. Then our fish won't spoil by noon.",
      ],
      advice: [
        "Respect is the first wealth. Money follows the respected man.",
        "Don't buy land you haven't walked on. Ask the family first.",
        "Help the community and it will carry you when you are tired.",
      ],
      complimentLiked: ["Mm."],
      complimentDisliked: ["Sweet words are like sea foam. Do something instead."],
      gift: ["Schnapps. You know our ways. Let me pour some for the ancestors."],
      yes: [],
      no: ["Hahaha! Go and greet someone your age."],
      favourYes: "I will speak for you. When I speak, La listens.",
      favourNo: "Respect is earned slowly, like a canoe is carved.",
      coldRep: "Your name has been spoiled in this town. Repair it before you speak to me.",
      late: "The night belongs to the spirits. Go home.",
      tired: "Even the strongest paddler rests.",
      memory: ["I remember when {memory}. You did well.", "Since {memory}, I've watched you."],
    },
  },
  {
    id: "tetteh",
    name: "Mr. Emmanuel Tetteh",
    role: "Landlord, Kaneshie",
    district: "kaneshie",
    personality: "Strict, suspicious, secretly sentimental. Hates late rent and loud music.",
    goal: "Build a second storey on his compound house before he retires.",
    likes: { chat: -1, advice: 1, compliment: 1 },
    gift: { item: "a tin of Milo and some bread", cost: 45 },
    romanceable: false,
    favour: { threshold: 40, ask: "Could you go easy on the rent?", reward: "Your Kaneshie rent drops by 15%.", unlock: "tetteh_discount" },
    schedule: [
      { days: "all", from: 6, to: 22, place: "tetteh_compound" },
      { days: "sunday", from: 8, to: 12, place: "kaneshie_church" },
    ],
    look: { skin: "#5C3A24", shirt: "#B8B8AA", pants: "#4A4036", hair: "#8C8C8C", feminine: false, height: 1.7, build: 1.12 },
    lines: {
      greet: {
        stranger: ["Yes? Who are you looking for?", "You're the new tenant? Rent is due on the first. Not the second."],
        acquaintance: ["Mm. Good morning.", "You're keeping the bathroom clean, I hope."],
        friend: ["Ah, my good tenant. Come, sit.", "You pay on time. That's rare. I like you."],
        close: ["You're like the son-daughter I wish I had. Don't tell my children.", "Sit, sit. Let me tell you about 1983."],
      },
      chat: [
        "In 1983, we ate gari for breakfast, lunch and supper. You people don't know suffering.",
        "Somebody keeps playing music at 2am. If I find out it's you…",
        "When the second floor is done, I'll finally have a balcony.",
        "Water came only twice this week. Buy a poly tank, it's the only way.",
      ],
      advice: ["Own your roof. Rent is money you'll never see again.", "Pay what you owe first, then enjoy what's left."],
      complimentLiked: ["Hm. Well. Thank you."],
      complimentDisliked: ["Are you trying to delay the rent?"],
      gift: ["Milo! Hm. You're a good tenant."],
      yes: [],
      no: ["Get out of here with that nonsense."],
      favourYes: "Fine. Fine! But tell nobody.",
      favourNo: "Rent is rent.",
      coldRep: "I've heard about you. One more complaint and you're out.",
      late: "It's late. Lock the gate behind you.",
      tired: "Go and sleep. And no music.",
      memory: ["I haven't forgotten when {memory}.", "Since {memory}, I know you're serious."],
    },
  },
  {
    id: "yaa",
    name: "Yaa Boateng",
    role: "Real-estate agent, East Legon",
    district: "east_legon",
    personality: "Charming, fast-talking and shrewd. Loyal once you prove yourself.",
    goal: "Develop her own gated estate in Spintex with forty homes.",
    likes: { chat: 2, advice: 1, compliment: 2 },
    gift: { item: "a box of chocolates from the mall", cost: 95 },
    romanceable: false,
    favour: { threshold: 40, ask: "Can you find me a good deal on land?", reward: "Land purchases cost 10% less.", unlock: "yaa_discount" },
    schedule: [
      { days: "weekday", from: 8, to: 18, place: "boateng_realty" },
      { days: "weekend", from: 10, to: 14, place: "lagoon_cafe" },
      { days: "weekend", from: 15, to: 18, place: "spintex_plaza" },
    ],
    look: { skin: "#6B4226", shirt: "#B03A62", pants: "#2A2A2A", hair: "#151010", feminine: true, height: 1.66, build: 1.0 },
    lines: {
      greet: {
        stranger: ["Hello! Looking for land? Everybody is. Sit down.", "Welcome to Boateng Realty. Land never loses value."],
        acquaintance: ["My client! Have you saved enough yet?", "Good to see you. I have something special."],
        friend: ["My favourite client! I've been keeping a plot for you.", "Ah, you! Come, let's talk business."],
        close: ["Partner! When are we building that estate together?", "You know I'd never sell you a bad plot. Never."],
      },
      chat: [
        "Spintex land doubled in five years. Trasacco? Don't even ask.",
        "Never pay a 'landguard'. Pay the family and get the indenture registered.",
        "Everybody wants East Legon. The smart money is going to Spintex.",
        "I sold a house to a returnee from London last week. Paid in dollars. Dollars!",
      ],
      advice: [
        "Buy land early, build slowly. Blocks don't spoil.",
        "A finished house is worth more than land plus cement. Finish what you start.",
        "Rent it out before you move in. Let it pay for itself.",
      ],
      complimentLiked: ["Ah, you have taste. That's why I like you."],
      complimentDisliked: ["Flattery is free. Land isn't."],
      gift: ["Chocolates! You know how to close a deal."],
      yes: [],
      no: ["Business and pleasure don't mix, my dear."],
      favourYes: "For you? I'll cut my commission. Ten percent off, just for you.",
      favourNo: "Deals like that are for my regulars.",
      coldRep: "Your name is not good in this market right now. Sorry.",
      late: "Office is closed. Text me.",
      tired: "You look tired. Real estate can wait one day.",
      memory: ["I remember when {memory}. Good decision.", "Since {memory}, I knew you had vision."],
    },
  },
  {
    id: "adjei",
    name: "Dr. Kofi Adjei",
    role: "Doctor, Sankofa Clinic",
    district: "osu",
    personality: "Calm, kind and a little tired. Lectures you gently about sleep.",
    goal: "Open a free weekend clinic for market traders.",
    likes: { chat: 1, advice: 2, compliment: 0 },
    gift: { item: "a good pair of running shoes", cost: 220 },
    romanceable: false,
    favour: { threshold: 35, ask: "Can I get regular check-ups?", reward: "Clinic visits cost half price.", unlock: "adjei_care" },
    schedule: [
      { days: "weekday", from: 7, to: 16, place: "sankofa_clinic" },
      { days: "weekday", from: 18, to: 20, place: "ridge_fitness" },
      { days: "weekend", from: 6, to: 8, place: "black_star_square" },
    ],
    look: { skin: "#4F3020", shirt: "#F2F2F2", pants: "#3A4A5A", hair: "#202020", feminine: false, height: 1.8, build: 0.98 },
    lines: {
      greet: {
        stranger: ["Hello. Are you feeling unwell?", "Good day. Take a seat, the queue is short today."],
        acquaintance: ["Ah, my patient. Sleeping well?", "Hello again. Hydrating?"],
        friend: ["My friend! You look healthier. Good.", "Ah, you. Walk with me, I need some air."],
        close: ["Good to see you, truly.", "My favourite non-patient."],
      },
      chat: [
        "Malaria cases go up with the rains. Sleep under a net.",
        "Half my patients are just exhausted. This city never rests.",
        "I jog to Black Star Square on weekends. The sea air is medicine.",
        "Market women work fourteen hours and never see a doctor. That must change.",
      ],
      advice: [
        "Eight hours of sleep is cheaper than any medicine I can sell you.",
        "If your health drops too low, you'll miss work. Don't let it.",
        "Exercise improves everything: mood, energy, even your bank account.",
      ],
      complimentLiked: ["Thank you. That's kind."],
      complimentDisliked: ["Thank you."],
      gift: ["Running shoes! Now I have no excuse. Thank you."],
      yes: [],
      no: ["I'm flattered, but I'm married to this clinic."],
      favourYes: "Of course. Come any time, I'll see you myself.",
      favourNo: "Let me get to know you as a patient first.",
      coldRep: "I treat everyone. But I've heard things. Be careful.",
      late: "Go home and sleep. Doctor's orders.",
      tired: "You're exhausted. Sleep now, or I'll be seeing you here.",
      memory: ["I remember when {memory}.", "Since {memory}, you've been looking after yourself."],
    },
  },
  {
    id: "efua",
    name: "Efua Quaye",
    role: "Senior engineer, Kente Labs",
    district: "spintex",
    personality: "Brilliant, intense and secretly goofy. Loves Afrobeats and bad puns.",
    goal: "Build an app that lets market women save and borrow from their phones.",
    likes: { chat: 2, advice: 2, compliment: 1 },
    gift: { item: "a mechanical keyboard", cost: 350 },
    romanceable: true,
    favour: { threshold: 45, ask: "Could you refer me for a dev role?", reward: "The software developer job needs 20 less work skill.", unlock: "efua_referral" },
    schedule: [
      { days: "weekday", from: 9, to: 18, place: "kente_labs" },
      { days: "weekday", from: 18, to: 20, place: "spintex_plaza" },
      { days: "weekend", from: 20, to: 24, place: "afro_lounge" },
      { days: "weekend", from: 11, to: 14, place: "lagoon_cafe" },
    ],
    look: { skin: "#5A3622", shirt: "#1F7A4D", pants: "#2E2E3A", hair: "#0F0F0F", feminine: true, height: 1.64, build: 0.94 },
    lines: {
      greet: {
        stranger: ["Hi! Sorry, I'm debugging in my head. What's up?", "Hey. Are you here for the hackathon?"],
        acquaintance: ["Oh hey! Did you finish that tutorial?", "Hi you. I have a new pun. Brace yourself."],
        friend: ["My favourite human! Come, look at this feature.", "Hey! I was hoping you'd come by."],
        close: ["There you are. I've been grinning at my screen all day, it's your fault.", "You make Spintex traffic worth it."],
      },
      chat: [
        "Why did the developer go broke? Because he used up all his cache. … I'll see myself out.",
        "Market women do more finance in a day than most banks do in a week.",
        "Rhythm House on Saturdays. You haven't lived until you've seen me dance badly.",
        "Our app crashed during the demo. In front of investors. I want to live in a canoe.",
        "Spintex traffic is where I do my best thinking. And my worst singing.",
      ],
      advice: [
        "Skills compound like interest. One class a week changes your life in a year.",
        "Work skill opens doors here. The courses at the Evening Institute are worth it.",
      ],
      complimentLiked: ["Stop. No, continue. Okay stop.", "You're sweet. Suspiciously sweet."],
      complimentDisliked: ["Hm. Okay."],
      gift: ["A mechanical keyboard?! Do you know what you've done? I love it."],
      yes: ["Yes! Rhythm House, tomorrow at 9pm. I'll show you my terrible dancing.", "Okay, yes! Tomorrow, Rhythm House, 9pm."],
      no: ["I'm in the middle of a release. Ask me again after launch?", "Not yet — but don't stop trying."],
      favourYes: "Already sent your name to HR. Don't embarrass me!",
      favourNo: "I'd need to see your work first.",
      coldRep: "I've heard some stuff about you. I'd rather keep my distance.",
      late: "Ugh, deploy night. Talk tomorrow?",
      tired: "You look like a server at 100% CPU. Go rest.",
      memory: ["I keep smiling about when {memory}.", "Since {memory}, I've been telling everyone about you."],
    },
  },
  {
    id: "ebo",
    name: "Uncle Ebo Quansah",
    role: "Barber & football oracle, Kaneshie",
    district: "kaneshie",
    personality: "Talkative, superstitious and generous. Knows every score since 1978.",
    goal: "Open a second barbershop with a big screen for football nights.",
    likes: { chat: 3, advice: 1, compliment: 1 },
    gift: { item: "a Labadi Waves jersey", cost: 150 },
    romanceable: false,
    favour: { threshold: 30, ask: "Any football tips, Uncle?", reward: "Ebo's tips appear on the football screen.", unlock: "ebo_tips" },
    schedule: [
      { days: "all", from: 8, to: 21, place: "blessed_hands" },
      { days: "sunday", from: 7, to: 10, place: "kaneshie_church" },
    ],
    look: { skin: "#4A2C1A", shirt: "#C8452C", pants: "#2F2F2F", hair: "#6E6E6E", feminine: false, height: 1.74, build: 1.15 },
    lines: {
      greet: {
        stranger: ["Sit, sit! Low cut or skin cut?", "New head! Welcome to Blessed Hands."],
        acquaintance: ["Ah, my customer! Your hair has grown, small.", "Did you see the match? Disgraceful!"],
        friend: ["My nephew-niece! Sit, I'll cut you free… next time.", "The prophet of Kaneshie greets you!"],
        close: ["Family! When I open the second shop, you'll cut the ribbon.", "Ei, my favourite person. Have you eaten?"],
      },
      chat: [
        "Labadi Waves will win the league. I have seen it in a dream. Twice.",
        "In 1978 I watched the Black Stars win the Nations Cup with my own eyes.",
        "A barbershop is a parliament. Everything is discussed here.",
        "Only bet what you can lose, eh. Football has broken bigger men than you.",
      ],
      advice: ["Never chase your losses. The match doesn't know you need money.", "A fresh haircut opens doors. People judge, my friend."],
      complimentLiked: ["Hahaha! You have sense!"],
      complimentDisliked: ["Flattery won't get you a free cut."],
      gift: ["A Waves jersey! Ei! I'll wear it on match day!"],
      yes: [],
      no: ["Hahaha! Eh, I'm a married man!"],
      favourYes: "Come close. I'll whisper my tips. But don't blame me if the ball is round!",
      favourNo: "Tips are for family. Come more often.",
      coldRep: "People are talking. I'll cut your hair, but that's all.",
      late: "Shop is closed. Come tomorrow.",
      tired: "You'll fall asleep in my chair. Go and rest.",
      memory: ["I remember when {memory}! Hahaha.", "Since {memory}, I knew you were serious."],
    },
  },
  ...REGIONAL_NPCS,
  ...TOWNSFOLK,
];

export const NPC_BY_ID: Record<string, Npc> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

export function tierFor(affinity: number): Tier {
  if (affinity >= 70) return "close";
  if (affinity >= 40) return "friend";
  if (affinity >= 15) return "acquaintance";
  return "stranger";
}

function blockMatches(b: ScheduleBlock, weekday: number, hour: number): boolean {
  const dayOk =
    b.days === "all" ||
    (b.days === "weekday" && weekday >= 1 && weekday <= 5) ||
    (b.days === "weekend" && (weekday === 0 || weekday === 6)) ||
    (b.days === "sunday" && weekday === 0);
  return dayOk && hour >= b.from && hour < b.to;
}

/** Where is this person right now? Specific days (sunday) win over general ones. */
export function npcLocation(npc: Npc, weekday: number, hour: number): string | null {
  const ranked = [...npc.schedule].sort((a, b) => (a.days === "sunday" ? -1 : 0) - (b.days === "sunday" ? -1 : 0));
  for (const b of ranked) if (blockMatches(b, weekday, hour)) return b.place;
  return null;
}

export function lineFor(lines: string[], seed: string, fallback = "…"): string {
  return lines.length ? pick(lines, seed) : fallback;
}

/** Background crowd names for ambient people. */
export const CROWD_NAMES = ["Kofi", "Ama", "Kwame", "Akua", "Yaw", "Abena", "Kojo", "Adwoa", "Nana", "Esi", "Kwesi", "Afua", "Fiifi", "Araba", "Selorm", "Dzifa", "Naa", "Nii", "Mawuli", "Delali"];
export const CROWD_SHOUTS = [
  "Circle! Circle!", "Pure water! Pure water!", "Kelewele dey!", "Chale, how far?", "Ei, this sun!",
  "Madam, buy from me!", "Accra!", "Herh!", "Fine boy, fine girl!", "Ice cream! Cold ice cream!", "Abeg, small change?",
  "God bless you!", "Ɛte sɛn?", "Taxi! Taxi!", "Last stop!", "Agoo!",
];
