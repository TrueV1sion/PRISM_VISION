# Agentic Presentation Pipeline Design

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Decompose monolithic presentation generation into an agentic orchestration pipeline with per-slide generation, chart data compilation, structural validation, design review, and quality telemetry.

## Problem

The current presentation pipeline (`present.ts`) generates complete HTML5 decks in a single LLM call. A 52KB system prompt (the compiled design system spec) is sent alongside all synthesis data, and the LLM must simultaneously:

1. Make editorial judgments (what to emphasize, what to merge)
2. Select components from 176 CSS classes
3. Extract quantitative data from prose findings
4. Compute SVG geometry (dasharray offsets, polyline coordinates)
5. Generate 1,400+ lines of HTML

This produces decks that use ~70% of available components. Critical gaps:

| Component family | CSS defined | Generated | Root cause |
|---|---|---|---|
| SVG donut charts | `.donut-chart`, `.segment` | 0 instances | SVG math too complex in single pass |
| SVG bar charts | `.bar-chart`, `.bar` | 0 instances | Exemplar uses wrong class names |
| SVG sparklines | `.sparkline`, `.sparkline-line` | 0 instances | Exemplar SVG has wrong class |
| Animated counters | `.stat-number[data-target]` | 0 instances | LLM defaults to static text |
| Line charts | `.line-chart`, `.clip-rect` | 0 instances | No exemplar at all |
| Card color variants | `.card-blue` through `.card-cyan` | 0 instances | No exemplar, only prose |
| State grids | `.state-grid`, `.state-item` | 0 instances | No exemplar |
| Animation variety | `.anim-scale`, `.anim-blur` | 2 of ~200 anim uses | Exemplars only show `.anim` |

Additional discovered issues:
- The `chart-heavy.html` exemplar uses class names that don't exist in the CSS (`bar-chart-container`, `bar-wrapper`, `bar-value`), so even perfect exemplar copying produces broken animations.
- The JS intersection observer targets `.bar-chart`, `.sparkline`, `.donut-chart`, `.line-chart` — the exemplar teaches different names for 2 of these 4.
- Design token values in `design-tokens.yaml` have drifted from `presentation.css` actual values.
- Two competing stat systems exist (`.stat-block` in exemplars vs `.stat-card` in CSS) with no clear guidance on which to use when.

## Architecture

The monolithic `present()` function is replaced by an orchestrated pipeline of focused agents and code modules. Each stage has a single responsibility and a well-defined interface.

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Orchestrator                 │
│                    (replaces present.ts)                     │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  1. Slide Planner   │  LLM call (~3KB system prompt)
│     (plan)          │  → SlideManifest
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. Chart Compiler  │  Pure TypeScript (no LLM)
│     (compute)       │  → ChartDataMap
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Slide Generators (parallel LLM calls, 3-5 concurrent)  │
│     Each gets: slide spec + relevant exemplar + chart data  │
│     System prompt: ~2-5KB per slide (not 52KB)              │
│     → SlideHTML[]                                           │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│  4. Assembler → 5. Validator → 6. Design Reviewer   │
│     ↑                                                │
│     │         7. Remediation Loop (max 2 rounds)     │
│     └────────────── if failing slides ───────────────┘
│
└─────────┬────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  8. Finalizer       │  Pure TypeScript
│     (post-process)  │  → File write + telemetry
└─────────────────────┘
```

### Quality Assurance Loop (Stages 4-7)

Stages 4-7 form a closed loop, not a linear pipeline:

1. **Assembler** stitches slides into a complete document
2. **Validator** scores the assembled HTML against the design system
3. **Design Reviewer** evaluates editorial quality (always runs — see below)
4. If any slides have errors or `regenerate: true` → **Remediation** regenerates those slides, then control returns to the Assembler for re-stitching and re-validation

The loop exits when: (a) all slides pass validation and review, (b) max iterations (2) reached, or (c) no improvement between iterations (keep best version).

The **Design Reviewer always runs** after the validator, regardless of validator score. Low-scoring decks benefit from editorial guidance alongside structural fixes — the remediation stage receives both validator issues and reviewer feedback simultaneously, so it can fix structural problems and improve component choices in a single pass.

### Stage 1: Slide Planner

**Type:** LLM call (fast, small prompt)
**Model:** Sonnet (MODELS.PRESENT)
**System prompt:** ~3KB component catalog — class names, their purposes, and when to use each. No exemplar HTML, no full spec.

**Input:**
```typescript
// SwarmTier, AgentResult, SynthesisResult, Blueprint imported from "@/lib/pipeline/types"
interface PlannerInput {
  query: string;
  tier: SwarmTier;
  agentResults: AgentResult[];
  synthesis: SynthesisResult;
  blueprint: Blueprint;
}
```

**Output:**
```typescript
interface SlideManifest {
  slides: SlideSpec[];
  narrativeArc: string;       // e.g., "problem → landscape → deep-dives → emergence → action"
  deckTitle: string;
  deckSubtitle: string;
}

