// Courts and civic justice: game mechanics, not legal advice.
//
// Disputes come out of things that happen in the game (a landlord keeping a
// deposit, unpaid rent, someone claiming your land). You can file a claim,
// choose a lawyer or legal aid, attend hearings and appeal. Everything here
// (fees, lawyers, outcomes, procedures) is fictional and simplified; the
// court names are game venues. Have a Ghanaian lawyer review the framing
// before treating any of it as representative.

export const JUSTICE_REVIEWED = "2026-10-13";
export const JUSTICE_DISCLAIMER = "Game rules only. Not legal advice; real procedures, fees and outcomes differ.";

export type DisputeKind = "deposit" | "arrears" | "land" | "wages";
export interface CaseType {
  kind: DisputeKind;
  name: string;
  /** Plain description of what the claim is about. */
  about: string;
  /** Game venue (fictional court for the town). */
  venue: "district" | "circuit";
  /** Game fees in GH₵. */
  filingFee: number;
  serviceFee: number;
  /** Days from filing (or service) to the first hearing. */
  daysToHearing: number;
  /** What can happen. */
  outcomes: string[];
}
export const CASE_TYPES: Record<DisputeKind, CaseType> = {
  deposit: { kind: "deposit", name: "Rent deposit not returned", about: "A landlord kept advance rent you'd paid for months you never stayed.", venue: "district", filingFee: 60, serviceFee: 25, daysToHearing: 4, outcomes: ["Landlord ordered to repay the amount, plus your filing costs", "Partial repayment if the evidence is mixed", "Claim dismissed: you bear your own costs"] },
  wages: { kind: "wages", name: "Unpaid wages", about: "An employer owes you pay for shifts you worked.", venue: "district", filingFee: 50, serviceFee: 25, daysToHearing: 4, outcomes: ["Employer ordered to pay what's owed, plus costs", "Partial payment", "Claim dismissed"] },
  arrears: { kind: "arrears", name: "Rent arrears claim (against you)", about: "Your landlord says you owe back rent.", venue: "district", filingFee: 0, serviceFee: 0, daysToHearing: 5, outcomes: ["You pay the arrears found due, in instalments if you ask", "Claim reduced if you show payments", "Claim dismissed if the rent was paid"] },
  land: { kind: "land", name: "Dispute over your land", about: "Someone says your plot was theirs to sell. You ask the court to confirm your title.", venue: "circuit", filingFee: 400, serviceFee: 60, daysToHearing: 6, outcomes: ["Your title confirmed; the other side pays costs", "Title confirmed, each side bears its costs", "The other side's claim upheld: compensation instead of the land"] },
};

/** Game venues for each town (fictional names; local review wanted). */
export const COURTS: Record<string, { district: string; placeId: string; name: string; judge: string; registrar: string }> = {
  accra: { district: "jamestown", placeId: "accra_court", name: "Accra District & Circuit Courts (game venue)", judge: "His Honour J. K. Mensah (fictional)", registrar: "Registrar Akua Boateng (fictional)" },
  kumasi: { district: "adum", placeId: "kumasi_court", name: "Kumasi District Court (game venue)", judge: "Her Honour A. Owusu (fictional)", registrar: "Registrar Kofi Asante (fictional)" },
};
export const courtFor = (city: string) => COURTS[city] ?? COURTS.accra;
/** Hearings start at 9:00 and the court sits until 13:00 (game rule). */
export const HEARING_HOUR = 9, COURT_CLOSES = 13;

export interface Lawyer {
  id: string;
  name: string;
  /** Fictional role and experience (not a real qualification). */
  role: string;
  years: number;
  /** Game fee in GH₵ for the whole case at first instance. */
  fee: number;
  /** How much they strengthen a well-evidenced case (game value 0..1). */
  skill: number;
  /** Days a week they take new work (availability). */
  availability: string;
  /** Cases they've handled in the game: kept neutral, not a ranking. */
  record: string;
  focus: DisputeKind[];
  legalAid?: boolean;
}
export const LAWYERS: Lawyer[] = [
  { id: "legal_aid", name: "Legal aid duty lawyer", role: "Legal aid scheme (game)", years: 6, fee: 0, skill: 0.5, availability: "Mon–Fri, by appointment", record: "Handles many tenancy and wage claims", focus: ["deposit", "wages", "arrears"], legalAid: true },
  { id: "adjoa_asare", name: "Adjoa Asare", role: "Tenancy and small claims practitioner (fictional)", years: 4, fee: 450, skill: 0.6, availability: "Most weekdays", record: "Mostly tenancy matters", focus: ["deposit", "arrears", "wages"] },
  { id: "kwesi_ofori", name: "Kwesi Ofori", role: "Employment and civil litigation (fictional)", years: 11, fee: 1_200, skill: 0.72, availability: "Two days a week", record: "Employment and contract disputes", focus: ["wages", "deposit"] },
  { id: "esi_ankrah", name: "Esi Ankrah", role: "Land and property practitioner (fictional)", years: 17, fee: 6_500, skill: 0.8, availability: "Booked a week ahead", record: "Land title and boundary matters", focus: ["land"] },
  { id: "self", name: "Represent yourself", role: "No lawyer", years: 0, fee: 0, skill: 0.3, availability: "Always", record: "—", focus: ["deposit", "wages", "arrears", "land"] },
];
export const LAWYER_BY_ID = Object.fromEntries(LAWYERS.map((l) => [l.id, l]));
/** Legal aid is for people of modest means: monthly income under this (game rule, GH₵). */
export const LEGAL_AID_INCOME_LIMIT = 4_000;

/** Appeals go to a higher (game) court within this many days, for this fee. */
export const APPEAL_DAYS = 7, APPEAL_FEE = 300;
/** You may ask for one adjournment, at least a day before. */
export const ADJOURN_DAYS = 3;

/** Civic activities at the court (low cost, opt-in). */
export const CIVIC = {
  observe: { minutes: 120, label: "Sit in the public gallery", blurb: "Watch a public hearing (other cases, all fictional characters). You learn how things work." },
  volunteer: { minutes: 180, label: "Volunteer at the legal aid desk", blurb: "Help people fill forms and find their hearing. No legal advice: you point them to the duty lawyer." },
};
