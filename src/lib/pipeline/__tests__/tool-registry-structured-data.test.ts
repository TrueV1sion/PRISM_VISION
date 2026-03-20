import { describe, expect, it } from "vitest";

import { buildStructuredDataFromResult } from "../../data-sources/registry";
import type { ToolResult } from "../../data-sources/types";

describe("buildStructuredDataFromResult", () => {
  it("derives citation counts and markdown table metrics for narrative tools", () => {
    const result: ToolResult = {
      content: `## Coverage Intelligence

| Source | Count |
| --- | --- |
| CMS NCD | 12 |
| ICD-10 | 48 |`,
      citations: [
        {
          id: "[CMS-1]",
          source: "CMS NCD",
          query: "heart failure",
          resultCount: 12,
        },
        {
          id: "[ICD10-1]",
          source: "ICD-10",
          query: "heart failure",
          resultCount: 48,
        },
      ],
      vintage: {
        queriedAt: "2026-03-20T00:00:00.000Z",
        source: "CMS / ICD-10",
      },
      confidence: "HIGH",
      truncated: false,
    };

    const structured = buildStructuredDataFromResult(result);

    expect(structured).toBeDefined();
    expect(structured?.citation_result_counts).toEqual([
      {
        label: "CMS NCD",
        period: "CMS NCD",
        value: 12,
        query: "heart failure",
      },
      {
        label: "ICD-10",
        period: "ICD-10",
        value: 48,
        query: "heart failure",
      },
    ]);
    expect(structured?.table_0).toEqual([
      {
        label: "CMS NCD",
        period: "CMS NCD",
        value: 12,
      },
      {
        label: "ICD-10",
        period: "ICD-10",
        value: 48,
      },
    ]);
  });

  it("preserves explicit structured data from the tool result", () => {
    const result: ToolResult = {
      content: "## Existing data",
      citations: [],
      vintage: {
        queriedAt: "2026-03-20T00:00:00.000Z",
        source: "SEC",
      },
      confidence: "HIGH",
      truncated: false,
      structuredData: {
        revenue: [
          { period: "2023", value: 10 },
          { period: "2024", value: 12 },
        ],
      },
    };

    const structured = buildStructuredDataFromResult(result);

    expect(structured).toEqual({
      revenue: [
        { period: "2023", value: 10 },
        { period: "2024", value: 12 },
      ],
    });
  });
});
