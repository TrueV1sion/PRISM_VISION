// src/lib/data-sources/tools/opensecrets.tools.ts
/**
 * OpenSecrets Layer 2 Granular Tools
 *
 * 3 tools that wrap OpenSecrets Layer 1 API client calls and return
 * markdown-formatted ToolResult responses. Agents see these tools
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import { openSecretsClient } from "../clients/opensecrets";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  dig,
} from "../format";

// ─── search_lobbying_activity ────────────────────────────────

const searchLobbyingActivity: DataSourceTool = {
  name: "search_lobbying_activity",
  description:
    "Search OpenSecrets lobbying data by client name, lobbyist, or issue area. " +
    "Returns markdown table of lobbying registrations and expenditures.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Lobbyist name or client to search" },
      year: { type: "string", description: "Year to filter (e.g., '2024')" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["query"],
  },
  layer: 2,
  sources: ["opensecrets"],
  routingTags: ["lobbying", "influence", "political", "corporate"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const response = await openSecretsClient.searchLobbyists({
      query: input.query as string,
      year: input.year as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Lobbyist", "Registrant", "Client", "Year", "Filing"];
    const rows = response.data.results.map((r) => [
      dig(r, "lobbyist_name", dig(r, "lobbyist", "Unknown")),
      dig(r, "registrant_name", dig(r, "registrant", "—")),
      dig(r, "client_name", dig(r, "client", "—")),
      dig(r, "year"),
      dig(r, "filing_type", dig(r, "type", "—")),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = input.query as string;

    const citation = {
      id: `[OS-LOBBY-${Date.now()}]`,
      source: "OpenSecrets Lobbying",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Lobbying Activity: ${queryDesc}\n\n**${formatNumber(response.data.total)} records found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_pac_contributions ────────────────────────────────

const searchPacContributions: DataSourceTool = {
  name: "search_pac_contributions",
  description:
    "Search top PAC/organization contributions to a specific candidate using their OpenSecrets CID. " +
    "Returns markdown table of top contributing organizations.",
  inputSchema: {
    type: "object",
    properties: {
      candidate_id: { type: "string", description: "OpenSecrets candidate CID (e.g., N00007360)" },
      cycle: { type: "string", description: "Election cycle year (e.g., '2024')" },
    },
    required: ["candidate_id"],
  },
  layer: 2,
  sources: ["opensecrets"],
  routingTags: ["lobbying", "influence", "political", "campaign"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const response = await openSecretsClient.getContributions({
      candidateId: input.candidate_id as string,
      cycle: input.cycle as string | undefined,
    });

    const headers = ["Organization", "Total", "PACs", "Individuals"];
    const rows = response.data.results.map((r) => [
      dig(r, "org_name", dig(r, "organization", "Unknown")),
      `$${formatNumber(Number(dig(r, "total", "0").replace(/[$,]/g, "")) || 0)}`,
      `$${formatNumber(Number(dig(r, "pacs", "0").replace(/[$,]/g, "")) || 0)}`,
      `$${formatNumber(Number(dig(r, "indivs", "0").replace(/[$,]/g, "")) || 0)}`,
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = `CID ${input.candidate_id as string}`;

    const citation = {
      id: `[OS-CONTRIB-${Date.now()}]`,
      source: "OpenSecrets Contributions",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## PAC Contributions: ${queryDesc}\n\n**${formatNumber(response.data.total)} contributors found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_campaign_contributions ───────────────────────────

const searchCampaignContributions: DataSourceTool = {
  name: "search_campaign_contributions",
  description:
    "Search campaign contributions by industry sector using OpenSecrets industry codes. " +
    "Returns industry-level giving totals to candidates and parties.",
  inputSchema: {
    type: "object",
    properties: {
      industry_code: { type: "string", description: "OpenSecrets industry code (e.g., H04 for Pharmaceuticals)" },
      cycle: { type: "string", description: "Election cycle year (e.g., '2024')" },
    },
    required: ["industry_code"],
  },
  layer: 2,
  sources: ["opensecrets"],
  routingTags: ["lobbying", "influence", "political", "campaign"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const response = await openSecretsClient.getIndustryTotals({
      industryCode: input.industry_code as string,
      cycle: input.cycle as string | undefined,
    });

    const headers = ["Candidate", "Party", "Total", "PACs", "Individuals", "State"];
    const rows = response.data.results.map((r) => [
      dig(r, "cand_name", dig(r, "candidate", "Unknown")),
      dig(r, "party"),
      `$${formatNumber(Number(dig(r, "total", "0").replace(/[$,]/g, "")) || 0)}`,
      `$${formatNumber(Number(dig(r, "pacs", "0").replace(/[$,]/g, "")) || 0)}`,
      `$${formatNumber(Number(dig(r, "indivs", "0").replace(/[$,]/g, "")) || 0)}`,
      dig(r, "state"),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = `Industry ${input.industry_code as string}`;

    const citation = {
      id: `[OS-INDUSTRY-${Date.now()}]`,
      source: "OpenSecrets Industry",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Campaign Contributions: ${queryDesc}\n\n**${formatNumber(response.data.total)} recipients found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const openSecretsTools: DataSourceTool[] = [
  searchLobbyingActivity,
  searchPacContributions,
  searchCampaignContributions,
];