interface SlideSpec {
  slideNumber: number;
  slideType: SlideType;
  title: string;
  purpose: string;             // editorial intent: "Show revenue breakdown by segment"
  dataPoints: DataPoint[];     // extracted from findings
  components: string[];        // explicit class assignments: ["donut-chart", "stat-block", "grid-2"]
  animationStyle: AnimationType;
  agentSources: string[];      // which agents' findings feed this slide
  sourceAttribution: string;   // footer source text
}

type SlideType =
  | "title"
  | "toc"
  | "executive-summary"
  | "data-metrics"
  | "findings-detail"
  | "comparison"
  | "emergence"
  | "tension"
  | "timeline"
  | "provenance"
  | "closing";

type AnimationType = "anim" | "anim-scale" | "anim-blur";

interface DataPoint {
  label: string;
  value: number;
  unit: string;              // "%", "M", "B", "x", ""
  context?: string;          // "YoY growth", "vs. competitor"
  chartRole?: ChartRole;     // how this data should be visualized
}

type ChartRole =
  | "donut-segment"          // part-of-whole
  | "bar-value"              // category comparison
  | "sparkline-point"        // trend over time
  | "counter-target"         // animated number
  | "bar-fill-percent"       // horizontal comparison
  | "timeline-event";        // temporal marker
```

The planner's job is decomposition, not generation. It decides *what* goes on each slide and *which components* to use. It explicitly assigns `AnimationType` per slide to ensure variety across the deck.

**Component assignment rules** (encoded in planner system prompt):
- Quantitative data with parts-of-whole → `donut-chart`
- Category comparisons (3-7 items) → `bar-chart` (vertical SVG) or `bar-row`/`bar-fill` (horizontal CSS)
- Time series or trends → `sparkline` inline or `line-chart` standalone
- Hero KPIs → `stat-block` with `stat-number[data-target]`
- Cross-agent insights → full emergence hierarchy
- Opposing positions → `finding-card.risk` + `finding-card.opportunity` in `grid-2`
- Agent capabilities/status → `threat-meter`
- Geographic/entity impact → `state-grid`

### Stage 2: Chart Data Compiler

**Type:** Pure TypeScript (no LLM call)

Takes `DataPoint[]` from each slide spec and computes chart-ready data structures. The LLM never does math.

```typescript
interface ChartDataMap {
  [slideNumber: number]: ChartData[];
}

type ChartData =
  | DonutChartData
  | BarChartData
  | SparklineData
  | CounterData
  | HorizontalBarData;

interface DonutChartData {
  type: "donut";
  radius: number;                    // default 80
  circumference: number;             // 2 * π * radius (502.65 for r=80)
  segments: DonutSegment[];
  svgFragment: string;               // ready-to-paste <svg> markup
}

interface DonutSegment {
  label: string;
  value: number;
  percentage: number;
  color: string;                     // CSS variable: "var(--chart-1)"
  dashArray: string;                 // computed: "201.06 502.65"
  dashOffset: string;                // computed: "-201.06"
}

interface BarChartData {
  type: "bar-chart";
  bars: { label: string; value: number; height: string; color: string }[];
  svgFragment: string;               // ready-to-paste markup
}

interface SparklineData {
  type: "sparkline";
  points: string;                    // polyline points attribute: "2,20 15,16 28,18..."
  endPoint: { cx: number; cy: number };
  color: string;
  svgFragment: string;               // ready-to-paste <svg> markup
}

interface CounterData {
  type: "counter";
  target: number;
  prefix: string;
  suffix: string;
  colorClass: string;                // "cyan", "green", "positive"
  htmlFragment: string;              // ready-to-paste <span> markup
}

