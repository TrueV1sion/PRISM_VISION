/**
 * Agent Presenter
 *
 * Skill-powered agentic presentation generator. Replaces both the template
 * pipeline (stages 1-5) and the legacy LLM generation (generateSlidesBatch)
 * with a single agentic module that gives Claude creative freedom guided by
 * expert skill knowledge from 4 custom Claude Code skills.
 *
 * Uses the same tool-use loop pattern as deploy.ts executeAgent():
 *   1. Build system prompt from skill references + presentation spec
 *   2. Build user message from synthesis + findings + datasets
 *   3. Run agentic tool-use loop (max 15 turns)
 *   4. Parse generated slide HTML from agent output
 *
 * Tools available to the agent:
 *   - compile_chart: Generate SVG/HTML chart from enriched dataset
 *   - get_datasets: List available enriched datasets with metadata
 *   - get_css_reference: Return available CSS classes by category
 *   - validate_slide: Check slide HTML for design system compliance
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MODELS, cachedSystemPrompt } from "@/lib/ai/client";
import { loadSkillSystemPrompt, buildDatasetSummary } from "./skill-prompt-loader";
import { compileChartFromDataset, compileCharts } from "./chart-compiler";
import { validate } from "./validator";
import type {
  SlideHTML,
  DatasetRegistry,
  DataPoint,
  EnrichedDataset,
  SynthesisResult,
  AgentResult,
  Blueprint,
  PipelineEvent,
  ChartData,
} from "./types";

// ─── Public Interface ────────────────────────────────────────────────────────

export interface AgentPresenterInput {
  runId: string;
  synthesis: SynthesisResult;
  agentResults: AgentResult[];
  datasets: DatasetRegistry;
  blueprint: Blueprint;
  emitEvent: (event: PipelineEvent) => void;
}

export interface AgentPresenterOutput {
  slides: SlideHTML[];
  manifest: {
    title: string;
    subtitle: string;
    slides: { title: string; type: string }[];
  };
}

const MAX_TURNS = 20;
const MAX_TOOL_RESULT_CHARS = 12_000;
const MAX_TOKENS_PER_TURN = 64_000;

// ─── Tool Definitions ────────────────────────────────────────────────────────

function getToolDefinitions(): Anthropic.Messages.Tool[] {
  return [
    {
      name: "compile_chart",
      description:
        "Generate an SVG or HTML chart fragment from an enriched dataset. " +
        "Returns properly formatted chart markup using the design system's chart tokens " +
        "(var(--chart-1) through var(--chart-8)). Supported chart types: bar, line, donut, " +
        "sparkline, counter, horizontal-bar.",
      input_schema: {
        type: "object" as const,
        properties: {
          datasetId: {
            type: "string",
            description: "The ID of the enriched dataset to chart (from get_datasets)",
          },
          chartType: {
            type: "string",
            enum: ["bar", "line", "donut", "sparkline", "counter", "horizontal-bar"],
            description: "The type of chart to generate",
          },
          title: {
            type: "string",
            description: "Optional title for the chart",
          },
        },
        required: ["datasetId", "chartType"],
      },
    },
    {
      name: "get_datasets",
      description:
        "List all available enriched datasets with their shapes, metrics, sample values, " +
        "and chart worthiness scores. Use this to discover what data is available for " +
        "visualization before calling compile_chart.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get_css_reference",
      description:
        "Return available CSS classes for a specific category from the presentation design system. " +
        "Categories: animations, charts, layouts, typography, colors, components, backgrounds.",
      input_schema: {
        type: "object" as const,
        properties: {
          category: {
            type: "string",
            enum: [
              "animations",
              "charts",
              "layouts",
              "typography",
              "colors",
              "components",
              "backgrounds",
            ],
            description: "The category of CSS classes to retrieve",
          },
        },
        required: ["category"],
      },
    },
    {
      name: "create_chart",
      description:
        "Create a chart from raw data points you define. Use this when you need a chart " +
        "but no enriched dataset exists. Provide labels and values, get back properly " +
        "formatted SVG/HTML using the design system chart tokens. " +
        "ALWAYS use this instead of writing SVG by hand.",
      input_schema: {
        type: "object" as const,
        properties: {
          chartType: {
            type: "string",
            enum: ["bar", "line", "donut", "sparkline", "horizontal-bar"],
            description: "The type of chart to generate",
          },
          dataPoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Label for this data point" },
                value: { type: "number", description: "Numeric value" },
              },
              required: ["label", "value"],
            },
            description: "Array of {label, value} data points",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
        },
        required: ["chartType", "dataPoints"],
      },
    },
    {
      name: "validate_slide",
      description:
        "Check a slide's HTML against the presentation design system. Returns a score " +
        "and list of issues (invalid classes, missing structure, etc.). Use this to verify " +
        "your generated HTML before finalizing.",
      input_schema: {
        type: "object" as const,
        properties: {
          html: {
            type: "string",
            description: "The slide HTML to validate (a single <section> block)",
          },
        },
        required: ["html"],
      },
    },
  ];
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

function handleCompileChart(
  params: { datasetId: string; chartType: string; title?: string },
  datasets: DatasetRegistry,
): string {
  const dataset = datasets.datasets.find((d) => d.id === params.datasetId);
  if (!dataset) {
    return `Error: Dataset "${params.datasetId}" not found. Available IDs: ${datasets.datasets.map((d) => d.id).join(", ")}`;
  }

  try {
    const chart: ChartData = compileChartFromDataset(dataset, params.chartType);

    // Extract the markup fragment
    const fragment =
      "svgFragment" in chart
        ? (chart as { svgFragment: string }).svgFragment
        : "htmlFragment" in chart
          ? (chart as { htmlFragment: string }).htmlFragment
          : "Error: Chart compiled but no fragment produced";

    const titleHtml = params.title
      ? `<h3 class="chart-title">${params.title}</h3>\n`
      : "";

    return `Chart compiled successfully (type: ${params.chartType}, ${dataset.values.length} data points).\n\nEmbed this HTML fragment in your slide:\n\n${titleHtml}${fragment}`;
  } catch (err) {
    return `Error compiling chart: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function handleGetDatasets(datasets: DatasetRegistry): string {
  return buildDatasetSummary(datasets);
}

function handleGetCssReference(params: { category: string }): string {
  const refs: Record<string, string> = {
    animations: `## Animation Classes
- \`.anim\` — Generic fade-up entrance (use contextual variants instead)
- \`.anim-blur\` — Blur-reveal, best for titles and headings
- \`.anim-scale\` — Scale up, best for stat cards and emphasis elements
- \`.anim-spring\` — Spring bounce, best for hero stats and interactive elements
- \`.anim-fade\` — Simple fade, best for footnotes and source lists
- \`.anim-zoom\` — Zoom in, best for emergent numbers and key metrics
- \`.anim-slide-left\` — Slide from left
- \`.anim-slide-right\` — Slide from right
- \`.stagger-children\` — Stagger child element animations (add to parent container)

**Important**: Do NOT add \`.visible\` — the runtime JS adds it via IntersectionObserver.
Elements start hidden (opacity: 0, transform offset) and animate when scrolled into view.`,

    charts: `## Chart Classes
- \`.bar-chart\` — Vertical bar chart container (SVG)
- \`.bar\` — Individual bar rect within bar-chart
- \`.line-chart\` — Line chart container (SVG) with clip-path reveal
- \`.clip-rect\` — Clip rectangle for line-chart animation
- \`.donut-chart\` — Donut/pie chart container (SVG)
- \`.segment\` — Donut chart circle segment
- \`.sparkline\` — Inline sparkline container (SVG)
- \`.sparkline-line\` — Sparkline polyline with stroke-dashoffset animation
- \`.sparkline-dot\` — End-point dot on sparkline
- \`.sparkline-container\` — Inline wrapper for sparkline (80×24px)
- \`.comparison-bars\` — Horizontal comparison bars container
- \`.bar-row\` — Row within comparison-bars
- \`.bar-track\` — Track background for horizontal bar
- \`.bar-fill\` — Fill bar (use style="width:N%" or --fill-pct)
- \`.bar-fill-value\` — Value label on horizontal bar
- \`.chart-legend\` — Legend container (flex wrap)
- \`.legend-item\` — Legend entry
- \`.legend-dot\` — Color dot in legend (use style="background:var(--chart-N)")
- \`.chart-title\` — Chart heading
- \`.chart-container\` — Wrapper for chart with standard spacing`,

    layouts: `## Layout Classes
- \`.slide\` — Base slide class (required on every <section>)
- \`.slide-inner\` — Content container inside slide
- \`.slide-bg-glow\` — Background glow effect element
- \`.slide-footer\` — Footer with source attribution
- \`.title-slide\` — Title slide modifier
- \`.emergent-slide\` — Emergence/insight slide modifier
- \`.grid-2\` — Two-column grid
- \`.grid-3\` — Three-column grid
- \`.grid-4\` — Four-column grid (responsive)
- \`.split-layout\` — 60/40 split layout
- \`.full-bleed\` — Full-width content`,

    typography: `## Typography Classes
- \`.slide-title\` — Main slide heading (large)
- \`.hero-title\` — Hero/title slide heading (extra large)
- \`.slide-subtitle\` — Subtitle text
- \`.section-intro\` — Intro paragraph for slide sections
- \`.eyebrow\` — Small uppercase label above headings
- \`.callout\` — Highlighted insight text
- \`.body-text\` — Standard body text
- \`.stat-number\` — Large animated counter (use data-target="N" for counter animation)
- \`.stat-label\` — Label under stat number
- \`.stat-sublabel\` — Secondary label under stat
- \`.emergent-number\` — Large number for emergence patterns
- \`.dagger-footnote\` — Footnote with dagger (†)`,

    colors: `## Color Classes (CSS Custom Properties)
### Background Variants (on <section class="slide ...">)
- \`gradient-dark\` — Dark gradient background
- \`gradient-blue\` — Blue-tinted dark gradient
- \`gradient-radial\` — Radial gradient
- \`dark-mesh\` — Dark mesh pattern
- \`dark-particles\` — Particle effect background

### Chart Colors (for SVG fill/stroke)
- \`var(--chart-1)\` through \`var(--chart-8)\` — 8-stop chart palette

### Accent Colors
- \`var(--accent)\` — Primary accent (cyan)
- \`var(--accent-bright)\` — Bright accent
- \`var(--accent-violet)\` — Violet accent
- \`var(--accent-success)\` — Green/success
- \`var(--accent-warning)\` — Orange/warning
- \`var(--accent-error)\` — Red/error`,

    components: `## Component Classes
### Cards
- \`.stat-block\` / \`.stat-card\` — Statistical metric card
- \`.finding-card\` — Research finding card (variants: \`.opportunity\`, \`.risk\`, \`.regulatory\`, \`.caution\`)
- \`.emergence-card\` — Emergence insight card (NOT finding-card for emergence slides)
- \`.validation-box\` — Validation/verification box
- \`.action-card\` — Action recommendation card
- \`.callout\` — Highlighted insight with \`.callout-title\`
- \`.quote-block\` — Qualitative evidence quote
- \`.policy-box\` — Policy/regulatory box (variants: \`.positive\`, \`.neutral\`, \`.risk\`)

### Interactive
- \`.accordion-item\` — Expandable section container
  - \`.accordion-trigger\` — Click target header
  - \`.accordion-body\` — Expandable content
- \`.tab-group\` — Tab container
  - \`.tab-list\` — Tab button row
  - \`.tab-button\` — Individual tab (use \`.active\` and \`data-tab\`)
  - \`.tab-panel\` — Tab content panel (use \`.active\` and \`data-tab\`)
- \`.tooltip-wrap\` — Hover tooltip container
  - \`.tooltip-text\` — Tooltip content

### Lists & Groups
- \`.source-list\` — Source attribution list
- \`.toc-item\` / \`.toc-group-header\` — Table of contents items
- \`.process-flow\` / \`.process-step\` — Process/workflow visualization
- \`.timeline-bar\` / \`.timeline-item\` — Timeline visualization
- \`.compact-table\` — Data comparison table
- \`.state-grid\` — Geographic/state grid
- \`.icon-grid\` — Icon-based feature grid
- \`.feature-grid\` / \`.feature-card\` — Feature showcase grid

### Stats
- \`.hero-stats\` — Hero stat grid container
- \`.hero-stat\` — Individual hero stat
- \`.stat-number[data-target]\` — Animated counter (use data-prefix/data-suffix for symbols)
- \`.stat-eyebrow\` — Label above stat number
- \`.stat-trend\` — Trend indicator (\`.positive\` or \`.negative\`)
- \`.agent-chip\` — Agent/source label chip
- \`.confidence-badge\` — Finding confidence (\`.high\`, \`.medium\`, \`.low\`)
- \`.tag\` — Category tag (\`.tag-green\`, \`.tag-blue\`, \`.tag-amber\`, \`.tag-red\`)`,

    backgrounds: `## Background Variants
Apply these as additional classes on the <section class="slide ..."> element:

- \`gradient-dark\` — Deep dark gradient (best for title/opening slides)
- \`gradient-blue\` — Blue-tinted gradient (best for data/analysis slides)
- \`dark-particles\` — Particle effect background (best for stats/metrics slides)
- \`dark-mesh\` — Mesh gradient (best for emergence/insight slides)
- \`gradient-radial\` — Radial gradient (best for closing/summary slides)

**Rotate through variants** across slides — avoid using the same background
on adjacent slides. Create visual rhythm with alternating backgrounds.`,
  };

  return refs[params.category] ?? `Unknown category: ${params.category}. Available: ${Object.keys(refs).join(", ")}`;
}

function handleCreateChart(
  params: { chartType: string; dataPoints: { label: string; value: number }[]; title?: string },
): string {
  if (!params.dataPoints || params.dataPoints.length === 0) {
    return "Error: dataPoints array is required and must not be empty.";
  }

  try {
    const roleMap: Record<string, string> = {
      bar: "bar-value",
      line: "line-point",
      donut: "donut-segment",
      sparkline: "sparkline-point",
      "horizontal-bar": "bar-fill-percent",
    };
    const role = roleMap[params.chartType] ?? "bar-value";

    const dataPoints: DataPoint[] = params.dataPoints.map((dp) => ({
      label: dp.label,
      value: dp.value,
      chartRole: role as DataPoint["chartRole"],
    }));

    const compiled = compileCharts(dataPoints);
    if (compiled.length === 0) {
      return `Error: Failed to compile ${params.chartType} chart from provided data.`;
    }

    const chart = compiled[0];
    const fragment =
      "svgFragment" in chart
        ? (chart as { svgFragment: string }).svgFragment
        : "htmlFragment" in chart
          ? (chart as { htmlFragment: string }).htmlFragment
          : "Error: Chart compiled but no fragment produced";

    const titleHtml = params.title
      ? `<h4 class="chart-heading">${params.title}</h4>\n`
      : "";

    return `Chart created successfully (type: ${params.chartType}, ${params.dataPoints.length} points).\n\nEmbed this HTML fragment directly in your slide:\n\n${titleHtml}${fragment}`;
  } catch (err) {
    return `Error creating chart: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function handleValidateSlide(params: { html: string }): string {
  // Wrap the slide in minimal document structure for the validator
  const wrappedHtml = `<!DOCTYPE html><html><head></head><body>${params.html}</body></html>`;

  try {
    const scorecard = validate(wrappedHtml);
    const issues = scorecard.perSlideIssues;

    if (issues.length === 0) {
      return `Slide validates successfully. Score: ${scorecard.overall}/100 (${scorecard.grade})`;
    }

    const issueList = issues
      .map((i) => `- [${i.severity}] ${i.message}${i.className ? ` (class: ${i.className})` : ""}`)
      .join("\n");

    return `Validation score: ${scorecard.overall}/100 (${scorecard.grade})\n\nIssues found:\n${issueList}`;
  } catch (err) {
    return `Validation error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Tool Dispatch ───────────────────────────────────────────────────────────

function executeTool(
  toolName: string,
  toolInput: unknown,
  datasets: DatasetRegistry,
): string {
  const input = toolInput as Record<string, unknown>;

  switch (toolName) {
    case "compile_chart":
      return handleCompileChart(
        input as { datasetId: string; chartType: string; title?: string },
        datasets,
      );
    case "create_chart":
      return handleCreateChart(
        input as { chartType: string; dataPoints: { label: string; value: number }[]; title?: string },
      );
    case "get_datasets":
      return handleGetDatasets(datasets);
    case "get_css_reference":
      return handleGetCssReference(input as { category: string });
    case "validate_slide":
      return handleValidateSlide(input as { html: string });
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ─── User Message Builder ────────────────────────────────────────────────────

function buildPresentationTask(input: AgentPresenterInput): string {
  const { synthesis, agentResults, datasets, blueprint } = input;

  // Determine slide count from tier
  const tierSlideCount: Record<string, number> = {
    MICRO: 6,
    STANDARD: 10,
    EXTENDED: 14,
    "EXTENDED+": 18,
    MEGA: 20,
    CAMPAIGN: 20,
  };
  const targetCount = tierSlideCount[blueprint.tier] ?? 10;

  // Gather top findings grouped by agent
  const findingsByAgent = agentResults.map((ar) => ({
    name: ar.agentName,
    archetype: ar.archetype,
    dimension: ar.dimension,
    findings: ar.findings,
    gaps: ar.gaps,
    signals: ar.signals,
  }));

  const totalFindings = agentResults.reduce((s, ar) => s + ar.findings.length, 0);
  const highConfFindings = agentResults.flatMap((ar) => ar.findings).filter((f) => f.confidence === "HIGH").length;

  // Extract chartable numbers from findings for create_chart guidance
  const chartableData: string[] = [];
  for (const ar of agentResults) {
    for (const f of ar.findings) {
      // Look for numbers in findings
      const hasNumber = /\d+[%$BMKk]|\$[\d,]+|\d+\.\d+%/.test(f.statement);
      if (hasNumber) {
        chartableData.push(`- "${f.statement}" (${f.source}, ${f.confidence})`);
      }
    }
  }

  // Emergence insights
  const emergenceInsights = synthesis.emergentInsights
    .map(
      (ei, i) =>
        `${i + 1}. **${ei.insight}**\n   Supporting agents: ${ei.supportingAgents.join(", ")}\n   Evidence: ${ei.evidenceSources.join(", ")}`,
    )
    .join("\n\n");

  // Tension points
  const tensionPoints = synthesis.tensionPoints
    .map(
      (tp) =>
        `- **${tp.tension}** (${tp.conflictType})\n  Side A: ${tp.sideA.position} (${tp.sideA.agents.join(", ")})\n  Side B: ${tp.sideB.position} (${tp.sideB.agents.join(", ")})\n  Resolution: ${tp.resolution}`,
    )
    .join("\n\n");

  // Synthesis layers
  const synthesisLayers = synthesis.layers
    .map((l) => {
      const insights = l.insights.map((ins) => `    - ${ins}`).join("\n");
      return `- **${l.name}**: ${l.description}\n${insights}`;
    })
    .join("\n");

  // Agent finding details
  const agentDetails = findingsByAgent
    .map((ag) => {
      const findings = ag.findings
        .map(
          (f, i) =>
            `  ${i + 1}. [${f.confidence}/${f.sourceTier}] ${f.statement}\n     Source: ${f.source}\n     Implication: ${f.implication}`,
        )
        .join("\n");
      const gaps = ag.gaps.length > 0 ? `\n  Gaps: ${ag.gaps.join("; ")}` : "";
      const signals = ag.signals.length > 0 ? `\n  Signals: ${ag.signals.join("; ")}` : "";
      return `### ${ag.name} (${ag.archetype} — ${ag.dimension})\n${findings}${gaps}${signals}`;
    })
    .join("\n\n");

  // Dataset summary
  const datasetSummary = buildDatasetSummary(datasets);
  const hasDatasets = datasets.datasets.length > 0;

  return `# Generate PRISM Intelligence Briefing

## Research Question
${blueprint.query}

## Key Statistics
- Total findings: ${totalFindings} (${highConfFindings} HIGH confidence)
- Agents deployed: ${agentResults.length}
- Emergent insights: ${synthesis.emergentInsights.length}
- Tension points: ${synthesis.tensionPoints.length}
- Synthesis confidence: ${synthesis.overallConfidence}

## Synthesis Layers
${synthesisLayers}

## Emergent Cross-Cutting Insights
${emergenceInsights || "No emergence patterns detected."}

## Tension Points
${tensionPoints || "No tension points identified."}

## Agent Results (Full Detail)
${agentDetails}

${datasetSummary}

${chartableData.length > 0 ? `## Chartable Data in Findings\nThese findings contain numbers suitable for visualization with \`create_chart\`:\n${chartableData.join("\n")}\n` : ""}

---

## YOUR TASK

Generate exactly **${targetCount} slides** as a cinematic HTML5 executive briefing.

### Step 1: Get chart data ready
${hasDatasets
    ? "Call `get_datasets` to see enriched data, then `compile_chart` for each high-worthiness dataset."
    : "No enriched datasets available. Use `create_chart` to build charts from the numerical data in the findings above."}

**You MUST call \`create_chart\` or \`compile_chart\` for every chart.** The findings contain rich numerical data —
extract it into data points and create: bar charts, donut charts, line charts, horizontal-bar comparisons, and sparklines.
Aim for at least ${Math.ceil(targetCount * 0.5)} charts across all slides.

### Step 2: Generate all ${targetCount} slides
Use the golden exemplar patterns from your instructions. Every slide must have:
- Dual \`slide-bg-glow\` elements
- 3+ animation types with delay choreography (d1, d2, d3...)
- \`slide-footer\` with source attribution
- Rich component usage (stat-blocks, finding-cards, tabs, accordions, charts, callouts)

### Slide Plan (MUST include data-slide-type on every section!)
1. **Hero Title** — \`data-slide-type="title"\`, gradient-dark, hero-title, agent-chips, hero-stats, validation-box
2. **Findings TOC** — \`data-slide-type="findings-toc"\`, gradient-blue, toc-items per dimension
3. **Executive Summary** — \`data-slide-type="executive-summary"\`, dark-particles, grid-3 stat-blocks with sparklines, horizontal-bar, callout, action-card
${findingsByAgent.map((ag, i) => `${i + 4}. **${ag.dimension}** — \`data-slide-type="${i === 0 ? "data-metrics" : "dimension-deep-dive"}"\`, ${["gradient-blue", "dark-particles", "dark-mesh"][i % 3]}, stat-blocks, ${["bar chart", "donut chart", "line chart"][i % 3]}, finding-cards`).join("\n")}
${findingsByAgent.length + 4}. **Emergence Patterns** — \`data-slide-type="emergence"\`, gradient-radial emergent-slide, emergent-number, tab-group, emergence-cards
${synthesis.tensionPoints.length > 0 ? `${findingsByAgent.length + 5}. **Tensions & Resolution** — \`data-slide-type="tension"\`, dark-mesh, grid-2 opposing views, callout resolution\n` : ""}${findingsByAgent.length + 4 + (synthesis.tensionPoints.length > 0 ? 2 : 1)}. **Strategic Recommendations** — \`data-slide-type="closing"\`, gradient-radial, hero-stats recap, action-card with timeline

### Output Format
Output each slide as \`\`\`slide-N with the full HTML section block. EVERY section must have data-slide-type attribute.
`;
}

// ─── Slide Parser ────────────────────────────────────────────────────────────

/**
 * Parse slide HTML blocks from agent text output.
 * Looks for fenced code blocks tagged with slide-N or raw <section> blocks.
 */
