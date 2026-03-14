import { describe, it, expect } from "vitest";
import { compileCharts } from "../present/chart-compiler";
import type { DataPoint, DonutChartData } from "../present/types";

describe("chart-compiler: donut charts", () => {
  const donutPoints: DataPoint[] = [
    { label: "Payer Analytics", value: 40, unit: "%", chartRole: "donut-segment" },
    { label: "Provider Solutions", value: 28, unit: "%", chartRole: "donut-segment" },
    { label: "Life Sciences", value: 20, unit: "%", chartRole: "donut-segment" },
    { label: "Government", value: 12, unit: "%", chartRole: "donut-segment" },
  ];

  it("produces a donut ChartData with correct segments", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    expect(donut).toBeDefined();
    expect(donut.segments).toHaveLength(4);
    expect(donut.circumference).toBeCloseTo(502.65, 1);
  });

  it("computes correct dashArray for first segment (40%)", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    expect(donut.segments[0].dashArray).toBe("201.06 502.65");
    expect(donut.segments[0].dashOffset).toBe("0");
  });

  it("computes correct dashOffset for second segment", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    expect(donut.segments[1].dashOffset).toBe("-201.06");
  });

  it("generates valid SVG fragment with chart-legend", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    expect(donut.svgFragment).toContain('<svg class="donut-chart"');
    expect(donut.svgFragment).toContain('class="segment"');
    expect(donut.svgFragment).toContain('class="chart-legend"');
    expect(donut.svgFragment).toContain('class="legend-item"');
    expect(donut.svgFragment).toContain('class="legend-dot"');
  });

  it("assigns chart colors in order", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    expect(donut.segments[0].color).toBe("var(--chart-1)");
    expect(donut.segments[1].color).toBe("var(--chart-2)");
  });
});
