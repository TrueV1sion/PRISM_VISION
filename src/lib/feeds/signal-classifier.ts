/**
 * Signal Classifier
 *
 * Classifies feed items into one or more of 15 signal types based on
 * keyword scoring of the title, summary, and extracted entities.
 *
 * Each signal type has a set of weighted keyword patterns. The classifier
 * scores each type and returns all types exceeding the threshold, sorted
 * by descending score.
 */

import type { ExtractedEntities } from "./entity-extractor";

export type SignalType =
  | "drug_approval"
  | "regulatory_change"
  | "ma_activity"
  | "funding_round"
  | "leadership_change"
  | "clinical_trial"
  | "safety_alert"
  | "coverage_decision"
  | "legislative_action"
  | "enforcement_action"
  | "pricing_change"
  | "partnership"
  | "market_entry"
  | "facility_change"
  | "patent_event";

interface SignalRule {
  type: SignalType;
  /** Keywords that contribute to signal score (case-insensitive) */
  keywords: string[];
  /** High-weight keywords that double the score contribution */
  strongKeywords: string[];
  /** Minimum score to classify as this signal type */
  threshold: number;
  /** Bonus score if certain entity types are present */
  entityBonus?: {
    type: keyof ExtractedEntities;
    bonus: number;
  };
}

const SIGNAL_RULES: SignalRule[] = [
  {
    type: "drug_approval",
    keywords: ["approv", "clearance", "authorization", "nda", "bla", "anda", "510(k)", "pma", "granted", "green light"],
    strongKeywords: ["fda approv", "drug approv", "eua", "breakthrough therapy", "accelerated approval", "priority review"],
    threshold: 2,
    entityBonus: { type: "drugs", bonus: 2 },
  },
  {
    type: "regulatory_change",
    keywords: ["regulation", "rule", "guidance", "proposed rule", "final rule", "comment period", "docket", "rulemaking", "mandate"],
    strongKeywords: ["regulatory change", "new regulation", "policy change", "cms final rule", "proposed regulation"],
    threshold: 2,
    entityBonus: { type: "agencies", bonus: 1 },
  },
  {
    type: "ma_activity",
    keywords: ["merger", "acquisition", "acquire", "deal", "buyout", "takeover", "divest", "spin-off", "consolidat"],
    strongKeywords: ["merger agreement", "acquisition of", "agreed to acquire", "completed acquisition", "hostile bid"],
    threshold: 2,
    entityBonus: { type: "amounts", bonus: 2 },
  },
  {
    type: "funding_round",
    keywords: ["funding", "raised", "series", "venture", "investment", "financing", "ipo", "capital"],
    strongKeywords: ["series a", "series b", "series c", "series d", "seed round", "ipo filing", "raised $", "funding round"],
    threshold: 2,
    entityBonus: { type: "amounts", bonus: 2 },
  },
  {
    type: "leadership_change",
    keywords: ["ceo", "cfo", "cmo", "cto", "chief", "appoint", "resign", "retire", "executive", "board"],
    strongKeywords: ["new ceo", "steps down", "appointed as", "named ceo", "leadership change", "board of directors"],
    threshold: 2,
  },
  {
    type: "clinical_trial",
    keywords: ["trial", "phase", "study", "endpoint", "efficacy", "placebo", "randomized", "enroll", "cohort"],
    strongKeywords: ["phase 3", "phase iii", "phase 2", "phase ii", "pivotal trial", "primary endpoint", "topline results", "met primary"],
    threshold: 2,
    entityBonus: { type: "drugs", bonus: 2 },
  },
  {
    type: "safety_alert",
    keywords: ["recall", "warning", "adverse", "safety", "alert", "side effect", "black box", "rems", "contraindic"],
    strongKeywords: ["safety alert", "drug recall", "class i recall", "boxed warning", "fda warning", "adverse event", "safety signal"],
    threshold: 2,
  },
  {
    type: "coverage_decision",
    keywords: ["coverage", "reimbursement", "ncd", "lcd", "medicare", "medicaid", "formulary", "tier", "prior auth"],
    strongKeywords: ["coverage decision", "national coverage", "local coverage", "medicare coverage", "formulary change", "prior authorization"],
    threshold: 2,
    entityBonus: { type: "agencies", bonus: 1 },
  },
  {
    type: "legislative_action",
    keywords: ["bill", "legislation", "congress", "senate", "house", "committee", "vote", "bipartisan", "hearing"],
    strongKeywords: ["passed the", "introduced bill", "committee hearing", "floor vote", "signed into law", "health committee"],
    threshold: 2,
    entityBonus: { type: "regulations", bonus: 3 },
  },
  {
    type: "enforcement_action",
    keywords: ["fine", "penalty", "settlement", "violation", "fraud", "compliance", "whistleblower", "qui tam", "doj"],
    strongKeywords: ["enforcement action", "false claims", "anti-kickback", "consent decree", "corporate integrity", "doj settlement"],
    threshold: 2,
    entityBonus: { type: "amounts", bonus: 2 },
  },
  {
    type: "pricing_change",
    keywords: ["price", "pricing", "cost", "rebate", "discount", "ira", "negotiat", "cap", "out-of-pocket"],
    strongKeywords: ["drug pricing", "price increase", "price cut", "negotiated price", "rebate rule", "inflation reduction"],
    threshold: 2,
  },
  {
    type: "partnership",
    keywords: ["partner", "collaborat", "alliance", "license", "agreement", "joint venture", "co-develop"],
    strongKeywords: ["strategic partnership", "licensing agreement", "collaboration agreement", "co-development", "exclusive license"],
    threshold: 2,
    entityBonus: { type: "companies", bonus: 1 },
  },
  {
    type: "market_entry",
    keywords: ["launch", "enter", "expand", "market", "commercializ", "generic", "biosimilar"],
    strongKeywords: ["market entry", "product launch", "commercial launch", "biosimilar launch", "generic entry", "first-to-market"],
    threshold: 2,
    entityBonus: { type: "drugs", bonus: 1 },
  },
  {
    type: "facility_change",
    keywords: ["facility", "plant", "manufactur", "site", "close", "open", "construct", "relocat", "capacity"],
    strongKeywords: ["facility closure", "new facility", "manufacturing plant", "site closure", "capacity expansion", "production halt"],
    threshold: 2,
  },
  {
    type: "patent_event",
    keywords: ["patent", "ip", "intellectual property", "exclusivity", "generic", "paragraph iv", "hatch-waxman"],
    strongKeywords: ["patent expir", "patent cliff", "patent challeng", "paragraph iv", "patent litigation", "orange book"],
    threshold: 2,
    entityBonus: { type: "drugs", bonus: 1 },
  },
];