interface HorizontalBarData {
  type: "horizontal-bar";
  rows: { label: string; value: number; width: string }[];
  htmlFragment: string;              // ready-to-paste markup
}
```

**Key design choice:** Each `ChartData` includes a `svgFragment` or `htmlFragment` — pre-built markup that the slide generator can paste directly. The generator only needs to decide *where* to place it, not *how* to build it. This eliminates the SVG math barrier entirely.

**Chart color assignment:** Uses CSS variables `--chart-1` through `--chart-8` in order, cycling if more segments are needed. These variables are defined in `presentation.css` and map to the Inovalon brand palette.

**Sparkline coordinate generation:** Given N data points, maps values to a 80x24 viewBox using linear interpolation:
```
x_i = 2 + (i / (N-1)) * 76
y_i = 22 - (value_i / max_value) * 18
```

**Donut chart CSS interaction:** The CSS sets an initial `stroke-dashoffset: 502.65` on `.donut-chart .segment` and animates to the HTML-attribute value on `.is-visible`. The chart compiler computes `dashOffset` as the cumulative negative offset for segment positioning in the ring (e.g., `-201.06` for the second segment). The CSS `nth-child` selectors add staggered `transition-delay` for visual sequencing. The compiler's generated `svgFragment` must set both `stroke-dasharray` and `stroke-dashoffset` as HTML attributes on each `<circle class="segment">` — the CSS animation transitions *to* these values from the initial 502.65.

**Chart data sanitization:** The planner extracts `DataPoint.value` as a number, but LLM JSON output may contain strings like `"~$2.4B"` or `"740-1050"`. The chart compiler applies sanitization before computing: strip `$`, `~`, `%`, `M`, `B`, `K` suffixes; for ranges like `"740-1050"`, use the midpoint; for unparseable values, log a warning and skip that data point (do not skip the entire chart).

### Stage 3: Slide Generators

**Type:** Parallel LLM calls (3-5 concurrent)
**Model:** Sonnet (MODELS.PRESENT)
**System prompt:** 2-5KB per slide — only the exemplar(s) relevant to that slide type, plus a compact component reference for assigned components.

Each slide generator receives:

```typescript
interface SlideGeneratorInput {
  slideSpec: SlideSpec;              // from planner
  chartData: ChartData[];           // pre-computed fragments
  exemplarHtml: string;             // relevant exemplar(s) — 1-2 per slide type
  componentReference: string;       // CSS class reference for assigned components only
  deckContext: {
    totalSlides: number;
    deckTitle: string;
    brandingText: string;
    slideNumberFormatted: string;    // "07 / 18"
  };
  findingsForSlide: AgentFinding[]; // only findings relevant to this slide
}
```

**Exemplar routing:**

| SlideType | Exemplar(s) sent |
|---|---|
| `title` | `hero-title.html` |
| `toc` | (compact inline reference) |
| `executive-summary` | `findings.html` |
| `data-metrics` | `chart-heavy.html` + `data-heavy.html` |
| `findings-detail` | `findings.html` + `data-heavy.html` |
| `comparison` | `data-heavy.html` + `tension.html` |
| `emergence` | `emergence.html` |
| `tension` | `tension.html` |
| `timeline` | (compact inline reference) |
| `provenance` | (compact inline reference) |
| `closing` | `hero-title.html` (adapted) |

**Output:**
```typescript
interface SlideHTML {
  slideNumber: number;
  slideType: SlideType;
  html: string;                      // raw <section class="slide">...</section> HTML
  tokensUsed: number;
  generationTimeMs: number;
  status: "success" | "fallback" | "failed";
}
```

Raw HTML for a single `<section class="slide">` element. No `<!DOCTYPE>`, no `<head>`, no navigation chrome — just the slide content.

**Finding routing:** The orchestrator maps `SlideSpec.agentSources` to actual `AgentFinding[]` objects before passing to each generator. This is a simple filter:
```typescript
const findingsForSlide = agentResults
  .filter(ar => slideSpec.agentSources.includes(ar.agentName))
  .flatMap(ar => ar.findings);
```

**`max_tokens` per slide:** 8,000 tokens (a single slide is typically 50-120 lines / 1,500-4,000 tokens). This provides headroom for complex chart slides while preventing runaway generation.

**Timeout:** Each slide generator call has a 45-second `AbortController` timeout. If exceeded, the slide is marked `status: "failed"` and enters remediation.

**Parallelization strategy:** Group slides into batches of 3-5 concurrent calls. For an 18-slide deck:
- Batch 1: slides 1-5 (title, toc, exec summary, first data slides)
- Batch 2: slides 6-10
- Batch 3: slides 11-15
- Batch 4: slides 16-18

Each batch runs concurrently. Total generation time drops from ~60s (single pass) to ~15-20s (4 batches).

**Partial batch failure handling:**
- If a slide generator fails (timeout, non-HTML output, or error), it is retried once individually (not as part of the batch).
- If the retry fails, a minimal fallback slide is generated from the `SlideSpec` metadata: title, purpose text, and any pre-computed chart fragments, wrapped in the standard slide skeleton.
- If < 30% of slides fail after retry: proceed with fallback slides, flag them for remediation.
- If ≥ 30% of slides fail after retry: abandon the agentic pipeline, fallback to legacy `present()`.
- The `SlideHTML.status` field tracks whether each slide was generated normally (`"success"`), from the fallback template (`"fallback"`), or could not be generated at all (`"failed"`).

### Stage 4: Assembler

**Type:** Pure TypeScript

Stitches individual slide HTML into a complete document:

```typescript
interface AssemblerInput {
  slides: SlideHTML[];               // ordered slide sections
  manifest: SlideManifest;          // from planner
}

