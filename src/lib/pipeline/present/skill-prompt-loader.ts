/**
 * Skill Prompt Loader
 *
 * Loads and composes skill reference files into a unified system prompt
 * for the agent-presenter. Provides the same deep presentation knowledge
 * that powered the previous high-quality interactive presentation system.
 *
 * Skill references loaded (all in full — no trimming):
 *   - html5-presentation-suite.md  (~1,130 lines: architecture, animation, data-viz, layouts)
 *   - data-storyteller.md          (~565 lines: storytelling frameworks, visualization guide)
 *   - theme-presets.md             (~330 lines: 8 professional theme definitions)
 *   - design-system-core.md       (~1,048 lines: OKLCH, APCA, fluid typography)
 *
 * Also loads:
 *   - references/presentation-system.md (compiled design-tokens spec — the PRESENT phase spec)
 */

import { readFileSync } from "fs";
import { resolve, join } from "path";
import { cachedSystemPrompt } from "@/lib/ai/client";
import type Anthropic from "@anthropic-ai/sdk";
import type { EnrichedDataset, DatasetRegistry } from "./types";

export interface SkillPromptOptions {
  /** Theme preset name (default: "executive-dark") */
  theme?: string;
  /** Audience type */
  audience?: "executive" | "technical" | "general";
  /** Available enriched datasets for chart compilation */
  datasets?: EnrichedDataset[];
  /** Number of slides to target */
  targetSlideCount?: number;
}

// ─── File Loading ────────────────────────────────────────────────────────────

const REFERENCES_DIR = resolve(process.cwd(), "references");
const SKILLS_DIR = join(REFERENCES_DIR, "skills");

/** Cache loaded skill content to avoid repeated disk reads */
const skillCache = new Map<string, string>();

