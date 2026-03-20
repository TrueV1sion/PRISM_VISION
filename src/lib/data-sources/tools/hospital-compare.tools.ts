// src/lib/data-sources/tools/hospital-compare.tools.ts
/**
 * Hospital Compare Layer 2 Granular Tools
 *
 * 2 tools that wrap CMS Hospital Compare Layer 1 API client calls and return
 * markdown-formatted ToolResult responses. Agents see these tools
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import { hospitalCompareClient } from "../clients/hospital-compare";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  dig,
} from "../format";

// ─── search_hospital_quality ─────────────────────────────────

const searchHospitalQuality: DataSourceTool = {
  name: "search_hospital_quality",
  description:
    "Search CMS Hospital Compare for hospital quality measures including " +
    "timely and effective care metrics. Filter by hospital name, state, or zip code. " +
    "Returns quality scores, ratings, and comparison metrics.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Hospital name to search" },
      state: { type: "string", description: "Two-letter state code (e.g., 'CA', 'NY')" },
      zip_code: { type: "string", description: "ZIP code to search nearby hospitals" },
      provider_id: { type: "string", description: "CMS provider ID (if known)" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["hospital-compare"],
  routingTags: ["quality", "hospital", "provider", "benchmarking", "cms"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    // If provider_id given, get quality scores directly
    if (input.provider_id) {
      const qualityResponse = await hospitalCompareClient.getQualityScores({
        providerId: input.provider_id as string,
      });

      const headers = ["Measure", "Score", "Compared to National", "Footnote"];
      const rows = qualityResponse.data.results.map((r) => [
        dig(r, "measure_name", dig(r, "measure_id", "Unknown")).slice(0, 60),
        dig(r, "score", dig(r, "measure_score", "—")),
        dig(r, "compared_to_national", dig(r, "comparison", "—")),
        dig(r, "footnote", "—").slice(0, 30),
      ]);

      const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, qualityResponse.data.total);

      const citation = {
        id: `[HC-QUAL-${Date.now()}]`,
        source: "CMS Hospital Compare",
        query: `Provider ${input.provider_id as string}`,
        resultCount: qualityResponse.data.total,
      };

      return {
        content: `## Hospital Quality: Provider ${input.provider_id as string}\n\n**${formatNumber(qualityResponse.data.total)} quality measures**\n\n${table}\n\n${formatCitations([citation])}`,
        citations: [citation],
        vintage: qualityResponse.vintage,
        confidence: qualityResponse.data.total > 0 ? "HIGH" : "MEDIUM",
        truncated: rows.length < qualityResponse.data.total,
      };
    }

    // Otherwise, search hospitals first
    const response = await hospitalCompareClient.searchHospitals({
      query: input.query as string | undefined,
      state: input.state as string | undefined,
      zipCode: input.zip_code as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Hospital", "City", "State", "Rating", "Type", "Ownership"];
    const rows = response.data.results.map((r) => [
      dig(r, "hospital_name", "Unknown").slice(0, 40),
      dig(r, "city"),
      dig(r, "state"),
      dig(r, "hospital_overall_rating", dig(r, "overall_rating", "—")),
      dig(r, "hospital_type", "—").slice(0, 25),
      dig(r, "hospital_ownership", "—").slice(0, 25),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.query ?? input.state ?? input.zip_code ?? "all") as string;

    const citation = {
      id: `[HC-SEARCH-${Date.now()}]`,
      source: "CMS Hospital Compare",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Hospital Quality: ${queryDesc}\n\n**${formatNumber(response.data.total)} hospitals found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_patient_experience ───────────────────────────────

const searchPatientExperience: DataSourceTool = {
  name: "search_patient_experience",
  description:
    "Search HCAHPS patient experience survey results for hospitals. " +
    "Returns patient satisfaction scores including communication, cleanliness, " +
    "responsiveness, and overall hospital rating from patient surveys.",
  inputSchema: {
    type: "object",
    properties: {
      provider_id: { type: "string", description: "CMS provider ID for the hospital" },
      query: { type: "string", description: "Hospital name to search (used to find provider ID)" },
      state: { type: "string", description: "Two-letter state code" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["hospital-compare"],
  routingTags: ["quality", "hospital", "patient", "benchmarking"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    // If we have a provider_id, get HCAHPS directly
    if (input.provider_id) {
      const experienceResponse = await hospitalCompareClient.getPatientExperience({
        providerId: input.provider_id as string,
      });

      const headers = ["Survey Question", "Top-Box %", "Star Rating", "Compared to National"];
      const rows = experienceResponse.data.results.map((r) => [
        dig(r, "hcahps_question", dig(r, "measure_id", "Unknown")).slice(0, 50),
        dig(r, "patient_survey_star_rating_top_box_answer_percent",
          dig(r, "hcahps_answer_percent", "—")),
        dig(r, "patient_survey_star_rating", dig(r, "star_rating", "—")),
        dig(r, "hcahps_linear_mean_value", dig(r, "compared_to_national", "—")),
      ]);

      const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, experienceResponse.data.total);

      const citation = {
        id: `[HC-HCAHPS-${Date.now()}]`,
        source: "CMS HCAHPS Survey",
        query: `Provider ${input.provider_id as string}`,
        resultCount: experienceResponse.data.total,
      };

      return {
        content: `## Patient Experience: Provider ${input.provider_id as string}\n\n**${formatNumber(experienceResponse.data.total)} survey measures**\n\n${table}\n\n${formatCitations([citation])}`,
        citations: [citation],
        vintage: experienceResponse.vintage,
        confidence: experienceResponse.data.total > 0 ? "HIGH" : "MEDIUM",
        truncated: rows.length < experienceResponse.data.total,
      };
    }

    // Otherwise search for hospitals to show basic info
    const response = await hospitalCompareClient.searchHospitals({
      query: input.query as string | undefined,
      state: input.state as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Hospital", "City/State", "Overall Rating", "Provider ID"];
    const rows = response.data.results.map((r) => {
      const city = dig(r, "city");
      const state = dig(r, "state");
      return [
        dig(r, "hospital_name", "Unknown").slice(0, 45),
        `${city}, ${state}`,
        dig(r, "hospital_overall_rating", "—"),
        dig(r, "provider_id", dig(r, "facility_id", "—")),
      ];
    });

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.query ?? input.state ?? "all") as string;

    const citation = {
      id: `[HC-EXP-${Date.now()}]`,
      source: "CMS Hospital Compare",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Patient Experience: ${queryDesc}\n\n**${formatNumber(response.data.total)} hospitals found** — Use provider_id for detailed HCAHPS scores\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const hospitalCompareTools: DataSourceTool[] = [
  searchHospitalQuality,
  searchPatientExperience,
];