interface AssemblerOutput {
  html: string;                     // complete HTML5 document
  slideCount: number;
}
```

Responsibilities:
1. Generate `<!DOCTYPE html>` wrapper with `<head>` (charset, viewport, title, CSS link, JS script)
2. Generate navigation chrome: progress bar, slide counter, nav hint, PRISM mark
3. Build navigation panel from manifest (slide titles, grouping, nav tags)
4. Insert slides in order, assigning sequential `id="s1"` through `id="sN"`
5. Close document

The assembler is deterministic code — no LLM involved.

### Stage 5: Structural Validator

**Type:** Pure TypeScript
**Runs on:** Assembled HTML

Produces a `QualityScorecard` by analyzing the HTML against the design system.

```typescript
interface QualityScorecard {
  overall: number;                   // 0-100 weighted score
  grade: string;                     // A+ through F
  metrics: QualityMetrics;
  perSlideIssues: SlideIssue[];
  passesThreshold: boolean;          // overall >= 70
}

interface QualityMetrics {
  componentDiversity: MetricScore;   // unique component families / available families
  chartCoverage: MetricScore;        // SVG charts present when quantitative data exists
  animationVariety: MetricScore;     // distinct animation types used
  counterAdoption: MetricScore;      // data-target count vs quantitative data points
  emergenceFidelity: MetricScore;    // full hierarchy when emergence slides exist
  sourceAttribution: MetricScore;    // slides with footer citations / total
  classNameValidity: MetricScore;    // all classes exist in CSS
  structuralIntegrity: MetricScore;  // required elements present (footer, inner, bg-glow)
  inlineStyleCompliance: MetricScore; // no unauthorized inline styles
}

interface MetricScore {
  score: number;                     // 0-100
  weight: number;                    // contribution to overall score
  details: string;                   // human-readable explanation
  issues: string[];                  // specific failures
}

interface SlideIssue {
  slideNumber: number;
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  suggestedFix?: string;
}
```

**Validation rules:**

| Rule | Category | Severity | Check |
|---|---|---|---|
| Unknown class name | `classNameValidity` | error | Every class attribute value verified against CSS selector list |
| Missing slide-footer | `structuralIntegrity` | error | `<div class="slide-footer">` present in every `<section class="slide">` |
| Missing slide-inner | `structuralIntegrity` | error | `<div class="slide-inner">` present |
| Missing slide-bg-glow | `structuralIntegrity` | warning | `<div class="slide-bg-glow">` present |
| Unauthorized inline style | `inlineStyleCompliance` | warning | Only `slide-bg-glow` background/position and grid sizing allowed |
| No SVG chart on data slide | `chartCoverage` | warning | Slides with `SlideType` `data-metrics` must have ≥1 SVG |
| No animation variety | `animationVariety` | warning | Deck uses only `.anim` without `.anim-scale` or `.anim-blur` |
| Missing data-target | `counterAdoption` | warning | Quantitative `DataPoint` with `chartRole: "counter-target"` has no corresponding `stat-number[data-target]` |
| Emergence hierarchy incomplete | `emergenceFidelity` | error | Emergence slides missing any of: `emergent-slide`, `emergent-number`, `emergent-content`, `emergence-card`, `emergent-why` |
| No stagger variety | `animationVariety` | info | All slides use same stagger range (e.g., only d1-d3) |
| Malformed SVG | `structuralIntegrity` | error | SVG elements have required attributes (viewBox, cx, cy, r for circles) |

**CSS selector extraction:** The validator reads `public/styles/presentation.css` and extracts all class selectors into a `Set<string>`, cached at module level (same pattern as `cachedSpec` in `present.ts`). This is the authority — no hardcoded allowlist. In serverless/cold-start environments, the cache is rebuilt per process but avoids re-reading the file on every validation call within a process lifetime.

**Score weights:**

| Metric | Weight |
|---|---|
| classNameValidity | 20 |
| structuralIntegrity | 20 |
| chartCoverage | 15 |
| componentDiversity | 15 |
| emergenceFidelity | 10 |
| animationVariety | 5 |
| counterAdoption | 5 |
| sourceAttribution | 5 |
| inlineStyleCompliance | 5 |

**Grade mapping:** A+ ≥ 95, A ≥ 90, B+ ≥ 85, B ≥ 80, C+ ≥ 75, C ≥ 70, D ≥ 60, F < 60.

### Stage 6: Design Review Agent

**Type:** LLM call (always runs after validator)
**Model:** Sonnet
**Timeout:** 30 seconds via `AbortController`

The design reviewer always runs after the validator, regardless of score. Low-scoring decks benefit from editorial feedback alongside structural fixes — the remediation stage receives both validator issues and reviewer suggestions, enabling combined structural + editorial fixes in a single pass.

```typescript
interface DesignReviewInput {
  html: string;                      // assembled HTML
  manifest: SlideManifest;           // planner's intent
  scorecard: QualityScorecard;       // validator results
  componentCatalog: string;          // condensed component reference
}

