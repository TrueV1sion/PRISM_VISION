/**
 * MCP Server Configuration
 *
 * Defines the MCP server registry, connection parameters, and
 * archetype-to-server routing for the PRISM pipeline.
 *
 * NOTE: Many healthcare-specific MCP servers (PubMed, CMS Coverage, ICD-10,
 * NPI Registry, Clinical Trials, bioRxiv) are provided as remote MCP
 * integrations by Anthropic/Claude.ai and do NOT have standalone npm packages
 * with stdio transports. The MCPManager handles missing/unavailable servers
 * gracefully — agents note unavailable tools in their `gaps` field.
 */

import type { ArchetypeFamily } from "@/lib/pipeline/types";

// ─── Server Config ──────────────────────────────────────────

export interface MCPServerConfig {
  /** Human-readable description of what this server provides */
  description: string;
  /**
   * Whether this server is enabled.
   * If true, MCPManager will attempt connection at init.
   * Connection failures degrade gracefully (server marked unavailable at runtime).
   */
  available: boolean;
  /** Transport type: "sse" for remote HTTP servers, "stdio" for local processes */
  transport: "sse" | "stdio";
  // ── SSE transport fields ──
  /** Env var key holding the server URL (resolved at runtime) */
  envUrlKey?: string;
  // ── Stdio transport fields ──
  /** Command to spawn the server process */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the spawned process */
  env?: Record<string, string>;
}

export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  pubmed: {
    description: "PubMed article search and retrieval",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_PUBMED_URL",
  },
  cms_coverage: {
    description: "CMS national and local coverage determinations",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_CMS_COVERAGE_URL",
  },
  icd10: {
    description: "ICD-10 code lookup, search, and validation",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_ICD10_URL",
  },
  npi_registry: {
    description: "NPI provider registry search and validation",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_NPI_REGISTRY_URL",
  },
  clinical_trials: {
    description: "ClinicalTrials.gov search and analysis",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_CLINICAL_TRIALS_URL",
  },
  biorxiv: {
    description: "bioRxiv/medRxiv preprint search and retrieval",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_BIORXIV_URL",
  },
};

// ─── Archetype → Server Routing ─────────────────────────────

/**
 * Maps archetype families to the MCP server names they should have access to.
 * Archetypes not listed here get no MCP tools (only Anthropic native tools
 * like web_search if applicable).
 */
export const ARCHETYPE_TOOL_ROUTING: Partial<
  Record<ArchetypeFamily, string[]>
> = {
  "RESEARCHER-WEB": [], // Uses web_search native tool instead of MCP
  "RESEARCHER-DATA": ["pubmed", "clinical_trials", "biorxiv"],
  "RESEARCHER-DOMAIN": [
    "pubmed",
    "cms_coverage",
    "icd10",
    "npi_registry",
    "clinical_trials",
  ],
  "RESEARCHER-LATERAL": ["pubmed", "biorxiv"],
  "ANALYST-FINANCIAL": [],
  "ANALYST-STRATEGIC": [],
  "ANALYST-TECHNICAL": ["pubmed", "clinical_trials"],
  "ANALYST-RISK": ["cms_coverage", "clinical_trials"],
  "ANALYST-QUALITY": ["cms_coverage", "icd10"],
  "CRITIC-FACTUAL": [], // Uses web_search native tool for fact-checking
  "CRITIC-LOGICAL": [],
  "CRITIC-STRATEGIC": [],
  "CRITIC-EDITORIAL": [],
  "CREATOR-WRITER": [],
  "CREATOR-PRESENTER": [],
  "CREATOR-TECHNICAL": [],
  "CREATOR-PERSUADER": [],
  SYNTHESIZER: [],
  ARBITER: [],
  "DEVILS-ADVOCATE": [],
  FUTURIST: ["clinical_trials", "biorxiv"],
  HISTORIAN: ["pubmed"],
  "RED-TEAM": [],
  "CUSTOMER-PROXY": ["npi_registry"],
  "LEGISLATIVE-PIPELINE": ["cms_coverage"],
  "REGULATORY-RADAR": ["cms_coverage", "icd10"],
  "MACRO-CONTEXT": ["biorxiv"],
};

/**
 * Archetypes that should receive Anthropic's native web_search server tool.
 * This is separate from MCP tools — web_search is a first-party Anthropic
 * tool passed directly in the `tools` array of messages.create().
 */
export const WEB_SEARCH_ARCHETYPES: Set<ArchetypeFamily> = new Set([
  "RESEARCHER-WEB",
  "CRITIC-FACTUAL",
  "ANALYST-STRATEGIC",
  "MACRO-CONTEXT",
  "LEGISLATIVE-PIPELINE",
  "REGULATORY-RADAR",
  "RED-TEAM",
]);
