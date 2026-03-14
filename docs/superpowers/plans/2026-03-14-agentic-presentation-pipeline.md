# Agentic Presentation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic single-pass presentation generator with an agentic orchestration pipeline that plans slides, pre-computes chart data, generates slides in parallel, validates against the CSS design system, and remediates failures — producing decks that leverage the full 176-class design system.

**Architecture:** 8-stage pipeline: Planner (LLM) → Chart Compiler (code) → Slide Generators (parallel LLM) → Assembler (code) → Validator (code) → Design Reviewer (LLM) → Remediation Loop (LLM) → Finalizer (code). Stages 4-7 form a closed QA loop. Legacy `present()` preserved as fallback.

**Tech Stack:** TypeScript, Anthropic SDK (Sonnet), Prisma/Postgres, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-03-14-agentic-presentation-pipeline-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/pipeline/present/types.ts` | All presentation pipeline types: SlideManifest, SlideSpec, SlideHTML, ChartData variants, QualityScorecard, DesignReview, etc. |
| `src/lib/pipeline/present/component-catalog.ts` | CSS class registry (reads presentation.css), exemplar routing, prompt generation |
| `src/lib/pipeline/present/chart-compiler.ts` | Pure TS: converts DataPoint[] to SVG/HTML fragments (donut, bar, sparkline, counter) |
| `src/lib/pipeline/present/validator.ts` | Pure TS: structural HTML validation against CSS, scoring, grade assignment |
| `src/lib/pipeline/present/planner.ts` | LLM call: decomposes synthesis data into SlideManifest |
| `src/lib/pipeline/present/slide-generator.ts` | LLM call: generates single slide HTML from SlideSpec + chart data + exemplar |
| `src/lib/pipeline/present/assembler.ts` | Pure TS: stitches slides into complete HTML5 document |
| `src/lib/pipeline/present/design-reviewer.ts` | LLM call: editorial quality review of assembled deck |
| `src/lib/pipeline/present/remediator.ts` | LLM call: targeted slide repair from validator + reviewer feedback |
| `src/lib/pipeline/present/finalizer.ts` | Pure TS: CSS/JS inlining, animation baking, file write, telemetry |
| `src/lib/pipeline/present-orchestrator.ts` | Top-level orchestrator: runs all stages, manages QA loop, fallback |
| `src/lib/pipeline/__tests__/chart-compiler.test.ts` | Chart compiler unit tests |
| `src/lib/pipeline/__tests__/validator.test.ts` | Validator unit tests |
| `src/lib/pipeline/__tests__/assembler.test.ts` | Assembler unit tests |
| `src/lib/pipeline/__tests__/component-catalog.test.ts` | Component catalog unit tests |
| `references/exemplars/fragments/` | Directory for compact component fragment exemplars |

### Modified files

| File | Changes |
|------|---------|
| `public/styles/presentation.css` | Add missing CSS rules: `.legend-item`, `.source-item`, `.finding-card.caution`, `.finding-card.regulatory`, stagger delays for `.anim-scale`/`.anim-blur` |
| `references/exemplars/chart-heavy.html` | Fix sparkline structure, rewrite bar chart as SVG, remove broken class names |
| `design-tokens.yaml` | Reconcile drifted values with CSS |
| `scripts/compile-presentation-spec.ts` | Update to include component fragments in compiled spec |
| `prisma/schema.prisma` | Add `PresentationQuality` model, add relation to `Run` |
| `src/lib/pipeline/types.ts` | Extend `PresentationResult` with optional quality/timings fields, add new pipeline events |
| `src/lib/pipeline/executor.ts` | Add feature flag check, call orchestrator or legacy `present()` |
| `src/lib/pipeline/present.ts` | No changes — preserved as legacy fallback |

---

## Chunk 1: Phase 0 — CSS + Exemplar Fixes

This phase fixes all blocking issues in the design system foundation. No new pipeline code — only CSS, exemplar HTML, and design token corrections.

### Task 1: Add missing CSS rules

**Files:**
- Modify: `public/styles/presentation.css`
- Test: `src/lib/pipeline/__tests__/presentation-spec.test.ts`

- [ ] **Step 1: Write failing tests for missing CSS classes**

Add to the existing presentation spec test file:

```typescript
describe("CSS class coverage", () => {
  const cssContent = readFileSync(
    resolve(process.cwd(), "public/styles/presentation.css"),
    "utf-8"
  );

  it("defines .legend-item class", () => {
    expect(cssContent).toContain(".legend-item");
  });

  it("defines .source-item class", () => {
    expect(cssContent).toContain(".source-item");
  });

  it("defines .finding-card.caution class", () => {
    expect(cssContent).toContain(".finding-card.caution");
  });

  it("defines .finding-card.regulatory class", () => {
    expect(cssContent).toContain(".finding-card.regulatory");
  });

  it("defines stagger delays for .anim-scale", () => {
    expect(cssContent).toContain(".anim-scale.d1");
    expect(cssContent).toContain(".anim-scale.d7");
  });

  it("defines stagger delays for .anim-blur", () => {
    expect(cssContent).toContain(".anim-blur.d1");
    expect(cssContent).toContain(".anim-blur.d7");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: FAIL — all 6 new tests fail

- [ ] **Step 3: Add CSS rules to presentation.css**

Append after the existing chart styles (after the `/* ─── Charts ─────── */` section, around line 1165):

```css
/* ─── Missing Component Rules ─────── */
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.source-item { display: inline; font-size: 11px; color: var(--text-secondary); }
.finding-card.caution { border-left-color: var(--accent-warning); }
.finding-card.regulatory { border-left-color: var(--accent-error); }

/* ─── Stagger Delays for anim-scale and anim-blur ─────── */
.anim-scale.d1, .anim-blur.d1 { transition-delay: 100ms; }
.anim-scale.d2, .anim-blur.d2 { transition-delay: 200ms; }
.anim-scale.d3, .anim-blur.d3 { transition-delay: 300ms; }
.anim-scale.d4, .anim-blur.d4 { transition-delay: 400ms; }
.anim-scale.d5, .anim-blur.d5 { transition-delay: 500ms; }
.anim-scale.d6, .anim-blur.d6 { transition-delay: 600ms; }
.anim-scale.d7, .anim-blur.d7 { transition-delay: 700ms; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add public/styles/presentation.css src/lib/pipeline/__tests__/presentation-spec.test.ts
git commit -m "fix(css): add missing rules for legend-item, source-item, finding-card variants, anim stagger"
```

---

### Task 2: Fix chart-heavy exemplar — sparkline structure

**Files:**
- Modify: `references/exemplars/chart-heavy.html`
- Test: `src/lib/pipeline/__tests__/presentation-spec.test.ts`

- [ ] **Step 1: Write failing test for correct sparkline structure**

```typescript
describe("chart-heavy exemplar sparkline structure", () => {
  const exemplar = readFileSync(
    resolve(process.cwd(), "references/exemplars/chart-heavy.html"),
    "utf-8"
  );

  it("uses <svg class='sparkline'> not <svg class='sparkline-container'>", () => {
    expect(exemplar).not.toMatch(/svg[^>]*class="sparkline-container"/);
    expect(exemplar).toMatch(/svg[^>]*class="sparkline"/);
  });

  it("wraps sparkline SVG in a sparkline-container div", () => {
    expect(exemplar).toMatch(/class="sparkline-container"[^>]*>/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: FAIL — sparkline still uses `<svg class="sparkline-container">`

- [ ] **Step 3: Fix sparkline structure in chart-heavy.html**

Replace all 3 sparkline instances. Each `<svg class="sparkline-container" viewBox="0 0 80 24" width="80px" height="24px">` becomes:

```html
<div class="sparkline-container"><svg class="sparkline" viewBox="0 0 80 24">
```

And each closing `</svg>` for sparklines gets a `</div>` after it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add references/exemplars/chart-heavy.html src/lib/pipeline/__tests__/presentation-spec.test.ts
git commit -m "fix(exemplar): correct sparkline structure to match CSS selectors"
```

---

### Task 3: Fix chart-heavy exemplar — rewrite bar chart as SVG

**Files:**
- Modify: `references/exemplars/chart-heavy.html`
- Test: `src/lib/pipeline/__tests__/presentation-spec.test.ts`

- [ ] **Step 1: Write failing test for SVG bar chart structure**

```typescript
describe("chart-heavy exemplar bar chart structure", () => {
  const exemplar = readFileSync(
    resolve(process.cwd(), "references/exemplars/chart-heavy.html"),
    "utf-8"
  );

  it("uses <svg class='bar-chart'> not bar-chart-container div", () => {
    expect(exemplar).not.toContain("bar-chart-container");
    expect(exemplar).not.toContain("bar-wrapper");
    expect(exemplar).toMatch(/svg[^>]*class="bar-chart"/);
  });

  it("uses <rect class='bar'> elements inside bar-chart SVG", () => {
    expect(exemplar).toMatch(/rect[^>]*class="bar"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: FAIL — still uses `bar-chart-container`

- [ ] **Step 3: Replace the flexbox bar chart section with SVG**

In `chart-heavy.html`, replace the entire `<!-- Vertical bar chart for category comparison -->` block (lines ~96-125) with:

```html
<!-- Vertical bar chart for category comparison (SVG) -->
<div>
  <h4 style="color:var(--text-secondary);margin-bottom:1rem;">Capability Scores by Domain</h4>
  <svg class="bar-chart" viewBox="0 0 300 200" style="max-width:100%">
    <!-- Bars: y = 180 - (percentage/100 * 160), height = percentage/100 * 160 -->
    <rect class="bar" x="15"  y="32.8"  width="40" height="147.2" fill="var(--chart-1)" rx="4" />
    <rect class="bar" x="75"  y="44"    width="40" height="136"   fill="var(--chart-2)" rx="4" />
    <rect class="bar" x="135" y="55.2"  width="40" height="124.8" fill="var(--chart-3)" rx="4" />
    <rect class="bar" x="195" y="66.4"  width="40" height="113.6" fill="var(--chart-5)" rx="4" />
    <rect class="bar" x="255" y="76"    width="40" height="104"   fill="var(--chart-7)" rx="4" />
    <!-- Value labels above bars -->
    <text x="35"  y="27"  text-anchor="middle" fill="var(--text-secondary)" font-size="10">92%</text>
    <text x="95"  y="38"  text-anchor="middle" fill="var(--text-secondary)" font-size="10">85%</text>
    <text x="155" y="49"  text-anchor="middle" fill="var(--text-secondary)" font-size="10">78%</text>
    <text x="215" y="60"  text-anchor="middle" fill="var(--text-secondary)" font-size="10">71%</text>
    <text x="275" y="70"  text-anchor="middle" fill="var(--text-secondary)" font-size="10">65%</text>
    <!-- Category labels below bars -->
    <text x="35"  y="195" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">Claims</text>
    <text x="95"  y="195" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">Quality</text>
    <text x="155" y="195" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">Risk Adj.</text>
    <text x="215" y="195" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">RWE</text>
    <text x="275" y="195" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">AI/ML</text>
  </svg>
</div>
```

Also update the exemplar header comment to reflect the corrected token names.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add references/exemplars/chart-heavy.html src/lib/pipeline/__tests__/presentation-spec.test.ts
git commit -m "fix(exemplar): rewrite bar chart as SVG rects matching CSS .bar-chart .bar selectors"
```

---

### Task 4: Add component fragment exemplars

**Files:**
- Create: `references/exemplars/fragments/line-chart.html`
- Create: `references/exemplars/fragments/state-grid.html`
- Create: `references/exemplars/fragments/timeline-bar.html`
- Create: `references/exemplars/fragments/quote-block.html`

- [ ] **Step 1: Create fragments directory**

Run: `mkdir -p references/exemplars/fragments`

- [ ] **Step 2: Write line-chart fragment**

```html
<!-- FRAGMENT: Line Chart
     Classes: line-chart, clip-rect, data-points
     Usage: Time series data, trend visualization -->
<svg class="line-chart" viewBox="0 0 400 200" style="max-width:100%">
  <defs>
    <clipPath id="line-reveal">
      <rect class="clip-rect" x="0" y="0" width="0" height="200" />
    </clipPath>
  </defs>
  <polyline points="20,160 80,140 140,100 200,120 260,60 320,80 380,30"
    fill="none" stroke="var(--accent-bright)" stroke-width="2.5"
    clip-path="url(#line-reveal)" />
  <g class="data-points">
    <circle cx="20" cy="160" r="4" fill="var(--accent-bright)" />
    <circle cx="140" cy="100" r="4" fill="var(--accent-bright)" />
    <circle cx="260" cy="60" r="4" fill="var(--accent-bright)" />
    <circle cx="380" cy="30" r="4" fill="var(--accent-bright)" />
  </g>
</svg>
```

- [ ] **Step 3: Write state-grid fragment**

```html
<!-- FRAGMENT: State Grid
     Classes: state-grid, state-item, state-name, state-impact
     Usage: Geographic or entity-level impact display -->
<div class="state-grid">
  <div class="state-item">
    <span class="state-name">California</span>
    <span class="state-impact impact-severe">High Impact</span>
  </div>
  <div class="state-item">
    <span class="state-name">Texas</span>
    <span class="state-impact impact-moderate">Moderate</span>
  </div>
  <div class="state-item">
    <span class="state-name">New York</span>
    <span class="state-impact impact-positive">Low Risk</span>
  </div>
</div>
```

- [ ] **Step 4: Write timeline-bar fragment**

```html
<!-- FRAGMENT: Timeline Bar
     Classes: timeline-bar, timeline-segment, tl-done, tl-active, tl-pending, pipeline-caption
     Usage: Phase/progress visualization -->
<div class="timeline-bar">
  <div class="timeline-segment tl-done" style="width:35%"></div>
  <div class="timeline-segment tl-active" style="width:20%"></div>
  <div class="timeline-segment tl-pending" style="width:45%"></div>
</div>
<div class="pipeline-caption">Phase 1 complete · Phase 2 in progress · Phase 3 pending</div>
```

- [ ] **Step 5: Write quote-block fragment**

```html
<!-- FRAGMENT: Quote Block
     Classes: quote-block, quote-attr
     Usage: Executive quotation or key statement with attribution -->
<blockquote class="quote-block">
  "The convergence of claims data and quality measurement creates a defensible moat that pure-play competitors cannot replicate."
  <span class="quote-attr">— Industry Analyst, Goldman Sachs Healthcare Report (2025)</span>
</blockquote>
```

- [ ] **Step 6: Commit**

```bash
git add references/exemplars/fragments/
git commit -m "feat(exemplars): add component fragments for line-chart, state-grid, timeline-bar, quote-block"
```

---

### Task 5: Recompile presentation spec and run full test suite

**Files:**
- Modify: `references/presentation-system.md` (recompiled output)

- [ ] **Step 1: Recompile the presentation spec**

Run: `npm run spec:compile`
Expected: `references/presentation-system.md` updated with corrected exemplars

- [ ] **Step 2: Run the full presentation spec test suite**

Run: `npx vitest run src/lib/pipeline/__tests__/presentation-spec.test.ts`
Expected: ALL tests pass

- [ ] **Step 3: Verify spec size and exemplar count**

Run: `wc -l references/presentation-system.md && grep -c '### ' references/exemplars/*.html references/exemplars/fragments/*.html`
Expected: Spec is ~1200+ lines, 6 full exemplars + 4 fragments

- [ ] **Step 4: Commit**

```bash
git add references/presentation-system.md
git commit -m "build: recompile presentation spec with fixed exemplars and fragments"
```

---

## Chunk 2: Phase 1 — Types, Chart Compiler, and Validator

Pure TypeScript modules with no LLM dependencies. Fully testable in isolation.

### Task 6: Create presentation pipeline types

**Files:**
- Create: `src/lib/pipeline/present/types.ts`

- [ ] **Step 1: Create the types file with all interfaces**

Create `src/lib/pipeline/present/types.ts` with all the types from the spec:
- `SlideManifest`, `SlideSpec`, `SlideType`, `AnimationType`
- `DataPoint`, `ChartRole`
- `ChartDataMap`, `ChartData`, `DonutChartData`, `DonutSegment`, `BarChartData`, `SparklineData`, `CounterData`, `HorizontalBarData`
- `SlideHTML`
- `SlideGeneratorInput`
- `AssemblerInput`, `AssemblerOutput`
- `QualityScorecard`, `QualityMetrics`, `MetricScore`, `SlideIssue`
- `DesignReviewInput`, `DesignReview`, `SlideReview`
- `RemediationInput`
- `PipelineTimings`

Import shared types from `@/lib/pipeline/types` (SwarmTier, AgentResult, SynthesisResult, Blueprint, AgentFinding). Add Zod schemas for LLM output validation (SlideManifest, DesignReview).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/pipeline/present/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/present/types.ts
git commit -m "feat(present): add presentation pipeline type definitions"
```

---

### Task 7: Build component catalog

**Files:**
- Create: `src/lib/pipeline/present/component-catalog.ts`
- Create: `src/lib/pipeline/__tests__/component-catalog.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { ComponentCatalog } from "../present/component-catalog";

describe("ComponentCatalog", () => {
  const catalog = new ComponentCatalog();

  it("extracts valid CSS class names from presentation.css", () => {
    expect(catalog.validClasses.has("slide")).toBe(true);
    expect(catalog.validClasses.has("donut-chart")).toBe(true);
    expect(catalog.validClasses.has("bar-chart")).toBe(true);
    expect(catalog.validClasses.has("sparkline")).toBe(true);
    expect(catalog.validClasses.has("legend-item")).toBe(true); // added in Phase 0
    expect(catalog.validClasses.has("nonexistent-class")).toBe(false);
  });

  it("has at least 170 valid classes", () => {
    expect(catalog.validClasses.size).toBeGreaterThanOrEqual(170);
  });

  it("returns exemplar HTML for data-metrics slide type", () => {
    const html = catalog.exemplarForSlideType("data-metrics");
    expect(html).toContain("donut-chart");
    expect(html).toContain("bar-chart");
  });

  it("returns exemplar HTML for emergence slide type", () => {
    const html = catalog.exemplarForSlideType("emergence");
    expect(html).toContain("emergent-slide");
    expect(html).toContain("emergence-card");
  });

  it("generates component reference for given classes", () => {
    const ref = catalog.componentReference(["donut-chart", "stat-block", "grid-2"]);
    expect(ref).toContain("donut-chart");
    expect(ref).toContain("stat-block");
    expect(ref).toContain("grid-2");
  });

  it("generates planner system prompt without exemplar HTML", () => {
    const prompt = catalog.plannerSystemPrompt();
    expect(prompt).toContain("donut-chart");
    expect(prompt.length).toBeLessThan(5000); // ~3KB target
    expect(prompt).not.toContain("<section"); // no raw HTML
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/component-catalog.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ComponentCatalog**

Create `src/lib/pipeline/present/component-catalog.ts`:
- Constructor reads `public/styles/presentation.css` and extracts all `.className` selectors into `validClasses: Set<string>` (cached at module level)
- Reads all exemplar files from `references/exemplars/` and `references/exemplars/fragments/`
- `exemplarForSlideType()` implements the routing table from the spec
- `componentReference()` generates a compact markdown reference for the given class names
- `plannerSystemPrompt()` generates a ~3KB component catalog listing all component families, their class names, and when to use each — no exemplar HTML

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/component-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/present/component-catalog.ts src/lib/pipeline/__tests__/component-catalog.test.ts
git commit -m "feat(present): add ComponentCatalog with CSS class extraction and exemplar routing"
```

---

### Task 8: Build chart compiler — donut charts

**Files:**
- Create: `src/lib/pipeline/present/chart-compiler.ts`
- Create: `src/lib/pipeline/__tests__/chart-compiler.test.ts`

- [ ] **Step 1: Write failing tests for donut chart compilation**

```typescript
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
    // 40% of 502.65 = 201.06
    expect(donut.segments[0].dashArray).toBe("201.06 502.65");
    expect(donut.segments[0].dashOffset).toBe("0");
  });

  it("computes correct dashOffset for second segment", () => {
    const result = compileCharts(donutPoints);
    const donut = result.find((c) => c.type === "donut") as DonutChartData;
    // offset = -(201.06) = -201.06
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/chart-compiler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement donut chart compilation**

Create `src/lib/pipeline/present/chart-compiler.ts` with `compileCharts(dataPoints: DataPoint[]): ChartData[]`:
- Groups `DataPoint[]` by `chartRole`
- For `"donut-segment"` points: compute circumference (2 * π * 80 = 502.65), percentages, dashArray, dashOffset, generate SVG fragment with `<svg class="donut-chart">`, `<circle class="segment">` elements, and a `<div class="chart-legend">` with `legend-item` and `legend-dot` elements
- Value sanitization: strip `$`, `~`, `%`, `M`, `B`, `K`; parse ranges as midpoint

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/chart-compiler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/present/chart-compiler.ts src/lib/pipeline/__tests__/chart-compiler.test.ts
git commit -m "feat(present): chart compiler with donut chart SVG generation"
```

---

### Task 9: Chart compiler — bar charts, sparklines, counters, horizontal bars

**Files:**
- Modify: `src/lib/pipeline/present/chart-compiler.ts`
- Modify: `src/lib/pipeline/__tests__/chart-compiler.test.ts`

- [ ] **Step 1: Write failing tests for remaining chart types**

Add test suites for:
- `"bar-value"` → SVG `<svg class="bar-chart">` with `<rect class="bar">` elements
- `"sparkline-point"` → `<div class="sparkline-container"><svg class="sparkline">` with polyline and endpoint dot
- `"counter-target"` → `<span class="stat-number" data-target="N">` with prefix/suffix
- `"bar-fill-percent"` → `<div class="bar-row">` with `bar-track`, `bar-fill`, `bar-fill-value`
- Sanitization tests: `"~$2.4B"` → 2400, `"740-1050"` → 895

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/chart-compiler.test.ts`
Expected: FAIL — new tests fail

- [ ] **Step 3: Implement remaining chart types**

Add cases to `compileCharts()` for each `chartRole`:
- Bar chart: compute SVG rects with viewBox 300x200, y/height from percentages
- Sparkline: linear interpolation to 80x24 viewBox, generate polyline points string
- Counter: format as `<span class="stat-number {colorClass}" data-target="{target}" data-prefix="{prefix}" data-suffix="{suffix}">{formatted}</span>`
- Horizontal bar: generate `bar-row` > `bar-track` > `bar-fill` markup with percentage widths

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/chart-compiler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/present/chart-compiler.ts src/lib/pipeline/__tests__/chart-compiler.test.ts
git commit -m "feat(present): chart compiler with bar, sparkline, counter, horizontal-bar support"
```

---

### Task 10: Build structural validator

**Files:**
- Create: `src/lib/pipeline/present/validator.ts`
- Create: `src/lib/pipeline/__tests__/validator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { validate } from "../present/validator";

const VALID_SLIDE = `<section class="slide" id="s1">
  <div class="slide-bg-glow" style="background:var(--inov-cerulean);top:-200px;right:-200px;"></div>
  <div class="slide-inner">
    <h2 class="slide-title anim d1">Title</h2>
  </div>
  <div class="slide-footer">
    <span>PRISM Intelligence</span>
    <span>Source: PRIMARY</span>
    <span>Slide 1 of 1</span>
  </div>
</section>`;

const FULL_DOC = `<!DOCTYPE html><html><head></head><body>${VALID_SLIDE}</body></html>`;

describe("validator", () => {
  it("returns 100 classNameValidity for valid classes", () => {
    const result = validate(FULL_DOC);
    expect(result.metrics.classNameValidity.score).toBe(100);
  });

  it("flags unknown class names", () => {
    const bad = FULL_DOC.replace('class="slide-title anim d1"', 'class="slide-title bogus-class"');
    const result = validate(bad);
    expect(result.metrics.classNameValidity.score).toBeLessThan(100);
    expect(result.perSlideIssues.some(i => i.message.includes("bogus-class"))).toBe(true);
  });

  it("flags missing slide-footer", () => {
    const noFooter = FULL_DOC.replace(/<div class="slide-footer">[\s\S]*?<\/div>/, "");
    const result = validate(noFooter);
    expect(result.metrics.structuralIntegrity.score).toBeLessThan(100);
  });

  it("computes overall score and grade", () => {
    const result = validate(FULL_DOC);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.grade).toMatch(/^[A-F][+]?$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/validator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validator**

Create `src/lib/pipeline/present/validator.ts`:
- `validate(html: string, slideManifest?: SlideManifest): QualityScorecard`
- Extract CSS classes from `presentation.css` (cached at module level)
- Parse HTML to extract all `class="..."` values per `<section class="slide">`
- Check each class against `validClasses` set
- Check structural integrity: slide-footer, slide-inner, slide-bg-glow per slide
- Check inline style compliance: only allow on slide-bg-glow and grid elements
- Check SVG chart presence on data-metrics slides (if manifest provided)
- Check animation variety: count distinct anim types
- Check counter adoption: data-target attributes vs expected
- Check emergence hierarchy completeness
- Check source attribution in footers
- Compute weighted overall score, assign grade

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/validator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/present/validator.ts src/lib/pipeline/__tests__/validator.test.ts
git commit -m "feat(present): structural validator with CSS class checking and quality scoring"
```

---

## Chunk 3: Phase 2 — Planner, Slide Generator, Assembler, Minimal Orchestrator

These modules involve LLM calls. Tests use mocks for the Anthropic client.

### Task 11: Build assembler

**Files:**
- Create: `src/lib/pipeline/present/assembler.ts`
- Create: `src/lib/pipeline/__tests__/assembler.test.ts`

- [ ] **Step 1: Write failing tests**

Test that the assembler:
- Generates valid HTML5 document structure (DOCTYPE, head, body)
- Includes CSS and JS links in head
- Builds navigation panel from manifest
- Inserts slides with sequential ids (s1, s2, ...)
- Includes progress bar, slide counter, nav hint, PRISM mark
- Returns correct slideCount

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pipeline/__tests__/assembler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement assembler**

Pure string concatenation. Template for document chrome extracted from current generated deck patterns (nav panel, progress bar, etc).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pipeline/__tests__/assembler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/present/assembler.ts src/lib/pipeline/__tests__/assembler.test.ts
git commit -m "feat(present): assembler stitches slide HTML into complete document"
```

---

### Task 12: Build slide planner

**Files:**
- Create: `src/lib/pipeline/present/planner.ts`

- [ ] **Step 1: Implement planner**

- `planSlides(input: PlannerInput): Promise<SlideManifest>`
- Uses `getAnthropicClient()` and `MODELS.PRESENT`
- System prompt from `ComponentCatalog.plannerSystemPrompt()`
- User prompt: structured synthesis data + agent roster + component assignment rules
- Parses JSON response with Zod `SlideManifestSchema`
- 30s AbortController timeout
- On parse failure: retry once with stricter "output valid JSON only" instruction

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/present/planner.ts
git commit -m "feat(present): slide planner decomposes synthesis into SlideManifest"
```

---

### Task 13: Build slide generator

**Files:**
- Create: `src/lib/pipeline/present/slide-generator.ts`

- [ ] **Step 1: Implement slide generator**

- `generateSlide(input: SlideGeneratorInput): Promise<SlideHTML>`
- Uses `getAnthropicClient()` and `MODELS.PRESENT`
- System prompt: exemplar HTML + compact component reference (from ComponentCatalog)
- User prompt: slide spec + chart data fragments + findings + deck context
- max_tokens: 8000
- 45s AbortController timeout
- Extracts HTML from response, wraps in `SlideHTML` with status tracking
- Fallback slide generation: uses SlideSpec metadata to build minimal `<section>` with title, purpose text, and any chart fragments

- [ ] **Step 2: Implement parallel batch execution**

- `generateSlidesBatch(inputs: SlideGeneratorInput[]): Promise<SlideHTML[]>`
- Uses `Promise.allSettled()` for concurrent execution
- Failed slides: retry once individually, then generate fallback
- Tracks success/fallback/failed counts
- If ≥ 30% fail: throws `BatchFailureError` (orchestrator catches and falls back to legacy)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/present/slide-generator.ts
git commit -m "feat(present): parallel slide generator with batch execution and fallback"
```

---

### Task 14: Build minimal orchestrator (happy path)

**Files:**
- Create: `src/lib/pipeline/present-orchestrator.ts`

- [ ] **Step 1: Implement orchestrator happy path**

- `presentOrchestrated(input: PresentInput): Promise<PresentationResult>`
- Stage 1: call planner → SlideManifest
- Stage 2: call chart compiler for each slide's dataPoints → ChartDataMap
- Stage 3: build SlideGeneratorInput[] (map agentSources to findings, attach chart data and exemplars), call generateSlidesBatch in batches of 5
- Stage 4: call assembler → complete HTML
- Stage 5: call validator → QualityScorecard
- (Stages 6-7 deferred to Phase 4)
- Stage 8: return PresentationResult with quality and timings
- Wrap everything in try/catch: on failure, log and call legacy `present()` as fallback

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/present-orchestrator.ts
git commit -m "feat(present): minimal orchestrator with planner → generator → assembler → validator"
```

---

## Chunk 4: Phase 3 — Feature Flag Integration

### Task 15: Wire orchestrator into executor behind feature flag

**Files:**
- Modify: `src/lib/pipeline/executor.ts`
- Modify: `src/lib/pipeline/types.ts`

- [ ] **Step 1: Extend PresentationResult type**

In `src/lib/pipeline/types.ts`, update `PresentationResultSchema` to add optional `quality`, `designReview`, and `timings` fields. Update `PipelineEvent` union with new presentation events from the spec.

- [ ] **Step 2: Add feature flag check in executor**

In `executor.ts`, replace the direct `present()` call with:

```typescript
const useAgentic = process.env.PRISM_AGENTIC_PRESENT === "true";
const presentation = useAgentic
  ? await withRetry(
      () => presentOrchestrated({ synthesis, agentResults, blueprint, emitEvent, memoryBus }),
      { maxRetries: 0, baseDelayMs: 0, label: "PRESENT-AGENTIC" },
    )
  : await withRetry(
      () => present({ synthesis, agentResults, blueprint, emitEvent, memoryBus }),
      { maxRetries: 1, baseDelayMs: 3000, label: "PRESENT" },
    );
```

Import `presentOrchestrated` from `./present-orchestrator`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/executor.ts src/lib/pipeline/types.ts
git commit -m "feat(present): wire orchestrator behind PRISM_AGENTIC_PRESENT feature flag"
```

---

## Chunk 5: Phase 4 — Design Reviewer + Remediation Loop

### Task 16: Build design reviewer

**Files:**
- Create: `src/lib/pipeline/present/design-reviewer.ts`

- [ ] **Step 1: Implement design reviewer**

- `reviewDesign(input: DesignReviewInput): Promise<DesignReview>`
- Uses `getAnthropicClient()` and `MODELS.PRESENT`
- System prompt: component catalog + review criteria (component fit, narrative flow, variety)
- User prompt: assembled HTML + manifest + scorecard summary
- Parses JSON response with Zod `DesignReviewSchema`
- 30s AbortController timeout
- On timeout: return null (orchestrator skips review)

- [ ] **Step 2: Commit**

```bash
git add src/lib/pipeline/present/design-reviewer.ts
git commit -m "feat(present): design reviewer agent for editorial quality assessment"
```

---

### Task 17: Build remediator

**Files:**
- Create: `src/lib/pipeline/present/remediator.ts`

- [ ] **Step 1: Implement remediator**

- `remediateSlides(inputs: RemediationInput[]): Promise<SlideHTML[]>`
- For each failing slide: builds prompt with original HTML + validator issues + reviewer feedback + exemplar + chart data
- Uses parallel LLM calls (same as slide generator)
- Returns revised SlideHTML[] with status tracking

- [ ] **Step 2: Commit**

```bash
git add src/lib/pipeline/present/remediator.ts
git commit -m "feat(present): remediator for targeted slide repair from validator + reviewer feedback"
```

---

### Task 18: Wire QA loop into orchestrator

**Files:**
- Modify: `src/lib/pipeline/present-orchestrator.ts`

- [ ] **Step 1: Add QA loop after Stage 5**

After the validator runs, add:
1. Call design reviewer
2. Collect slides needing remediation (validator errors + reviewer `regenerate: true`)
3. If any slides need remediation AND iteration < 2:
   - Call remediator for failing slides
   - Replace slides in array
   - Re-run assembler
   - Re-run validator
   - Re-run reviewer (only for previously-flagged slides)
   - Check for score regression → revert if worse
4. Track best-scoring version across iterations

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/present-orchestrator.ts
git commit -m "feat(present): integrate QA loop with design reviewer + remediation into orchestrator"
```

---

## Chunk 6: Phase 5 — Telemetry + Finalizer

### Task 19: Add PresentationQuality model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PresentationQuality model and Run relation**

Add the `PresentationQuality` model from the spec. Add `presentationQuality PresentationQuality?` to the `Run` model.

- [ ] **Step 2: Generate Prisma client and push schema**

Run: `npx prisma generate && npx prisma db push`
Expected: Client generated, tables created

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add PresentationQuality model for pipeline telemetry"
```

---

### Task 20: Build finalizer

**Files:**
- Create: `src/lib/pipeline/present/finalizer.ts`

- [ ] **Step 1: Implement finalizer**

Extract post-processing logic from `executor.ts` (lines 364-462) into a standalone module:
- `finalize(html: string, runId: string, quality: QualityScorecard, review?: DesignReview, timings?: PipelineTimings): Promise<string>`
- CSS/JS inlining (read presentation.css and presentation.js, inject as `<style>` and `<script>`)
- Animation state baking (add `.visible`, `.animate`, `.is-visible` to appropriate classes)
- Counter value baking (`stat-number[data-target]`)
- Truncation recovery (close unclosed sections)
- File write to `public/decks/{runId}.html`
- Persist `PresentationQuality` record to database via Prisma

- [ ] **Step 2: Update orchestrator to use finalizer**

Replace the inline post-processing in executor.ts with a call to `finalize()` from the orchestrator's result.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/present/finalizer.ts src/lib/pipeline/present-orchestrator.ts
git commit -m "feat(present): finalizer with CSS/JS inlining, animation baking, and quality telemetry"
```

---

## Chunk 7: Phase 6 — Cleanup

### Task 21: Remove feature flag, update executor

**Files:**
- Modify: `src/lib/pipeline/executor.ts`

- [ ] **Step 1: Make agentic pipeline the default**

Remove the `PRISM_AGENTIC_PRESENT` environment variable check. Make `presentOrchestrated()` the primary call. Keep `present()` import as the fallback (called automatically by orchestrator on catastrophic failure).

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: ALL tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/executor.ts
git commit -m "feat(present): make agentic pipeline the default, preserve legacy as fallback"
```

---

### Task 22: End-to-end verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts without errors, spec auto-compiles via `predev` hook

- [ ] **Step 2: Run a pipeline**

Trigger a STANDARD tier pipeline run via the UI. Monitor SSE events for the new presentation pipeline events (`presentation_planning`, `slide_generation_started`, etc.).

- [ ] **Step 3: Verify generated deck**

Check the output deck for:
- SVG donut chart present (`<svg class="donut-chart">`)
- SVG bar chart present (`<svg class="bar-chart">`)
- Sparklines present (`<svg class="sparkline">`)
- Animated counters (`data-target` attributes)
- Animation variety (`anim-scale` or `anim-blur` used)
- All class names valid (no unknown classes)
- Quality grade ≥ C in telemetry

- [ ] **Step 4: Check quality telemetry**

Query the database: `SELECT * FROM "PresentationQuality" ORDER BY "createdAt" DESC LIMIT 1;`
Expected: Record with `overall >= 70`, `classNameValidity = 100`, `grade` of C or better