interface DesignReview {
  overallScore: number;              // 1-10
  slideReviews: SlideReview[];
  strengths: string[];
  improvementAreas: string[];
}

interface SlideReview {
  slideNumber: number;
  score: number;                     // 1-10
  componentFit: string;             // "donut chart is correct for revenue breakdown"
  narrativeFlow: string;            // "transition from slide 6 to 7 is abrupt"
  suggestedChanges: string[];       // actionable, specific changes
  regenerate: boolean;              // whether this slide should be re-generated
}
```

The reviewer's system prompt emphasizes:
- Does each slide use the *right* component for its data type?
- Does the narrative arc flow logically?
- Are there redundant slides that should be merged?
- Are there data-heavy slides that should be split?
- Is component variety sufficient across the deck?

### Stage 7: Remediation Loop

**Type:** Parallel LLM calls (conditional)
**Trigger:** Any slide flagged by validator (severity: error) OR reviewer (`regenerate: true`)
**Max iterations:** 2

For each failing slide:

```typescript
interface RemediationInput {
  originalSlideHtml: string;
  slideSpec: SlideSpec;
  chartData: ChartData[];
  validatorIssues: SlideIssue[];     // structural problems
  reviewerFeedback?: SlideReview;    // editorial feedback
  exemplarHtml: string;
  componentReference: string;
}
```

The remediation prompt includes the specific errors and reviewer feedback, so the LLM knows exactly what to fix.

**Loop control flow:**
1. Remediation generates revised `SlideHTML[]` for failing slides
2. Revised slides replace originals in the slide array
3. Control returns to Stage 4 (Assembler) — re-stitch the document
4. Stage 5 (Validator) re-scores the assembled HTML
5. Stage 6 (Design Reviewer) re-evaluates (only for previously-flagged slides to reduce cost)
6. If issues remain AND iteration < 2, go to step 1
7. If issues remain AND iteration ≥ 2, keep best-scoring version, log failures, proceed to Finalizer

**Best-version tracking:** The orchestrator stores each iteration's `QualityScorecard.overall` score. If a remediation round produces a *lower* score than the previous round (regression), it reverts to the previous version and exits the loop.

The telemetry records iteration count, slides remediated, and whether the loop improved or regressed — this feeds system-level learning about which component types consistently fail.

### Stage 8: Finalizer

**Type:** Pure TypeScript

Performs post-processing (migrated from current executor.ts):

1. **CSS/JS inlining** — read `presentation.css` and `presentation.js`, inline as `<style>` and `<script>` for standalone portability
2. **Animation state baking** — add `.visible` to `.anim`/`.anim-scale`/`.anim-blur`, add `.animate` to `.bar-fill`, add `.is-visible` to chart containers
3. **Counter value baking** — replace `stat-number[data-target]` text with formatted target values
4. **File write** — save to `public/decks/{runId}.html`
5. **Quality telemetry** — persist scorecard + review to database

## Data Model Changes

Add a `PresentationQuality` model to track quality metrics per run:

```prisma
model PresentationQuality {
  id                   String   @id @default(cuid())
  overall              Int                          // 0-100
  grade                String                       // A+ through F
  componentDiversity   Int      @default(0)         // 0-100
  chartCoverage        Int      @default(0)         // 0-100
  animationVariety     Int      @default(0)         // 0-100
  counterAdoption      Int      @default(0)         // 0-100
  emergenceFidelity    Int      @default(0)         // 0-100
  sourceAttribution    Int      @default(0)         // 0-100
  classNameValidity    Int      @default(0)         // 0-100
  structuralIntegrity  Int      @default(0)         // 0-100
  inlineStyleCompliance Int     @default(0)         // 0-100
  designReviewScore    Int?                         // 1-10 from LLM reviewer
  remediationRounds    Int      @default(0)         // 0-2
  slidesRemediated     Int      @default(0)
  totalSlides          Int      @default(0)
  generationTimeMs     Int      @default(0)         // total pipeline time
  plannerTimeMs        Int      @default(0)
  generatorTimeMs      Int      @default(0)         // parallel slide generation
  validatorTimeMs      Int      @default(0)
  reviewerTimeMs       Int?
  issueCount           Int      @default(0)
  issues               String   @default("[]")      // JSON array of SlideIssue
  createdAt            DateTime @default(now())

  runId String @unique
  run   Run    @relation(fields: [runId], references: [id], onDelete: Cascade)
}
```

Update the `Run` model to add the relation:

```prisma
model Run {
  // ... existing fields ...
  presentationQuality PresentationQuality?
}
```

Update `PresentationResult` type to include quality data. The new fields are optional to maintain backward compatibility during the feature-flag period (Phase 3-6) — legacy `present()` returns the base 4 fields, the orchestrator returns all fields:

```typescript
interface PresentationResult {
  html: string;
  title: string;
  subtitle: string;
  slideCount: number;
  quality?: QualityScorecard;        // new — present when agentic pipeline is used
  designReview?: DesignReview;       // new — present when design reviewer runs
  timings?: PipelineTimings;         // new — present when agentic pipeline is used
}