function parseSlides(agentText: string): SlideHTML[] {
  const slides: SlideHTML[] = [];

  // Strategy 1: Parse fenced code blocks tagged ```slide-N
  const fencedPattern = /```slide-(\d+)\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencedPattern.exec(agentText)) !== null) {
    const slideNumber = parseInt(match[1], 10);
    const html = match[2].trim();
    if (html.includes("<section")) {
      slides.push({
        slideNumber,
        html,
        tokensUsed: 0,
        status: "success",
      });
    }
  }

  if (slides.length > 0) return slides;

  // Strategy 2: Parse raw <section> blocks
  const sectionPattern = /<section\s+class="slide[^"]*"[^>]*>[\s\S]*?<\/section>/g;
  let sectionIdx = 0;

  while ((match = sectionPattern.exec(agentText)) !== null) {
    sectionIdx++;
    slides.push({
      slideNumber: sectionIdx,
      html: match[0].trim(),
      tokensUsed: 0,
      status: "success",
    });
  }

  return slides;
}

/**
 * Extract title and subtitle from the first slide's HTML.
 */
function extractManifest(
  slides: SlideHTML[],
  fallbackTitle: string,
): AgentPresenterOutput["manifest"] {
  let title = fallbackTitle;
  let subtitle = "PRISM Intelligence Briefing";

  if (slides.length > 0) {
    const firstSlide = slides[0].html;
    // Try to extract hero-title or slide-title
    const titleMatch = firstSlide.match(
      /class="(?:hero-title|slide-title)[^"]*"[^>]*>([\s\S]*?)<\//,
    );
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, "").trim() || title;
    }

    const subtitleMatch = firstSlide.match(
      /class="(?:slide-subtitle|section-intro)[^"]*"[^>]*>([\s\S]*?)<\//,
    );
    if (subtitleMatch) {
      subtitle = subtitleMatch[1].replace(/<[^>]+>/g, "").trim() || subtitle;
    }
  }

  return {
    title,
    subtitle,
    slides: slides.map((s) => ({
      title: `Slide ${s.slideNumber}`,
      type: s.slideNumber === 1 ? "title" : "data-metrics",
    })),
  };
}

// ─── Main Agent Loop ─────────────────────────────────────────────────────────

/**
 * Generate a presentation using an agentic tool-use loop.
 *
 * The agent has access to:
 * - compile_chart: Generate charts from enriched datasets
 * - get_datasets: Discover available data
 * - get_css_reference: Look up design system classes
 * - validate_slide: Check generated HTML quality
 *
 * The agent generates slides as HTML <section> blocks in its text output,
 * using compile_chart for data visualizations.
 */
export async function generatePresentationWithAgent(
  input: AgentPresenterInput,
): Promise<AgentPresenterOutput> {
  const { runId, datasets, emitEvent } = input;
  const anthropic = getAnthropicClient();

  // Determine slide count target from tier
  const tierTargets: Record<string, number> = {
    STANDARD: 10,
    EXTENDED: 14,
    "EXTENDED+": 18,
  };
  const targetSlideCount = tierTargets[input.blueprint.tier] ?? 12;

  // Build system prompt from skills
  const systemBlocks = loadSkillSystemPrompt({
    theme: "executive-dark",
    audience: "executive",
    datasets: datasets.datasets,
    targetSlideCount,
  });

  // Build user message
  const userMessage = buildPresentationTask(input);

  // Tool definitions
  const tools = getToolDefinitions();

  // Initialize messages
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let allAgentText = "";
  let totalTokens = 0;

  console.log(
    `[agent-presenter] Starting agentic loop — ${datasets.datasets.length} datasets, target ${targetSlideCount} slides`,
  );

  emitEvent({
    type: "agent_progress",
    agentName: "agent-presenter",
    progress: 10,
    message: `Starting presentation generation (${datasets.datasets.length} datasets available)`,
  });

  // ── Agentic Tool-Use Loop ──────────────────────────────────────────────────

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Use streaming to handle long-running requests (large system prompt + high max_tokens)
    const stream = anthropic.messages.stream({
      model: MODELS.PRESENT,
      max_tokens: MAX_TOKENS_PER_TURN,
      system: systemBlocks,
      tools,
      messages,
    });
    const response = await stream.finalMessage();

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    // Collect text blocks and tool_use blocks
    const textBlocks: string[] = [];
    const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textBlocks.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // Accumulate text output
    const turnText = textBlocks.join("\n");
    allAgentText += turnText + "\n";

    console.log(
      `[agent-presenter] Turn ${turn + 1}: ${textBlocks.length} text blocks, ${toolUseBlocks.length} tool calls, stop=${response.stop_reason}`,
    );

    emitEvent({
      type: "agent_progress",
      agentName: "agent-presenter",
      progress: Math.min(10 + (turn + 1) * 6, 90),
      message: `Turn ${turn + 1}: ${toolUseBlocks.length > 0 ? `executing ${toolUseBlocks.length} tool(s)` : "generating slides"}`,
    });

    // If no tool calls, the agent is done generating
    if (toolUseBlocks.length === 0) {
      break;
    }

    // If stop_reason is "end_turn" but there ARE tool calls, still process them
    // (this can happen when the agent outputs text + tools in the same response)

    // Execute tool calls and build assistant + tool_result messages
    // Add the assistant's response (with tool_use blocks) to messages
    messages.push({ role: "assistant", content: response.content });

    // Build tool results
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = executeTool(toolUse.name, toolUse.input, datasets);
      const truncated =
        result.length > MAX_TOOL_RESULT_CHARS
          ? result.slice(0, MAX_TOOL_RESULT_CHARS) + "\n\n[...truncated]"
          : result;

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: truncated,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // ── Parse Slides from Agent Output ─────────────────────────────────────────

  const slides = parseSlides(allAgentText);

  if (slides.length === 0) {
    throw new Error(
      `Agent presenter produced no slides after ${MAX_TURNS} turns. ` +
      `Total tokens: ${totalTokens}. Text length: ${allAgentText.length} chars.`,
    );
  }

  // Update token counts
  const tokensPerSlide = Math.floor(totalTokens / slides.length);
  for (const slide of slides) {
    slide.tokensUsed = tokensPerSlide;
  }

  const manifest = extractManifest(slides, input.blueprint.query);

  console.log(
    `[agent-presenter] Generated ${slides.length} slides, ${totalTokens} tokens total`,
  );

  emitEvent({
    type: "agent_progress",
    agentName: "agent-presenter",
    progress: 100,
    message: `Generated ${slides.length} slides (${totalTokens} tokens)`,
  });

  return { slides, manifest };
}
