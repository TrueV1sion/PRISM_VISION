import { describe, it, expect, vi } from "vitest";
import { enrichToolCalls } from "../present/enricher";
import { selectTemplate } from "../present/template-registry";
import { renderSlide } from "../present/template-renderer";
import { compileChartFromDataset } from "../present/chart-compiler";
import type { CapturedToolCall } from "../present/data-capture";
import type { ContentGeneratorOutput } from "../present/types";

describe("Template Pipeline Integration", () => {
  it("flows from captured data through enrichment to rendered slide", () => {
    // Step 1: Capture
    // Use 5 data points to land in DV-01 (Trend Hero) density range [4,7]
    const captured: CapturedToolCall[] = [{
      runId: "int-test",
      agentId: "market-analyst",
      mcpServer: "sec-edgar",
      toolName: "get_filing",
      toolParams: { ticker: "INVA" },
      rawResponse: JSON.stringify({
        revenue: [
          { year: "2020", value: 689400000 },
          { year: "2021", value: 718900000 },
          { year: "2022", value: 743200000 },
          { year: "2023", value: 812600000 },
          { year: "2024", value: 872300000 },
        ],
      }),
      responseBytes: 250,
      latencyMs: 450,
      capturedAt: new Date(),
    }];

    // Step 2: Enrich
    const registry = enrichToolCalls("int-test", captured);
    expect(registry.datasets.length).toBeGreaterThan(0);

    const dataset = registry.datasets[0];
    expect(dataset.dataShape).toBe("time_series");
    expect(dataset.computed.trend).toBe("up");

    // Step 3: Select template
    const template = selectTemplate(
      [dataset.dataShape],
      dataset.values.length,
      "trend",
      new Set(),
    );
    expect(template.id).toBe("DV-01"); // Trend Hero for time_series with 5 points

    // Step 4: Compile chart from real data
    const chart = compileChartFromDataset(dataset, "line");
    expect(chart.svgFragment).toContain("<svg");

    // Step 5: Render with content
    const content: ContentGeneratorOutput = {
      slots: {
        headline: "Revenue Acceleration",
        subhead: "Five-year trajectory shows consistent growth",
        slide_class: "gradient-dark",
        source: dataset.sourceLabel,
        stat_1: { value: "$872.3M", label: "FY2024 Revenue", color_class: "cyan" },
        stat_2: { value: "6.1%", label: "5-Year CAGR", color_class: "green" },
        stat_3: { value: "+7.3%", label: "YoY Growth", color_class: "purple" },
      },
      chartDataRefs: { chart_primary: dataset.id },
    };

    const html = renderSlide(
      template.id,
      content,
      new Map([["chart_primary", chart.svgFragment]]),
    );

    // Verify output
    expect(html).toContain("Revenue Acceleration");
    expect(html).toContain("$872.3M");
    expect(html).toContain("gradient-dark");
    expect(html).toContain("<svg");
    expect(html).toContain("stat-block");
    expect(html).not.toContain("{{slot:");
    expect(html).not.toContain("{{component:");
    expect(html).toMatch(/<section class="slide/);
    expect(html).toMatch(/<\/section>/);
  });
});