interface PipelineTimings {
  plannerMs: number;
  chartCompilerMs: number;
  generatorMs: number;
  assemblerMs: number;
  validatorMs: number;
  reviewerMs?: number;
  remediationMs?: number;
  totalMs: number;
}
```

Downstream consumers (`executor.ts`, API routes, `IntelligenceManifest`) check for the presence of `quality` to determine which pipeline produced the result. The Zod schema `PresentationResultSchema` in `types.ts` is updated with `.optional()` on the new fields.

## Prerequisite: Fix Exemplar + CSS Alignment (Phase 0)

Before implementing the pipeline, the `chart-heavy.html` exemplar and `presentation.css` must be reconciled. This is a blocking prerequisite — the new pipeline will route this exemplar to data-metrics slides, and broken class names would propagate.

### Sparkline fix

| Current (broken) | Correct |
|---|---|
| `<svg class="sparkline-container" viewBox="0 0 80 24">` | `<div class="sparkline-container"><svg class="sparkline" viewBox="0 0 80 24">` |

The CSS `.sparkline.is-visible .sparkline-line` targets the SVG element with class `sparkline`. The `sparkline-container` div provides the 80x24px inline-block sizing. The `viewBox`, `width`, and `height` attributes stay on the `<svg>`.

### Bar chart fix — rewrite as SVG

The current exemplar bar chart uses CSS flexbox with inline styles (`display:flex; height:92%`), but the CSS `.bar-chart .bar` rules use `transform: scaleY(0)` → `scaleY(1)` animation triggered by `.is-visible`. These two approaches are incompatible — a flexbox bar with inline `height` and an SVG bar with `scaleY` animation cannot coexist on the same element.

**Resolution:** Rewrite the exemplar's vertical bar chart section to use actual SVG `<rect>` elements inside `<svg class="bar-chart">`. The chart compiler will generate these SVG fragments, so the exemplar only needs to demonstrate the correct structure:

```html
<svg class="bar-chart" viewBox="0 0 300 180" style="max-width:100%">
  <rect class="bar" x="20" y="14" width="40" height="166" fill="var(--chart-1)" rx="4" />
  <rect class="bar" x="80" y="27" width="40" height="153" fill="var(--chart-2)" rx="4" />
  <!-- ... more bars ... -->
  <text x="40" y="12" text-anchor="middle" fill="var(--text-secondary)" font-size="10">92%</text>
  <text x="40" y="192" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">Claims</text>