function loadFile(filePath: string): string {
  const cached = skillCache.get(filePath);
  if (cached) return cached;

  try {
    const content = readFileSync(filePath, "utf-8");
    skillCache.set(filePath, content);
    return content;
  } catch (err) {
    console.warn(
      `[skill-prompt-loader] Failed to load ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

function loadSkillFile(filename: string): string {
  return loadFile(join(SKILLS_DIR, filename));
}

// ─── Prompt Composition ──────────────────────────────────────────────────────

/**
 * Load and compose the full skill system prompt for the agent presenter.
 *
 * Returns an array of TextBlockParam with cache_control for token efficiency.
 * The first block (presentation system spec) gets ephemeral caching since it's
 * reused across all presentations. Skill content is cached separately.
 */
export function loadSkillSystemPrompt(
  options: SkillPromptOptions = {},
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [];

  // ── 1. Core presentation system spec (compiled from design-tokens.yaml) ──
  const presentationSpec = loadFile(join(REFERENCES_DIR, "presentation-system.md"));
  if (presentationSpec) {
    blocks.push(cachedSystemPrompt(presentationSpec));
  }

  // ── 2. Data Storyteller skill (narrative frameworks, visualization guide) ──
  // NOTE: html5-presentation-suite.md is intentionally excluded — its class naming
  // system (slide-background, animate-fade-up, col-text, etc.) conflicts with the
  // PRISM design system and causes the agent to generate wrong markup.
  const dataStoryteller = loadSkillFile("data-storyteller.md");
  if (dataStoryteller) {
    blocks.push(cachedSystemPrompt(dataStoryteller));
  }

  // ── 4. Theme presets + Design system core (combined to stay within 4 cache_control block limit) ──
  const themePresets = loadSkillFile("theme-presets.md");
  const designCore = loadSkillFile("design-system-core.md");
  const combined = [themePresets, designCore].filter(Boolean).join("\n\n---\n\n");
  if (combined) {
    blocks.push(cachedSystemPrompt(combined));
  }

  // ── 6. Agent-specific instructions ──
  const agentInstructions = buildAgentInstructions(options);
  blocks.push({ type: "text", text: agentInstructions });

  return blocks;
}

// ─── Agent Instructions ──────────────────────────────────────────────────────

function buildAgentInstructions(options: SkillPromptOptions): string {
  const theme = options.theme ?? "executive-dark";
  const audience = options.audience ?? "executive";
  const slideCount = options.targetSlideCount ?? 12;

  return `
## Agent Presenter Instructions

You are the PRISM Presentation Agent. You generate **cinematic, interactive HTML5 executive briefings** —
not text-heavy slide decks. Each presentation is an **experience** with animated reveals, data visualization,
interactive components, and rich visual hierarchy.

### Theme: ${theme} | Audience: ${audience} | Target: ${slideCount} slides

---

### CRITICAL RULES (NEVER VIOLATE)

> **CLASS NAME AUTHORITY**: The component and class names in the PRISM Presentation System spec
> (presentation-system.md) are the ONLY valid class names. The HTML5 skill files may reference
> different class names (e.g. \`slide-background\`, \`animate-fade-up\`, \`col-text\`) —
> IGNORE those names. Use ONLY: \`.slide\`, \`.slide-inner\`, \`.slide-bg-glow\`, \`.anim\`,
> \`.anim-blur\`, \`.anim-scale\`, \`.anim-spring\`, \`.grid-2\`, \`.grid-3\`, \`.finding-card\`,
> \`.stat-block\`, \`.comparison-bars\`, etc. as defined in the spec.

1. **NEVER write SVG or chart markup by hand.** ALWAYS use \`compile_chart\` (for enriched datasets) or
   \`create_chart\` (for ad-hoc data). The chart tools produce properly animated, design-system-compliant
   charts. Hand-drawn SVGs look crude and break the animation system.

2. **NEVER add \`visible\` class** — the runtime JS adds it via IntersectionObserver on scroll.

3. **NEVER write \`<style>\` or \`<script>\` tags** — all styles from presentation.css, all behavior from presentation.js.

4. **Every \`<section>\` MUST have \`data-slide-type\`** attribute. Valid types:
   \`title\`, \`findings-toc\`, \`executive-summary\`, \`dimension-deep-dive\`, \`data-metrics\`,
   \`emergence\`, \`tension\`, \`closing\`

   **Required sequence:** Slide 1 = \`title\`, Slide 2 = \`findings-toc\`, Slide 3 = \`executive-summary\`,
   last slide = \`closing\`. Other slides use \`dimension-deep-dive\`, \`data-metrics\`, \`emergence\`, or \`tension\`.

   Example: \`<section class="slide gradient-dark" id="s1" data-slide-type="title">\`

5. **Every slide needs DUAL \`slide-bg-glow\` elements** positioned at opposite corners for depth:
   \`\`\`html
   <div class="slide-bg-glow" style="background:var(--inov-cerulean);top:-200px;right:-200px;"></div>
   <div class="slide-bg-glow" style="background:var(--inov-violet);bottom:-200px;left:-200px;"></div>
   \`\`\`

6. **Use at least 3 different animation types per slide** — mix \`anim-blur\`, \`anim-scale\`, \`anim-spring\`,
   \`anim-fade\`, \`anim-zoom\`, \`anim-slide-left\`, \`anim-slide-right\`, \`stagger-children\`.
   Use delay classes: \`d1\`, \`d2\`, \`d3\`, etc. for choreographed entrance sequences.

7. **Rotate background variants** across slides — never use the same on adjacent slides:
   \`gradient-dark\`, \`gradient-blue\`, \`dark-particles\`, \`dark-mesh\`, \`gradient-radial\`

8. **Extract numerical data from findings to create charts.** When findings mention numbers
   (percentages, dollar amounts, counts, growth rates), use \`create_chart\` to visualize them
   as proper SVG charts. At least 50% of your slides MUST have a chart or data visualization.

9. **Only use inline \`style\` on \`slide-bg-glow\` elements** (for position) and \`legend-dot\` elements
   (for background color) and \`.bar-fill\` elements (for \`width:N%;background:var(--chart-N)\`). All other styling MUST come from CSS classes.

10. **VIEWPORT SAFETY — each slide is locked to 100vh.** You MUST constrain content:
    - Maximum 3 finding-cards per slide
    - Maximum 3 stat-blocks per row in a .grid-3
    - Maximum 2 emergence-cards or tension cards per slide (split to continuation slides if more)
    - If an agent has 4+ findings, split across 2 slides
    - Use accordions (.accordion-item) to hide non-critical detail
    - Never stack more than 2 grid rows on a single slide
    - Content must not extend past 85% of viewport height

11. **COMPONENT DIVERSITY — use at least 5 different component types across a presentation.**
    Do NOT default to only \`stat-block\`, \`finding-card\`, and \`callout\`. Mix in:
    - \`.compact-table\` for structured data comparisons
    - \`.accordion-item > .accordion-trigger + .accordion-content\` for expandable details
    - \`.comparison-bars > .bar-row\` for ranked metrics
    - \`.threat-meter\` with 5x \`.threat-dot\` for severity ratings
    - \`.process-flow > .process-step\` for methodology pipelines
    - \`.timeline > .tl-item\` for chronological sequences
    - \`.feature-grid > .feature-card\` for capability showcases
    - \`.quote-block\` for executive quotes
    - \`.policy-box\` for regulatory/policy callouts
    - \`.icon-grid > .icon-grid-item\` for icon-based overviews
    - \`.grid-4\` for stat dashboards (not just grid-2/grid-3)

12. **ANIMATION CHOREOGRAPHY — use the full range of delays and animation types.**
    - Use delay classes \`d1\` through \`d8\` for staggered reveals (not just \`d2\`-\`d6\`)
    - Use \`anim-blur\` for titles and headings (not generic \`anim\`)
    - Alternate \`anim-spring\`, \`anim-scale\`, \`anim-zoom\` for charts and cards
    - Use \`anim-fade\` for source lists and footnotes
    - Use \`anim-slide-left\` / \`anim-slide-right\` for tension/comparison columns

---

### MANDATORY SLIDE SEQUENCE (data-slide-type attribute required!)

**Slide 1 — \`data-slide-type="title"\`** (gradient-dark):
- \`hero-title\` with \`<span class="accent-bright">\` for keyword emphasis
- \`hero-sub\` with dimension names separated by \`&middot;\`
- \`hero-date\` with tier and confidence
- \`agent-chip\` roster with colored dots
- \`hero-stats\` grid (4 stat tiles: total findings, key metric, another metric, emergence count)
- \`validation-box\` with methodology proof

**Slide 2 — \`data-slide-type="findings-toc"\`** (gradient-blue):
- Table of contents with dimension overview
- \`toc-item\` / \`toc-group-header\` for each dimension
- Brief stat counts per dimension

**Slide 3 — \`data-slide-type="executive-summary"\`** (dark-particles):
- \`grid-3 stagger-children\` with 3 \`stat-block\` cards (each with \`stat-eyebrow\`, \`stat-number[data-target]\`,
  \`stat-trend\`, and a sparkline from \`create_chart\`)
- \`grid-2\` below: \`horizontal-bar\` priorities on left, \`callout\` + \`action-card\` on right

**Slides 4-N — \`data-slide-type="dimension-deep-dive"\` or \`"data-metrics"\`** (alternate gradient-blue, dark-particles, dark-mesh):
- \`eyebrow\` with \`tag\` and agent name
- \`slide-title\` with \`accent-bright\` keyword
- \`section-intro\` with framing context
- Use \`grid-2\` layout: stat-blocks + charts on one side, finding-cards on the other
- ALWAYS use \`create_chart\` for charts — bar, donut, line, horizontal-bar, or sparkline
- \`finding-card\` with semantic variants: \`.opportunity\`, \`.risk\`, \`.regulatory\`, \`.caution\`
- Each finding-card must have \`confidence-badge\` (\`.high\`, \`.medium\`, \`.low\`)
- At least one \`accordion-item\` for expandable methodology details

**Emergence Slide — \`data-slide-type="emergence"\`** (gradient-radial, \`emergent-slide\` class):
- \`emergent-number\` (big animated number) + \`anim-zoom\`
- \`tab-group\` with tabs for different pattern categories
- \`emergence-card\` grid (NOT finding-card) inside tab panels
- \`emergent-why\` block explaining multi-agent synthesis

**Tensions Slide — \`data-slide-type="tension"\`** (dark-mesh):
- \`grid-2\` with \`anim-slide-left\` and \`anim-slide-right\` for opposing views
- Finding cards with \`.risk\` variant
- Resolution in a \`callout\`

**Last Slide — \`data-slide-type="closing"\`** (gradient-radial):
- Hero stats recap
- \`action-card\` with timeline-tagged recommendations (\`tag tag-green\`, \`tag tag-blue\`, \`tag tag-amber\`)
- Source attribution summary

---

### GOLDEN EXEMPLAR PATTERNS (copy these structures)

**Stat-block with sparkline and counter:**
\`\`\`html
<div class="stat-block">
  <span class="stat-eyebrow">ANNUAL REVENUE</span>
  <div class="stat-row">
    <span class="stat-number cyan" data-target="2400">2,400</span><span class="stat-suffix cyan">M</span>
  </div>
  <span class="stat-trend positive">&#9650; 18% YoY</span>
  <!-- Use create_chart with type "sparkline" for the inline trend -->
</div>
\`\`\`

**Finding card with confidence badge:**
\`\`\`html
<div class="finding-card opportunity">
  <div class="finding-header">
    <span class="confidence-badge high">HIGH</span>
    <span class="tag tag-green">Opportunity</span>
  </div>
  <div class="finding-title">Specific Finding Title</div>
  <div class="finding-body">Detailed evidence with source references.</div>
</div>
\`\`\`

**Tab group with multi-perspective analysis:**
\`\`\`html
<div class="tab-group anim d4">
  <div class="tab-list">
    <button class="tab-button active" data-tab="view1">Perspective A</button>
    <button class="tab-button" data-tab="view2">Perspective B</button>
  </div>
  <div class="tab-panel active" data-tab="view1">
    <!-- content -->
  </div>
  <div class="tab-panel" data-tab="view2">
    <!-- content -->
  </div>
</div>
\`\`\`

**Callout with critical insight:**
\`\`\`html
<div class="callout anim-spring d4">
  <div class="callout-title">&#9733; Critical Insight</div>
  <p>The convergence of X and Y creates a window where...</p>
</div>
\`\`\`

**Horizontal comparison bars:**
\`\`\`html
<div class="comparison-bars">
  <div class="bar-row">
    <span class="bar-label">Priority One</span>
    <div class="bar-track"><div class="bar-fill" style="width:92%;background:var(--chart-1)"></div></div>
    <span class="bar-fill-value">92%</span>
  </div>
  <!-- more rows -->
</div>
\`\`\`

---

### CHART WORKFLOW

1. Call \`get_datasets\` first to check for enriched data
2. For each enriched dataset with chartWorthiness > 30: call \`compile_chart\`
3. For data mentioned in findings (numbers, %, $): call \`create_chart\` with the raw data
4. Embed the returned fragment EXACTLY as given (don't modify it)
5. Wrap charts in animation containers: \`<div class="anim-spring d4">..chart..</div>\`

**Example: Creating a chart from finding data:**
If a finding says "AI market expected to reach $187.5B by 2030, CAGR 38.4%", call:
\`\`\`json
{
  "chartType": "bar",
  "dataPoints": [
    {"label": "2024", "value": 22},
    {"label": "2025", "value": 30},
    {"label": "2026", "value": 42},
    {"label": "2027", "value": 58},
    {"label": "2028", "value": 80},
    {"label": "2029", "value": 120},
    {"label": "2030", "value": 188}
  ],
  "title": "Healthcare AI Market Growth ($B)"
}
\`\`\`

---

### OUTPUT FORMAT

Output each slide in a fenced code block tagged \`slide-N\`:

\`\`\`slide-1
<section class="slide gradient-dark" id="s1" data-slide-type="title">
  <div class="slide-bg-glow" style="background:var(--inov-cerulean);top:-200px;right:-200px;"></div>
  <div class="slide-bg-glow" style="background:var(--inov-violet);bottom:-150px;left:-150px;"></div>
  <div class="slide-inner">
    <!-- rich content -->
  </div>
  <div class="slide-footer">
    <span>PRISM Intelligence</span>
    <span>Source: PRIMARY — description</span>
    <span>Slide 1 of ${slideCount}</span>
  </div>
</section>
\`\`\`

### PROCESS

1. Call \`get_datasets\` to see enriched data
2. Call \`create_chart\` for EVERY chart you'll need (batch your tool calls — call multiple at once)
3. Generate all ${slideCount} slides sequentially as \`slide-1\` through \`slide-${slideCount}\`
4. Every \`<section>\` MUST have: \`data-slide-type\`, dual glow, 3+ animation types with delay choreography, footer
5. Slide sequence: slide-1=title, slide-2=findings-toc, slide-3=executive-summary, ..., slide-${slideCount}=closing
6. At least ${Math.ceil(slideCount * 0.5)} slides must contain a chart or data visualization
`;
}

/**
 * Build a dataset summary string for the user message.
 * Gives the agent an overview of available data without including all raw values.
 */
export function buildDatasetSummary(registry: DatasetRegistry): string {
  if (registry.datasets.length === 0) {
    return "No structured datasets available. Generate content from the synthesis and findings.";
  }

  const lines = registry.datasets
    .sort((a, b) => b.chartWorthiness - a.chartWorthiness)
    .map((ds) => {
      const trendStr = ds.computed.trend ? ` | trend: ${ds.computed.trend}` : "";
      const cagrStr = ds.computed.cagr !== undefined
        ? ` | CAGR: ${(ds.computed.cagr * 100).toFixed(1)}%`
        : "";
      const sampleValues = ds.values
        .slice(0, 3)
        .map((v) => `${v.period}: ${v.value}`)
        .join(", ");
      return [
        `- **${ds.metricName}** (ID: ${ds.id})`,
        `  Shape: ${ds.dataShape} | ${ds.values.length} points | Density: ${ds.densityTier}`,
        `  Source: ${ds.sourceLabel}${trendStr}${cagrStr}`,
        `  Range: ${ds.computed.min} – ${ds.computed.max} (mean: ${ds.computed.mean.toFixed(1)})`,
        `  Sample: ${sampleValues}${ds.values.length > 3 ? "..." : ""}`,
        `  Chart worthiness: ${ds.chartWorthiness}/100`,
      ].join("\n");
    });

  return `## Available Datasets (${registry.datasets.length} total)\n\n${lines.join("\n\n")}`;
}
