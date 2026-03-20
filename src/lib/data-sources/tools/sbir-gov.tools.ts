// src/lib/data-sources/tools/sbir-gov.tools.ts
/**
 * SBIR.gov Layer 2 Granular Tools
 *
 * 2 tools that wrap SBIR.gov Layer 1 API client calls and return
 * markdown-formatted ToolResult responses. Agents see these tools
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import { sbirGovClient } from "../clients/sbir-gov";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  dig,
} from "../format";

// ─── search_sbir_awards ──────────────────────────────────────

const searchSbirAwards: DataSourceTool = {
  name: "search_sbir_awards",
  description:
    "Search SBIR/STTR (Small Business Innovation Research) awards by keyword, " +
    "agency, or year. Returns award details including funding amounts, companies, and topics.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword to search awards" },
      agency: { type: "string", description: "Funding agency (e.g., 'HHS', 'NIH', 'DOD', 'NSF')" },
      year: { type: "number", description: "Award year" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["sbir-gov"],
  routingTags: ["funding", "innovation", "technology", "government"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const response = await sbirGovClient.searchAwards({
      query: input.query as string | undefined,
      agency: input.agency as string | undefined,
      year: input.year as number | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Company", "Award Title", "Agency", "Amount", "Year", "Phase"];
    const rows = response.data.results.map((r) => {
      const amount = Number(dig(r, "award_amount", dig(r, "amount", "0")).replace(/[$,]/g, "")) || 0;
      return [
        dig(r, "firm", dig(r, "company", dig(r, "firm_name", "Unknown"))).slice(0, 30),
        dig(r, "award_title", dig(r, "title", "—")).slice(0, 45),
        dig(r, "agency"),
        amount > 0 ? `$${formatNumber(amount)}` : "—",
        dig(r, "award_year", dig(r, "year", "—")),
        dig(r, "phase", dig(r, "program", "—")),
      ];
    });

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.query ?? input.agency ?? "all") as string;

    const citation = {
      id: `[SBIR-${Date.now()}]`,
      source: "SBIR.gov",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## SBIR/STTR Awards: ${queryDesc}\n\n**${formatNumber(response.data.total)} awards found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_health_innovation_grants ─────────────────────────

const searchHealthInnovationGrants: DataSourceTool = {
  name: "search_health_innovation_grants",
  description:
    "Search SBIR/STTR awards specifically related to health innovation. " +
    "Pre-filters for HHS, NIH, and FDA awards. Returns health-focused " +
    "small business research awards and technology transfer grants.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Health innovation keyword (e.g., 'gene therapy', 'digital health')" },
      year: { type: "number", description: "Award year" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["query"],
  },
  layer: 2,
  sources: ["sbir-gov"],
  routingTags: ["funding", "innovation", "health-tech", "government"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    // Search across health-related agencies in parallel
    const [hhsResult, nihResult] = await Promise.all([
      sbirGovClient.searchAwards({
        query: input.query as string,
        agency: "HHS",
        year: input.year as number | undefined,
        limit: (input.limit as number | undefined) ?? 10,
      }),
      sbirGovClient.searchAwards({
        query: input.query as string,
        agency: "NIH",
        year: input.year as number | undefined,
        limit: (input.limit as number | undefined) ?? 10,
      }),
    ]);

    // Merge and deduplicate results
    const allResults = [...hhsResult.data.results, ...nihResult.data.results];
    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
      const key = dig(r, "award_id", dig(r, "id", dig(r, "firm", "") + dig(r, "award_title", "")));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const limit = (input.limit as number | undefined) ?? 10;
    const results = deduped.slice(0, limit);

    const headers = ["Company", "Award Title", "Agency", "Amount", "Year", "Phase"];
    const rows = results.map((r) => {
      const amount = Number(dig(r, "award_amount", dig(r, "amount", "0")).replace(/[$,]/g, "")) || 0;
      return [
        dig(r, "firm", dig(r, "company", dig(r, "firm_name", "Unknown"))).slice(0, 30),
        dig(r, "award_title", dig(r, "title", "—")).slice(0, 45),
        dig(r, "agency"),
        amount > 0 ? `$${formatNumber(amount)}` : "—",
        dig(r, "award_year", dig(r, "year", "—")),
        dig(r, "phase", dig(r, "program", "—")),
      ];
    });

    const totalResults = deduped.length;
    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, totalResults);
    const queryDesc = input.query as string;

    const citation = {
      id: `[SBIR-HEALTH-${Date.now()}]`,
      source: "SBIR.gov (HHS/NIH)",
      query: queryDesc,
      resultCount: totalResults,
    };

    return {
      content: `## Health Innovation SBIR Awards: ${queryDesc}\n\n**${formatNumber(totalResults)} awards found** (HHS + NIH)\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: hhsResult.vintage,
      confidence: totalResults > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < totalResults,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const sbirGovTools: DataSourceTool[] = [
  searchSbirAwards,
  searchHealthInnovationGrants,
];
