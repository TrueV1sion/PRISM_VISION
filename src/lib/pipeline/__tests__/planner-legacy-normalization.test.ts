import { describe, expect, it } from "vitest";

import { normalizeLegacyManifest } from "../present/planner";
import type { SlideManifest } from "../present/types";
import type { AgentResult } from "@/lib/pipeline/types";

describe("normalizeLegacyManifest", () => {
  it("reorders the executive spine and enriches component hints and chart roles", () => {
    const manifest: SlideManifest = {
      title: "PRISM Brief",
      subtitle: "Two-agent synthesis",
      totalSlides: 5,
      slides: [
        {
          slideNumber: 1,
          title: "Revenue Growth Trend",
          type: "data-metrics",
          purpose: "Show revenue growth over time and the inflection point that matters most.",
          agentSources: ["Financial Analyst"],
          componentHints: ["stat-block"],
          animationType: "anim",
          dataPoints: [
            { label: "2022", value: 84, unit: "M", chartRole: "bar-value" },
            { label: "2023", value: 97, unit: "M", chartRole: "bar-value" },
            { label: "2024", value: 113, unit: "M", chartRole: "bar-value" },
          ],
        },
        {
          slideNumber: 2,
          title: "Strategic Outlook",
          type: "closing",
          purpose: "Wrap the brief.",
          agentSources: ["Financial Analyst"],
          componentHints: ["hero-title"],
          animationType: "anim",
          dataPoints: [],
        },
        {
          slideNumber: 3,
          title: "Where To Focus",
          type: "findings-toc",
          purpose: "Orient the reader.",
          agentSources: ["Financial Analyst"],
          componentHints: ["toc-item"],
          animationType: "anim",
          dataPoints: [],
        },
        {
          slideNumber: 4,
          title: "PRISM Brief",
          type: "title",
          purpose: "Open the briefing.",
          agentSources: ["Financial Analyst"],
          componentHints: ["hero-title"],
          animationType: "anim",
          dataPoints: [],
        },
        {
          slideNumber: 5,
          title: "Executive Summary",
          type: "executive-summary",
          purpose: "Summarize what matters most.",
          agentSources: ["Financial Analyst"],
          componentHints: ["callout"],
          animationType: "anim",
          dataPoints: [
            { label: "Margin at Risk", value: 32, unit: "%", chartRole: "bar-value" },
            { label: "Priority Readiness", value: 78, unit: "%", chartRole: "bar-value" },
            { label: "Execution Window", value: 6, unit: "mo", chartRole: "bar-value" },
          ],
        },
      ],
    };

    const agents: AgentResult[] = [
      {
        agentName: "Financial Analyst",
        archetype: "ANALYST-FINANCIAL",
        dimension: "Financial",
        findings: [],
        gaps: [],
        signals: [],
        minorityViews: [],
        toolsUsed: [],
        tokensUsed: 0,
      },
      {
        agentName: "Market Analyst",
        archetype: "ANALYST-STRATEGIC",
        dimension: "Market",
        findings: [],
        gaps: [],
        signals: [],
        minorityViews: [],
        toolsUsed: [],
        tokensUsed: 0,
      },
    ];

    const normalized = normalizeLegacyManifest(manifest, agents);

    expect(normalized.slides.map((slide) => slide.type)).toEqual([
      "title",
      "findings-toc",
      "executive-summary",
      "data-metrics",
      "closing",
    ]);

    expect(normalized.slides[1].componentHints).toContain("icon-grid");
    expect(normalized.slides[2].componentHints).toContain("comparison-bars");
    expect(normalized.slides[2].componentHints).toContain("feature-grid");
    expect(normalized.slides[4].componentHints).toContain("process-flow");

    expect(normalized.slides[0].agentSources).toEqual([
      "Financial Analyst",
      "Market Analyst",
    ]);

    expect(normalized.slides[2].dataPoints[0].chartRole).toBe("counter-target");
    expect(normalized.slides[2].dataPoints[1].chartRole).toBe("bar-fill-percent");

    expect(normalized.slides[3].dataPoints[0].chartRole).toBe("counter-target");
    expect(normalized.slides[3].dataPoints[1].chartRole).toBe("line-point");
    expect(normalized.slides[3].animationType).toBe("stagger-children");
  });
});