</svg>
```

Remove `.bar-chart-container`, `.bar-wrapper`, and `.bar-value` from the exemplar entirely — they have no CSS rules and the SVG approach doesn't need them.

### Legend markup

The donut chart legend uses `.chart-legend > .legend-item > .legend-dot`. The CSS defines `.chart-legend` and `.legend-dot` but not `.legend-item`. Add to `presentation.css`:

```css
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
```

The chart compiler should include legend HTML in its `DonutChartData.svgFragment` (both the `<svg>` and the adjacent `.chart-legend` div), so the slide generator receives a complete chart+legend block ready to paste.

### Other missing CSS rules

Add to `presentation.css`:

```css
.source-item { display: inline; font-size: 11px; color: var(--text-secondary); }
.finding-card.caution { border-left-color: var(--accent-warning); }
.finding-card.regulatory { border-left-color: var(--accent-error); }
```

### Animation stagger for `.anim-scale` and `.anim-blur`

The CSS defines stagger delays (`.d1` through `.d7`) only for `.anim`. The spec assigns `AnimationType` per slide for variety, but `.anim-scale.d3` has no CSS rule — the delay won't apply. Add to `presentation.css`:

```css
.anim-scale.d1, .anim-blur.d1 { transition-delay: 100ms; }
.anim-scale.d2, .anim-blur.d2 { transition-delay: 200ms; }
.anim-scale.d3, .anim-blur.d3 { transition-delay: 300ms; }
.anim-scale.d4, .anim-blur.d4 { transition-delay: 400ms; }
.anim-scale.d5, .anim-blur.d5 { transition-delay: 500ms; }
.anim-scale.d6, .anim-blur.d6 { transition-delay: 600ms; }
.anim-scale.d7, .anim-blur.d7 { transition-delay: 700ms; }
```

### Design token reconciliation

The `design-tokens.yaml` values have drifted from `presentation.css`. CSS is the rendering authority. Update the YAML to match CSS actual values, or (if YAML represents intentional APCA-corrected values) update the CSS to match YAML. Decide in Phase 0 — do not leave both files with conflicting values.

### Card color variants

The CSS defines `.card-blue` through `.card-cyan` as `border-left` modifiers, but there is no base `.card` class — only `.finding-card`, `.stat-card`, etc. These modifiers are meant to be composed with `.finding-card`: e.g., `class="finding-card card-blue"`. Document this in the component catalog and add a new exemplar fragment demonstrating the composition. Alternatively, rename them to `.finding-card-blue` etc. — decide in Phase 0.

### New exemplar fragments needed

The following component families have CSS rules but no exemplar coverage. Add compact exemplar fragments (not full slide exemplars — just the component markup):

- **Line chart** (`line-chart`, `clip-rect`, `data-points`): SVG line chart with clip-rect reveal animation
- **State grid** (`state-grid`, `state-item`, `state-name`, `state-impact`): geographic/entity impact grid
- **Timeline bar** (`timeline-bar`, `timeline-segment`, `tl-done`, `tl-active`, `tl-pending`): segmented progress bar
- **Quote block** (`quote-block`, `quote-attr`): styled quotation

These can be appended as a "Component Fragments" section at the end of the exemplars directory, or inlined into the component catalog's reference output.

## Pipeline Events

New SSE events for the agentic pipeline (extend `PipelineEvent` union):

```typescript
| { type: "presentation_planning"; slideCount: number }
| { type: "presentation_plan_complete"; manifest: SlideManifest }
| { type: "chart_compilation_complete"; chartCount: number }
| { type: "slide_generation_started"; slideNumber: number; slideType: string }
| { type: "slide_generation_complete"; slideNumber: number; tokensUsed: number }
| { type: "presentation_assembly_complete"; slideCount: number }
| { type: "presentation_validation"; scorecard: QualityScorecard }
| { type: "presentation_design_review"; review: DesignReview }
| { type: "slide_remediation_started"; slideNumber: number; issues: string[] }
| { type: "slide_remediation_complete"; slideNumber: number; improved: boolean }
| { type: "presentation_quality_final"; overall: number; grade: string }
```

## Error Handling

| Failure | Recovery |
|---|---|
| Planner returns invalid JSON | Retry once with stricter prompt; fallback to legacy single-pass |
| Planner timeout (> 30s) | Fallback to legacy single-pass |
| Chart compiler gets string values | Sanitize: strip units, parse floats (e.g., `"~$2.4B"` → `2400`); skip chart only if unparseable |
| Slide generator exceeds max_tokens | Truncation recovery (close open tags), flag for remediation |
| Slide generator returns non-HTML | Retry once; if still fails, generate minimal fallback slide |
| Slide generator timeout (> 45s) | Mark as failed, generate fallback slide |
| < 30% of slides fail | Proceed with fallback slides, flag for remediation |
| ≥ 30% of slides fail | Abandon agentic pipeline, fallback to legacy single-pass |
| Validator score < 40 | Abandon agentic pipeline, fallback to legacy single-pass |
| Design reviewer timeout (> 30s) | Skip review, proceed with validator-only quality gate |
| Remediation regresses score | Revert to previous version, exit loop |
| Remediation fails after 2 rounds | Keep best-scoring version, log failure, proceed |
| All slide generators fail | Fallback to legacy single-pass `present()` |

The legacy `present()` function is preserved as a fallback. The orchestrator catches catastrophic failures and degrades gracefully rather than failing the entire pipeline run.

## File Structure

```
src/lib/pipeline/
├── present.ts                    # preserved as legacy fallback
├── present-orchestrator.ts       # new: top-level orchestrator
├── present/
│   ├── planner.ts                # Stage 1: slide planning
│   ├── chart-compiler.ts         # Stage 2: SVG/chart data computation
│   ├── slide-generator.ts        # Stage 3: per-slide HTML generation
│   ├── assembler.ts              # Stage 4: document assembly
│   ├── validator.ts              # Stage 5: structural validation
│   ├── design-reviewer.ts        # Stage 6: editorial review
│   ├── remediator.ts             # Stage 7: targeted slide repair
│   ├── finalizer.ts              # Stage 8: post-processing + file write
│   ├── types.ts                  # all presentation pipeline types
│   └── component-catalog.ts      # CSS class registry + exemplar routing
└── executor.ts                   # updated: calls orchestrator instead of present()
```

## Component Catalog

A new module that serves as the single source of truth for component knowledge:

```typescript
interface ComponentCatalog {
  // All valid CSS class names (extracted from presentation.css at build time)
  validClasses: Set<string>;

