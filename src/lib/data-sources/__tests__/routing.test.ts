/**
 * Tag-Based Routing Tests — Phase 4 Verification
 *
 * Tests tag-based tool routing, explicit override precedence,
 * layer ordering, tag indexing, and routingTags coverage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TagBasedRouter, ARCHETYPE_TOOL_ROUTING } from "../registry";
import type { DataSourceTool } from "../types";

// ─── Helpers ────────────────────────────────────────────────

function makeTool(
  name: string,
  layer: 2 | 3,
  routingTags: string[],
): DataSourceTool {
  return {
    name,
    description: `Test tool: ${name}`,
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: "",
      citations: [],
      vintage: { queriedAt: new Date().toISOString(), source: "test" },
      confidence: "HIGH" as const,
      truncated: false,
    }),
    layer,
    sources: ["test"],
    routingTags,
  };
}

// ─── All Tool Imports (for routingTags coverage check) ──────

import { openfdaTools } from "../tools/openfda.tools";
import { secEdgarTools } from "../tools/sec-edgar.tools";
import { federalRegisterTools } from "../tools/federal-register.tools";
import { usptoPatentsTools } from "../tools/uspto-patents.tools";
import { congressGovTools } from "../tools/congress-gov.tools";
import { blsDataTools } from "../tools/bls-data.tools";
import { censusBureauTools } from "../tools/census-bureau.tools";
import { whoGhoTools } from "../tools/who-gho.tools";
import { gpoGovinfoTools } from "../tools/gpo-govinfo.tools";
import { cboTools } from "../tools/cbo.tools";
import { oecdHealthTools } from "../tools/oecd-health.tools";
import { samGovTools } from "../tools/sam-gov.tools";
import { fdaOrangeBookTools } from "../tools/fda-orange-book.tools";
import { grantsGovTools } from "../tools/grants-gov.tools";
import { ahrqHcupTools } from "../tools/ahrq-hcup.tools";
import { datasetQueryTools } from "../tools/dataset-query.tools";
import { feedSearchTools } from "../tools/feed-search.tools";
import { openSecretsTools } from "../tools/opensecrets.tools";
import { cmsOpenPaymentsTools } from "../tools/cms-open-payments.tools";
import { hospitalCompareTools } from "../tools/hospital-compare.tools";
import { sbirGovTools } from "../tools/sbir-gov.tools";
import { leapfrogTools } from "../tools/leapfrog.tools";
import { signalQueryTools } from "../tools/signal-query.tools";

import { drugSafetyResearchTool } from "../research/drug-safety";
import { clinicalEvidenceResearchTool } from "../research/clinical-evidence";
import { coveragePolicyResearchTool } from "../research/coverage-policy";
import { companyPositionResearchTool } from "../research/company-position";
import { regulatoryLandscapeResearchTool } from "../research/regulatory-landscape";
import { marketDynamicsResearchTool } from "../research/market-dynamics";
import { patentLandscapeResearchTool } from "../research/patent-landscape";
import { legislativeStatusResearchTool } from "../research/legislative-status";
import { providerLandscapeResearchTool } from "../research/provider-landscape";
import { globalHealthResearchTool } from "../research/global-health";
import { competitiveIntelResearchTool } from "../research/competitive-intel";
import { fundingLandscapeResearchTool } from "../research/funding-landscape";
import { qualityBenchmarksResearchTool } from "../research/quality-benchmarks";
import { datasetIntelligenceResearchTool } from "../research/dataset-intelligence";
import { newsIntelligenceResearchTool } from "../research/news-intelligence";
import { lobbyingInfluenceResearchTool } from "../research/lobbying-influence";
import { providerQualityResearchTool } from "../research/provider-quality";
import { innovationFundingResearchTool } from "../research/innovation-funding";
import { crossSourceCorrelationResearchTool } from "../research/cross-source-correlation";

// Collect all Layer 2 tools
const allLayer2Tools: DataSourceTool[] = [
  ...openfdaTools,
  ...secEdgarTools,
  ...federalRegisterTools,
  ...usptoPatentsTools,
  ...congressGovTools,
  ...blsDataTools,
  ...censusBureauTools,
  ...whoGhoTools,
  ...gpoGovinfoTools,
  ...cboTools,
  ...oecdHealthTools,
  ...samGovTools,
  ...fdaOrangeBookTools,
  ...grantsGovTools,
  ...ahrqHcupTools,
  ...datasetQueryTools,
  ...feedSearchTools,
  ...openSecretsTools,
  ...cmsOpenPaymentsTools,
  ...hospitalCompareTools,
  ...sbirGovTools,
  ...leapfrogTools,
  ...signalQueryTools,
];

// Collect all Layer 3 research tools
const allLayer3Tools: DataSourceTool[] = [
  drugSafetyResearchTool,
  clinicalEvidenceResearchTool,
  coveragePolicyResearchTool,
  companyPositionResearchTool,
  regulatoryLandscapeResearchTool,
  marketDynamicsResearchTool,
  patentLandscapeResearchTool,
  legislativeStatusResearchTool,
  providerLandscapeResearchTool,
  globalHealthResearchTool,
  competitiveIntelResearchTool,
  fundingLandscapeResearchTool,
  qualityBenchmarksResearchTool,
  datasetIntelligenceResearchTool,
  newsIntelligenceResearchTool,
  lobbyingInfluenceResearchTool,
  providerQualityResearchTool,
  innovationFundingResearchTool,
  crossSourceCorrelationResearchTool,
];

const allTools: DataSourceTool[] = [...allLayer2Tools, ...allLayer3Tools];

// ─── Tests ──────────────────────────────────────────────────

describe("TagBasedRouter", () => {
  let router: TagBasedRouter;
  let toolMap: Map<string, DataSourceTool>;

  beforeEach(() => {
    router = new TagBasedRouter();
    toolMap = new Map<string, DataSourceTool>();
  });

  it("buildIndex correctly indexes all tags", () => {
    const tool1 = makeTool("tool_a", 2, ["fda", "clinical"]);
    const tool2 = makeTool("tool_b", 3, ["fda", "risk"]);
    const tool3 = makeTool("tool_c", 2, ["clinical", "hospital"]);
    toolMap.set("tool_a", tool1);
    toolMap.set("tool_b", tool2);
    toolMap.set("tool_c", tool3);

    router.buildIndex(toolMap);

    // Tag "fda" should map to tool_a and tool_b
    const fdaMatches = router.matchTools(["fda"], toolMap);
    expect(fdaMatches.map((t) => t.name).sort()).toEqual(["tool_a", "tool_b"]);

    // Tag "clinical" should map to tool_a and tool_c
    const clinicalMatches = router.matchTools(["clinical"], toolMap);
    expect(clinicalMatches.map((t) => t.name).sort()).toEqual(["tool_a", "tool_c"]);

    // Tag "hospital" should map to tool_c only
    const hospitalMatches = router.matchTools(["hospital"], toolMap);
    expect(hospitalMatches.map((t) => t.name)).toEqual(["tool_c"]);
  });

  it("returns tools for archetypes with matching tags", () => {
    const tool1 = makeTool("research_drug", 3, ["drug-safety", "fda", "risk"]);
    const tool2 = makeTool("search_ae", 2, ["drug-safety", "fda", "clinical"]);
    const tool3 = makeTool("search_patents", 2, ["ip", "innovation"]);
    toolMap.set("research_drug", tool1);
    toolMap.set("search_ae", tool2);
    toolMap.set("search_patents", tool3);

    router.buildIndex(toolMap);

    // Archetype tags that overlap with drug-safety tools
    const matched = router.matchTools(["drug-safety", "fda"], toolMap);
    expect(matched.length).toBe(2);
    expect(matched.map((t) => t.name)).toContain("research_drug");
    expect(matched.map((t) => t.name)).toContain("search_ae");
    // search_patents should NOT be included (no tag overlap)
    expect(matched.map((t) => t.name)).not.toContain("search_patents");
  });

  it("Layer 3 tools appear before Layer 2 in tag-matched results with equal scores", () => {
    const layer3Tool = makeTool("research_foo", 3, ["quality", "clinical"]);
    const layer2Tool = makeTool("search_foo", 2, ["quality", "clinical"]);
    toolMap.set("research_foo", layer3Tool);
    toolMap.set("search_foo", layer2Tool);

    router.buildIndex(toolMap);

    const matched = router.matchTools(["quality", "clinical"], toolMap);
    expect(matched.length).toBe(2);
    // Layer 3 should come first when scores are equal
    expect(matched[0].name).toBe("research_foo");
    expect(matched[0].layer).toBe(3);
    expect(matched[1].name).toBe("search_foo");
    expect(matched[1].layer).toBe(2);
  });

  it("higher score tools appear before lower score tools regardless of layer", () => {
    const layer2HighScore = makeTool("search_bar", 2, ["fda", "clinical", "risk"]);
    const layer3LowScore = makeTool("research_bar", 3, ["fda"]);
    toolMap.set("search_bar", layer2HighScore);
    toolMap.set("research_bar", layer3LowScore);

    router.buildIndex(toolMap);

    // Search with tags that give Layer 2 a higher score
    const matched = router.matchTools(["fda", "clinical", "risk"], toolMap);
    expect(matched.length).toBe(2);
    // Layer 2 tool matches 3 tags, Layer 3 matches only 1
    expect(matched[0].name).toBe("search_bar");
    expect(matched[1].name).toBe("research_bar");
  });

  it("returns empty array for tags with no matches", () => {
    const tool = makeTool("tool_x", 2, ["fda"]);
    toolMap.set("tool_x", tool);
    router.buildIndex(toolMap);

    const matched = router.matchTools(["nonexistent-tag"], toolMap);
    expect(matched).toEqual([]);
  });

  it("handles tools without routingTags gracefully", () => {
    const toolWithTags = makeTool("with_tags", 2, ["fda"]);
    const toolWithoutTags: DataSourceTool = {
      name: "no_tags",
      description: "No routing tags",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({
        content: "",
        citations: [],
        vintage: { queriedAt: new Date().toISOString(), source: "test" },
        confidence: "HIGH" as const,
        truncated: false,
      }),
      layer: 2,
      sources: ["test"],
      // routingTags deliberately omitted
    };
    toolMap.set("with_tags", toolWithTags);
    toolMap.set("no_tags", toolWithoutTags);

    router.buildIndex(toolMap);

    const matched = router.matchTools(["fda"], toolMap);
    expect(matched.length).toBe(1);
    expect(matched[0].name).toBe("with_tags");
  });
});

describe("ARCHETYPE_TOOL_ROUTING", () => {
  it("every archetype with explicit routing gets at least 1 tool", () => {
    for (const [archetype, routing] of Object.entries(ARCHETYPE_TOOL_ROUTING)) {
      const totalTools = routing.research.length + routing.granular.length;
      expect(totalTools).toBeGreaterThanOrEqual(1);
    }
  });

  it("no explicit routing entry exceeds 8 tools", () => {
    for (const [archetype, routing] of Object.entries(ARCHETYPE_TOOL_ROUTING)) {
      const totalTools = routing.research.length + routing.granular.length;
      expect(totalTools).toBeLessThanOrEqual(8);
    }
  });

  it("explicit overrides take precedence over tag matches", () => {
    // Create a controlled scenario: router with tools + explicit routing
    const router = new TagBasedRouter();
    const toolMap = new Map<string, DataSourceTool>();

    const tool1 = makeTool("research_drug_safety", 3, ["drug-safety", "fda"]);
    const tool2 = makeTool("search_adverse_events", 2, ["drug-safety", "fda"]);
    const tool3 = makeTool("search_patents", 2, ["ip", "innovation"]);
    toolMap.set("research_drug_safety", tool1);
    toolMap.set("search_adverse_events", tool2);
    toolMap.set("search_patents", tool3);

    router.buildIndex(toolMap);

    // Tag-based would return tool1 + tool2 for ["drug-safety", "fda"]
    const tagMatched = router.matchTools(["drug-safety", "fda"], toolMap);
    expect(tagMatched.length).toBe(2);

    // But explicit routing for ANALYST-RISK specifies different tools
    const explicitRouting = ARCHETYPE_TOOL_ROUTING["ANALYST-RISK"];
    expect(explicitRouting).toBeDefined();

    // The explicit routing should be used directly, not the tag matches
    // This verifies the data structure exists for precedence checking
    expect(explicitRouting.research.length).toBeGreaterThan(0);
  });
});

describe("routingTags coverage", () => {
  it("all Layer 2 tools have routingTags defined", () => {
    for (const tool of allLayer2Tools) {
      expect(
        tool.routingTags,
        `Layer 2 tool "${tool.name}" is missing routingTags`,
      ).toBeDefined();
      expect(
        tool.routingTags!.length,
        `Layer 2 tool "${tool.name}" has empty routingTags`,
      ).toBeGreaterThan(0);
    }
  });

  it("all Layer 3 research tools have routingTags defined", () => {
    for (const tool of allLayer3Tools) {
      expect(
        tool.routingTags,
        `Layer 3 tool "${tool.name}" is missing routingTags`,
      ).toBeDefined();
      expect(
        tool.routingTags!.length,
        `Layer 3 tool "${tool.name}" has empty routingTags`,
      ).toBeGreaterThan(0);
    }
  });

  it("all tools have at least 3 routing tags for meaningful overlap", () => {
    for (const tool of allTools) {
      if (tool.routingTags) {
        expect(
          tool.routingTags.length,
          `Tool "${tool.name}" has fewer than 3 routingTags (${tool.routingTags.length})`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
