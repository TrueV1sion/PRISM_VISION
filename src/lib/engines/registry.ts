import type { EngineManifest } from "./types";
import { commandCenterManifest } from "./command-center";

const ALL_ENGINES: EngineManifest[] = ([
  commandCenterManifest,
  {
    id: "ma",
    name: "M&A Engine",
    shortName: "M&A",
    description: "Mergers & acquisitions intelligence — deal flow, valuation, due diligence",
    icon: "TrendingUp",
    accentColor: "#8b5cf6",
    accentColorName: "violet",
    status: "active" as const,
    order: 1,
    route: "/engines/ma",
    isDefault: false,
    archetypes: ["MA-SIGNAL-HUNTER", "MA-INTEGRATOR", "DILIGENCE-AUDITOR", "ANALYST-FINANCIAL", "NETWORK-ANALYST"],
    defaultQuery: "What healthcare M&A activity has occurred in the last 90 days? Identify pre-deal signals and post-deal integration patterns.",
    dataSourceTags: ["ma", "deal-flow", "ownership", "financial", "corporate"],
  },
  {
    id: "finance",
    name: "Finance Engine",
    shortName: "Finance",
    description: "Financial analysis — modeling, forecasting, market intelligence",
    icon: "DollarSign",
    accentColor: "#10b981",
    accentColorName: "emerald",
    status: "active" as const,
    order: 2,
    route: "/engines/finance",
    isDefault: false,
    archetypes: ["ANALYST-FINANCIAL", "VALUE-CHAIN-ANALYST", "PRICING-STRATEGIST", "BENCHMARKER", "MARKET-SIZER"],
    defaultQuery: "Analyze the financial health and competitive positioning of the top 5 managed care organizations by enrollment.",
    dataSourceTags: ["financial", "corporate", "market", "economic", "valuation"],
  },
  {
    id: "regulatory",
    name: "Regulatory Engine",
    shortName: "Reg",
    description: "Regulatory & legislative tracking — compliance, policy analysis",
    icon: "Shield",
    accentColor: "#f59e0b",
    accentColorName: "amber",
    status: "active" as const,
    order: 3,
    route: "/engines/regulatory",
    isDefault: false,
    archetypes: ["REGULATORY-RADAR", "LEGISLATIVE-PIPELINE", "INFLUENCE-MAPPER", "MACRO-CONTEXT", "SCENARIO-MODELER"],
    defaultQuery: "What regulatory changes from CMS and HHS in the past 60 days will impact Medicare Advantage plans?",
    dataSourceTags: ["regulatory", "legislative", "policy", "compliance", "government"],
  },
  {
    id: "sales",
    name: "Sales Performance",
    shortName: "Sales",
    description: "Sales intelligence — pipeline, territory, competitive positioning",
    icon: "BarChart3",
    accentColor: "#ec4899",
    accentColorName: "pink",
    status: "active" as const,
    order: 4,
    route: "/engines/sales",
    isDefault: false,
    archetypes: ["CREATOR-PERSUADER", "ANALYST-STRATEGIC", "TALENT-TRACKER", "ECOSYSTEM-MAPPER", "CUSTOMER-PROXY"],
    defaultQuery: "Build a competitive battlecard for selling healthcare analytics to large payer organizations.",
    dataSourceTags: ["competitive", "product", "hiring", "market", "provider"],
  },
  {
    id: "product",
    name: "Product Engine",
    shortName: "Product",
    description: "Product intelligence — market fit, feature analysis, competitive landscape",
    icon: "Layers",
    accentColor: "#3b82f6",
    accentColorName: "blue",
    status: "active" as const,
    order: 5,
    route: "/engines/product",
    isDefault: false,
    archetypes: ["UX-BENCHMARKER", "MATURITY-ASSESSOR", "ECOSYSTEM-MAPPER", "ANALYST-TECHNICAL", "FUTURIST"],
    defaultQuery: "Map the health tech product ecosystem: who are the major platforms, what are their integration patterns, and where are the gaps?",
    dataSourceTags: ["product", "technology", "innovation", "competitive", "patent"],
  },
] satisfies EngineManifest[]).sort((a, b) => a.order - b.order);

export function getEngineRegistry(): EngineManifest[] {
  return ALL_ENGINES;
}

export function getEngineById(id: string): EngineManifest | undefined {
  return ALL_ENGINES.find((e) => e.id === id);
}

export function getDefaultEngine(): EngineManifest {
  const def = ALL_ENGINES.find((e) => e.isDefault);
  if (!def) throw new Error("No default engine registered");
  return def;
}

export function getActiveEngines(): EngineManifest[] {
  return ALL_ENGINES.filter((e) => e.status !== "hidden");
}