/** Minimum score threshold for any signal to be included */
const GLOBAL_THRESHOLD = 2;

/**
 * Classify a feed item into zero or more signal types.
 *
 * @param title - Feed item title
 * @param summary - Feed item summary / description
 * @param entities - Extracted entities from the text
 * @returns Array of matching signal types, sorted by descending score
 */
export function classifySignals(
  title: string,
  summary: string,
  entities: ExtractedEntities,
): SignalType[] {
  const text = `${title} ${summary}`.toLowerCase();
  const scored: Array<{ type: SignalType; score: number }> = [];

  for (const rule of SIGNAL_RULES) {
    let score = 0;

    // Score regular keywords (1 point each)
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += 1;
      }
    }

    // Score strong keywords (2 points each)
    for (const kw of rule.strongKeywords) {
      if (text.includes(kw.toLowerCase())) {
        score += 2;
      }
    }

    // Entity bonus — add bonus if relevant entities exist
    if (rule.entityBonus) {
      const entityList = entities[rule.entityBonus.type];
      if (entityList.length > 0) {
        score += rule.entityBonus.bonus;
      }
    }

    // Title mentions get a boost — title keywords are more significant
    const titleLower = title.toLowerCase();
    for (const kw of rule.strongKeywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        score += 1; // Extra point for title presence
      }
    }

    const threshold = Math.max(rule.threshold, GLOBAL_THRESHOLD);
    if (score >= threshold) {
      scored.push({ type: rule.type, score });
    }
  }

  // Sort by descending score, return types only
  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.type);
}
