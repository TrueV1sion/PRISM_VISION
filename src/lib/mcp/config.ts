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
  /** The command to spawn the server process */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables for the spawned process */
  env?: Record<string, string>;
  /** Human-readable description of what this server provides */
  description: string;
  /**
   * Whether this server is currently available.
   * Set to false for servers that require external packages not yet installed.
   */
  available: boolean;
}

/**
 * Registry of MCP servers.
 *
 * Servers marked `available: false` are known to the system but cannot yet be
 * connected — they are remote-only MCP integrations or require separate
 * installation. The MCPManager skips unavailable servers at init time and
 * reports them as gaps.
 */
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  // ── Healthcare / Regulatory ──────────────────────────────
  pubmed: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-pubmed"],
    description: "PubMed article search and retrieval",
    available: false, // Remote-only Anthropic MCP integration
  },
  cms_coverage: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-cms-coverage"],
    description: "CMS national and local coverage determinations",
    available: false, // Remote-only Anthropic MCP integration
  },
  icd10: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-icd10"],
    description: "ICD-10 code lookup, search, and validation",
    available: false, // Remote-only Anthropic MCP integration
  },
  npi_registry: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-npi"],
    description: "NPI provider registry search and validation",
    available: false, // Remote-only Anthropic MCP integration
  },
  clinical_trials: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-clinical-trials"],
    description: "ClinicalTrials.gov search and analysis",
    available: false, // Remote-only Anthropic MCP integration
  },
  biorxiv: {
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-biorxiv"],
    description: "bioRxiv/medRxiv preprint search and retrieval",
    available: false, // Remote-only Anthropic MCP integration
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