  // Exemplar content keyed by slide type
  exemplarForSlideType(type: SlideType): string;

  // Compact component reference for a set of assigned classes
  componentReference(classes: string[]): string;

  // Planner system prompt (component catalog without exemplar HTML)
  plannerSystemPrompt(): string;
}
```

The catalog reads `presentation.css` to build `validClasses` (no hardcoded allowlist), reads exemplar files from `references/exemplars/`, and generates focused prompts per slide type. This ensures the pipeline automatically picks up CSS changes without code updates.

## Migration Path

1. **Phase 0:** Fix exemplar naming + add missing CSS rules + add stagger CSS for anim-scale/anim-blur + reconcile design tokens (blocking prerequisite for all subsequent phases)
2. **Phase 1:** Build chart compiler + validator as standalone modules (testable in isolation). **Depends on Phase 0** — the validator reads CSS class names, so CSS changes must be merged first.
3. **Phase 2:** Build planner + slide generator + assembler + minimal orchestrator (happy path only — no validation/review/remediation). This allows end-to-end testing of the generation pipeline.
4. **Phase 3:** Wire full orchestrator with validator integration into `executor.ts` behind a feature flag. **Feature flag:** environment variable `PRISM_AGENTIC_PRESENT=true` (default: `false`). The executor checks this flag and calls either the orchestrator or legacy `present()`.
5. **Phase 4:** Build design reviewer + remediation loop, integrate into orchestrator
6. **Phase 5:** Add `PresentationQuality` model, telemetry persistence, quality metrics in UI
7. **Phase 6:** Remove feature flag, deprecate legacy `present()`

Each phase is independently deployable and testable. The feature flag in Phase 3 allows A/B comparison between legacy and agentic pipelines.

## Performance Budget

| Stage | Target time | Constraint |
|---|---|---|
| Planner | < 5s | Single small LLM call |
| Chart Compiler | < 100ms | Pure computation |
| Slide Generators | < 20s | 4 batches of 3-5 parallel calls |
| Assembler | < 50ms | String concatenation |
| Validator | < 200ms | HTML parsing + set lookups |
| Design Reviewer | < 10s | Single LLM call (optional) |
| Remediation (per round) | < 15s | Parallel calls for failing slides only |
| **Total (happy path)** | **< 30s** | vs. ~60s current single-pass |
| **Total (with remediation)** | **< 55s** | Still comparable to current |

## Success Criteria

### Per-run quality gates (must pass before file write)

1. **Zero invalid class names** — `classNameValidity` score = 100 (hard gate, not weighted)
2. **Structural integrity ≥ 90** — every slide has footer, inner, bg-glow
3. **Overall quality grade ≥ C** (score ≥ 70) — composite weighted score

### Target metrics (tracked via telemetry, not blocking)

4. **Component diversity ≥ 80%** — generated decks use ≥ 80% of applicable component families
5. **SVG chart adoption** — every data-metrics slide has ≥ 1 SVG chart
6. **Animation variety** — all three animation types used per deck
7. **Counter adoption ≥ 80%** — with pre-computed fragments, the LLM has no reason to skip counters
8. **Quality grade ≥ B** — average scorecard grade across runs
9. **Generation time ≤ 60s** — total pipeline time comparable to or better than current
10. **Zero regressions** — emergence fidelity, source attribution, slide structure all maintain current levels
