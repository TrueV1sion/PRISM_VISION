// src/lib/data-sources/tools/leapfrog.tools.ts
/**
 * Leapfrog Hospital Safety Grade Layer 2 Granular Tools
 *
 * 1 tool that wraps Leapfrog Layer 1 API client calls and returns
 * markdown-formatted ToolResult responses. Agents see this tool
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import { leapfrogClient } from "../clients/leapfrog";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  dig,
} from "../format";

// ─── search_hospital_safety_grades ───────────────────────────

const searchHospitalSafetyGrades: DataSourceTool = {
  name: "search_hospital_safety_grades",
  description:
    "Search Leapfrog Hospital Safety Grades. Returns letter grades (A through F) " +
    "for hospital patient safety based on errors, injuries, accidents, and infections. " +
    "Useful for comparing hospital safety across facilities or regions.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Hospital name to search" },
      state: { type: "string", description: "Two-letter state code (e.g., 'CA', 'NY')" },
      facility_name: { type: "string", description: "Exact facility name for precise lookup" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["leapfrog"],
  routingTags: ["quality", "safety", "hospital", "provider", "benchmarking"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    let response;

    if (input.facility_name) {
      response = await leapfrogClient.getGradeByFacility({
        facilityName: input.facility_name as string,
        state: input.state as string | undefined,
      });
    } else {
      response = await leapfrogClient.searchHospitalGrades({
        query: input.query as string | undefined,
        state: input.state as string | undefined,
        limit: (input.limit as number | undefined) ?? 10,
      });
    }

    const headers = ["Hospital", "City", "State", "Safety Grade", "Score"];
    const rows = response.data.results.map((r) => [
      dig(r, "hospital_name", dig(r, "name", dig(r, "hospital", "Unknown"))).slice(0, 45),
      dig(r, "city"),
      dig(r, "state"),
      dig(r, "safety_grade", dig(r, "grade", dig(r, "letter_grade", "—"))),
      dig(r, "weighted_score", dig(r, "score", "—")),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.facility_name ?? input.query ?? input.state ?? "all") as string;

    // Count grade distribution
    const gradeCounts: Record<string, number> = {};
    for (const r of response.data.results) {
      const grade = dig(r, "safety_grade", dig(r, "grade", dig(r, "letter_grade", "Unknown")));
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }
    const gradeDistribution = Object.entries(gradeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([grade, count]) => `${grade}: ${count}`)
      .join(" | ");

    const citation = {
      id: `[LEAPFROG-${Date.now()}]`,
      source: "Leapfrog Hospital Safety Grade",
      query: queryDesc,
      resultCount: response.data.total,
    };

    const gradeNote = gradeDistribution ? `\n**Grade Distribution**: ${gradeDistribution}\n` : "";

    return {
      content: `## Hospital Safety Grades: ${queryDesc}\n\n**${formatNumber(response.data.total)} hospitals found**${gradeNote}\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const leapfrogTools: DataSourceTool[] = [
  searchHospitalSafetyGrades,
];
