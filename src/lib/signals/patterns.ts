// src/lib/signals/patterns.ts
/**
 * Predefined Correlation Patterns
 *
 * Each pattern defines a cross-source temporal signal that the
 * SignalCorrelator engine evaluates against recent FeedItems,
 * DatasetDeltas, and ToolCallLogs.
 */

export interface CorrelationPattern {
  id: string;
  name: string;
  description: string;
  signalType: string; // maps to Signal.signalType
  severity: "low" | "medium" | "high" | "critical";
  /** Time window in hours to look for co-occurring signals */
  windowHours: number;
  /** Minimum number of sources that must match */
  minSources: number;
  /** Source types that contribute to this pattern */
  sourceTypes: ("feed" | "dataset_delta" | "tool_call")[];
  /** Keywords/entity patterns to match in source data */
  keywords: string[];
  /** Base confidence before Bayesian adjustment */
  baseConfidence: number;
}

export const CORRELATION_PATTERNS: CorrelationPattern[] = [
  {
    id: "ma_indicator",
    name: "M&A Indicator",
    description:
      "HSR filing + NPPES deactivation/change + executive news detected within 30 days. " +
      "Suggests potential merger or acquisition activity.",
    signalType: "ma_indicator",
    severity: "high",
    windowHours: 30 * 24,
    minSources: 2,
    sourceTypes: ["feed", "dataset_delta", "tool_call"],
    keywords: [
      "merger", "acquisition", "hsr", "hart-scott-rodino",
      "divestiture", "buyout", "takeover", "consolidation",
      "definitive agreement", "letter of intent",
    ],
    baseConfidence: 0.7,
  },
  {
    id: "regulatory_shift",
    name: "Regulatory Shift",
    description:
      "New CMS rule + industry reaction in feeds within 7 days. " +
      "Indicates emerging regulatory change that may affect operations.",
    signalType: "regulatory_shift",
    severity: "medium",
    windowHours: 7 * 24,
    minSources: 2,
    sourceTypes: ["feed", "dataset_delta"],
    keywords: [
      "cms rule", "final rule", "proposed rule", "regulation",
      "compliance", "mandate", "cms guidance", "coverage determination",
      "ncd", "lcd", "enforcement",
    ],
    baseConfidence: 0.8,
  },
  {
    id: "market_entry",
    name: "Market Entry",
    description:
      "510(k) clearance + funding news + patent filing within 60 days. " +
      "Signals new competitor or product entering the market.",
    signalType: "market_entry",
    severity: "medium",
    windowHours: 60 * 24,
    minSources: 2,
    sourceTypes: ["feed", "tool_call"],
    keywords: [
      "510(k)", "clearance", "approval", "patent",
      "funding", "series a", "series b", "ipo",
      "launch", "market entry", "commercialization",
    ],
    baseConfidence: 0.6,
  },
  {
    id: "provider_consolidation",
    name: "Provider Consolidation",
    description:
      "CHOW dataset delta + news mention + SEC filing within 30 days. " +
      "Indicates healthcare provider ownership change or consolidation.",
    signalType: "provider_consolidation",
    severity: "high",
    windowHours: 30 * 24,
    minSources: 2,
    sourceTypes: ["feed", "dataset_delta", "tool_call"],
    keywords: [
      "chow", "change of ownership", "provider consolidation",
      "hospital acquisition", "health system merger", "physician group",
      "practice acquisition", "facility closure",
    ],
    baseConfidence: 0.75,
  },
  {
    id: "quality_disruption",
    name: "Quality Disruption",
    description:
      "Star rating change + CMS penalty + news coverage within 14 days. " +
      "Signals quality-related disruption at a healthcare facility.",
    signalType: "quality_disruption",
    severity: "high",
    windowHours: 14 * 24,
    minSources: 2,
    sourceTypes: ["feed", "dataset_delta"],
    keywords: [
      "star rating", "quality rating", "cms penalty",
      "deficiency", "survey", "jcaho", "accreditation",
      "patient safety", "sentinel event", "never event",
    ],
    baseConfidence: 0.8,
  },
  {
    id: "drug_safety_escalation",
    name: "Drug Safety Escalation",
    description:
      "FAERS spike + label change + news coverage within 14 days. " +
      "Indicates escalating drug safety concern requiring attention.",
    signalType: "drug_safety_escalation",
    severity: "critical",
    windowHours: 14 * 24,
    minSources: 2,
    sourceTypes: ["feed", "tool_call"],
    keywords: [
      "faers", "adverse event", "safety signal", "label change",
      "boxed warning", "rems", "drug recall", "class i recall",
      "safety communication", "dear healthcare provider",
    ],
    baseConfidence: 0.85,
  },
  {
    id: "legislative_momentum",
    name: "Legislative Momentum",
    description:
      "Bill advancement + lobbying surge + news coverage within 30 days. " +
      "Suggests healthcare legislation gaining political momentum.",
    signalType: "legislative_momentum",
    severity: "medium",
    windowHours: 30 * 24,
    minSources: 2,
    sourceTypes: ["feed", "tool_call"],
    keywords: [
      "bill", "legislation", "committee", "markup",
      "floor vote", "lobbying", "advocacy", "bipartisan",
      "cbo score", "reconciliation", "appropriations",
    ],
    baseConfidence: 0.65,
  },
  {
    id: "workforce_disruption",
    name: "Workforce Disruption",
    description:
      "Hiring freeze news + layoff report + stock movement within 14 days. " +
      "Signals workforce disruption at a healthcare organization.",
    signalType: "workforce_disruption",
    severity: "medium",
    windowHours: 14 * 24,
    minSources: 2,
    sourceTypes: ["feed", "tool_call"],
    keywords: [
      "layoff", "restructuring", "hiring freeze", "workforce reduction",
      "rif", "furlough", "downsizing", "headcount",
      "staffing shortage", "labor dispute",
    ],
    baseConfidence: 0.6,
  },
  {
    id: "payer_strategy_shift",
    name: "Payer Strategy Shift",
    description:
      "Enrollment change + plan modification + rate notice within 30 days. " +
      "Indicates strategic shift by a health plan or payer.",
    signalType: "payer_strategy_shift",
    severity: "high",
    windowHours: 30 * 24,
    minSources: 2,
    sourceTypes: ["feed", "dataset_delta"],
    keywords: [
      "enrollment", "plan modification", "rate increase",
      "premium", "network change", "narrow network",
      "star rating", "bid", "cms advantage", "exchange",
    ],
    baseConfidence: 0.7,
  },
  {
    id: "innovation_cluster",
    name: "Innovation Cluster",
    description:
      "SBIR award + patent filing + funding news within 90 days. " +
      "Signals emerging innovation cluster in a therapeutic or technology area.",
    signalType: "innovation_cluster",
    severity: "low",
    windowHours: 90 * 24,
    minSources: 2,
    sourceTypes: ["feed", "tool_call"],
    keywords: [
      "sbir", "sttr", "patent", "grant", "innovation",
      "breakthrough", "novel", "first-in-class",
      "phase i", "seed funding", "incubator",
    ],
    baseConfidence: 0.55,
  },
];
