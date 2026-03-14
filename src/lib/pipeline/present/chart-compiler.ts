import type { DataPoint, ChartData, DonutChartData, DonutSegment } from "./types";

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

const DONUT_RADIUS = 80;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS; // 502.6548...

export function compileCharts(dataPoints: DataPoint[]): ChartData[] {
  const results: ChartData[] = [];

  // Group by chartRole
  const groups = new Map<string, DataPoint[]>();
  for (const pt of dataPoints) {
    const existing = groups.get(pt.chartRole) ?? [];
    existing.push(pt);
    groups.set(pt.chartRole, existing);
  }

  // Process donut segments
  const donutPoints = groups.get("donut-segment");
  if (donutPoints?.length) {
    results.push(compileDonut(donutPoints));
  }

  return results;
}

function compileDonut(points: DataPoint[]): DonutChartData {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  let offset = 0;

  const segments: DonutSegment[] = points.map((pt, i) => {
    const pct = pt.value / total;
    const dashLen = +(pct * DONUT_CIRCUMFERENCE).toFixed(2);
    const seg: DonutSegment = {
      label: pt.label,
      percentage: +(pct * 100).toFixed(1),
      dashArray: `${dashLen} ${+DONUT_CIRCUMFERENCE.toFixed(2)}`,
      dashOffset: offset === 0 ? "0" : `-${offset.toFixed(2)}`,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
    offset += dashLen;
    return seg;
  });

  // Generate SVG fragment
  const circles = segments.map(s =>
    `<circle class="segment" cx="100" cy="100" r="${DONUT_RADIUS}" stroke="${s.color}" stroke-width="24" stroke-dasharray="${s.dashArray}" stroke-dashoffset="${s.dashOffset}" fill="none" />`
  ).join("\n    ");

  const legendItems = segments.map(s =>
    `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span> ${s.label} (${s.percentage}%)</div>`
  ).join("\n      ");

  const svgFragment = `<div style="display:flex;align-items:center;gap:2rem;">
  <svg class="donut-chart" viewBox="0 0 200 200" style="max-width:200px">
    ${circles}
  </svg>
  <div class="chart-legend">
      ${legendItems}
  </div>
</div>`;

  return {
    type: "donut",
    segments,
    circumference: +DONUT_CIRCUMFERENCE.toFixed(2),
    svgFragment,
  };
}
