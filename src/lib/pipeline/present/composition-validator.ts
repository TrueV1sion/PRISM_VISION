/**
 * Composition Validator
 *
 * Validates generated slide HTML against its SlideCompositionSpec contract.
 * Runs after each slide is generated, BEFORE assembly.
 *
 * Violations are either:
 * - "blocking" (score < 50): triggers slide regeneration with error feedback
 * - "degrading" (score 50-80): triggers targeted remediation
 * - Passing (score > 80): proceeds to assembly
 */

import type {
  SlideCompositionSpec,
  CompositionResult,
  CompositionViolation,
  DeckCompositionReview,
  SlideType,
} from "./types";

// ─── Animation Classes in the Design System ─────────────────

const ANIMATION_CLASSES = new Set([
  "anim", "anim-blur", "anim-scale", "anim-slide-left", "anim-slide-right",
  "anim-spring", "anim-fade", "anim-zoom", "stagger-children",
]);

// ─── Chart Element Selectors ────────────────────────────────

const CHART_CLASSES = new Set([
  "donut-chart", "bar-chart", "sparkline", "line-chart", "horizontal-bar",
]);

// ─── Background Variants ────────────────────────────────────

const BACKGROUND_VARIANTS = new Set([
  "gradient-dark", "gradient-blue", "gradient-radial", "dark-mesh", "dark-particles",
]);

// ─── Default Composition Specs by Slide Type ────────────────

export const DEFAULT_COMPOSITION_SPECS: Record<SlideType, SlideCompositionSpec> = {
  "title": {
    requiredComponentClasses: ["hero-title", "hero-stats", "agent-chip"],
    minAnimationTypes: 3,
    interactiveRequirement: "none",
    densityTarget: "rich",
    backgroundVariant: "gradient-dark",
    chartRequirement: "none",
  },
  "findings-toc": {
    requiredComponentClasses: ["callout", "toc-group-header", "toc-item"],
    minAnimationTypes: 3,
    interactiveRequirement: "one",
    densityTarget: "rich",
    backgroundVariant: "gradient-dark",
    chartRequirement: "none",
  },
  "dimension-deep-dive": {
    requiredComponentClasses: ["finding-card", "section-intro"],
    minAnimationTypes: 3,
    interactiveRequirement: "one",
    densityTarget: "standard",
    backgroundVariant: "gradient-blue",
    chartRequirement: "one",
  },
  "data-metrics": {
    requiredComponentClasses: ["stat-block", "chart-container"],
    minAnimationTypes: 2,
    interactiveRequirement: "none",
    densityTarget: "rich",
    backgroundVariant: "gradient-blue",
    chartRequirement: "multiple",
  },
  "emergence": {
    requiredComponentClasses: ["emergence-card", "emergent-number"],
    minAnimationTypes: 3,
    interactiveRequirement: "one",
    densityTarget: "standard",
    backgroundVariant: "dark-particles",
    chartRequirement: "none",
  },
  "tension": {
    requiredComponentClasses: ["grid-2", "finding-card", "tag"],
    minAnimationTypes: 2,
    interactiveRequirement: "one",
    densityTarget: "standard",
    backgroundVariant: "gradient-radial",
    chartRequirement: "none",
  },
  "executive-summary": {
    requiredComponentClasses: ["callout", "summary-card-stack", "finding-card"],
    minAnimationTypes: 3,
    interactiveRequirement: "one",
    densityTarget: "rich",
    backgroundVariant: "gradient-dark",
    chartRequirement: "none",
  },
  "closing": {
    requiredComponentClasses: ["finding-card", "section-intro"],
    minAnimationTypes: 2,
    interactiveRequirement: "none",
    densityTarget: "standard",
    backgroundVariant: "gradient-dark",
    chartRequirement: "none",
  },
};

// ─── Per-Slide Composition Validation ───────────────────────

/**
 * Validate a generated slide HTML against its composition spec.
 * Returns a CompositionResult with score and violations.
 */
export function validateComposition(
  html: string,
  spec: SlideCompositionSpec,
): CompositionResult {
  const violations: CompositionViolation[] = [];
  let score = 100;

  // 1. Required components present
  for (const cls of spec.requiredComponentClasses) {
    // Check for the class in the HTML (as class name, not substring)
    const classRegex = new RegExp(`class="[^"]*\\b${escapeRegex(cls)}\\b`, "i");
    if (!classRegex.test(html)) {
      const deduction = 15;
      score -= deduction;
      violations.push({
        type: "missing_component",
        severity: "blocking",
        detail: `Required component class "${cls}" not found in slide HTML`,
        suggestion: `Add an element with class="${cls}" — see exemplars for usage patterns`,
      });
    }
  }

  // 2. Animation diversity
  const animationTypes = new Set<string>();
  for (const anim of ANIMATION_CLASSES) {
    const animRegex = new RegExp(`class="[^"]*\\b${escapeRegex(anim)}\\b`, "i");
    if (animRegex.test(html)) {
      animationTypes.add(anim);
    }
  }
  if (animationTypes.size < spec.minAnimationTypes) {
    const deduction = 10;
    score -= deduction;
    const missing = spec.minAnimationTypes - animationTypes.size;
    violations.push({
      type: "insufficient_animations",
      severity: "degrading",
      detail: `Found ${animationTypes.size} animation types (${[...animationTypes].join(", ")}), need ≥${spec.minAnimationTypes}`,
      suggestion: `Add ${missing} more animation types. Use: anim-blur on titles, stagger-children on grids, anim-spring on stats/callouts`,
    });
  }

  // 3. Interactive components
  if (spec.interactiveRequirement !== "none") {
    const interactiveCount = countInteractiveComponents(html);
    const minRequired = spec.interactiveRequirement === "multiple" ? 2 : 1;
    if (interactiveCount < minRequired) {
      const deduction = 8;
      score -= deduction;
      violations.push({
        type: "missing_interactive",
        severity: "degrading",
        detail: `Found ${interactiveCount} interactive components, need ≥${minRequired}`,
        suggestion: interactiveCount === 0
          ? "Add an accordion for expandable finding details, or a callout for the key takeaway"
          : "Add a second interactive component: tabs for multi-view comparison, or tooltips on domain terms",
      });
    }
  }

  // 4. Visual density
  const elementCount = countContentElements(html);
  const densityRange = getDensityRange(spec.densityTarget);
  if (elementCount < densityRange.min) {
    const deduction = 8;
    score -= deduction;
    violations.push({
      type: "density_violation",
      severity: "degrading",
      detail: `Slide has ${elementCount} content elements, target "${spec.densityTarget}" expects ≥${densityRange.min}`,
      suggestion: "Add sparklines to stat-blocks, include source-list footer, add relevant tags from finding metadata",
    });
  } else if (elementCount > densityRange.max) {
    const deduction = 5;
    score -= deduction;
    violations.push({
      type: "density_violation",
      severity: "degrading",
      detail: `Slide has ${elementCount} content elements, target "${spec.densityTarget}" expects ≤${densityRange.max}`,
      suggestion: "Consider splitting content across slides or using accordion to collapse secondary detail",
    });
  }

  // 5. Chart presence
  if (spec.chartRequirement !== "none") {
    const chartTypes = countChartTypes(html);
    if (spec.chartRequirement === "mixed-types" && chartTypes.size < 2) {
      const deduction = 10;
      score -= deduction;
      violations.push({
        type: "missing_chart",
        severity: "degrading",
        detail: `Chart requirement "mixed-types" needs ≥2 chart types, found ${chartTypes.size}: ${[...chartTypes].join(", ") || "none"}`,
        suggestion: "Add a different chart type — e.g., donut for composition, sparkline for trends, bar for comparison",
      });
    } else if (spec.chartRequirement === "multiple" && chartTypes.size < 1) {
      const deduction = 10;
      score -= deduction;
      violations.push({
        type: "missing_chart",
        severity: "blocking",
        detail: "Chart requirement 'multiple' needs ≥1 chart, found none",
        suggestion: "Insert pre-compiled chart SVG fragment from chart-compiler output",
      });
    } else if (spec.chartRequirement === "one" && chartTypes.size < 1) {
      const deduction = 8;
      score -= deduction;
      violations.push({
        type: "missing_chart",
        severity: "degrading",
        detail: "Chart requirement 'one' needs ≥1 chart, found none",
        suggestion: "Insert pre-compiled chart SVG fragment from chart-compiler output",
      });
    }
  }

  // 6. Background variant
  const hasCorrectBg = html.includes(`class="slide ${spec.backgroundVariant}"`);
  const hasAnyBg = BACKGROUND_VARIANTS.size > 0 &&
    [...BACKGROUND_VARIANTS].some(bg => html.includes(`class="slide ${bg}"`));
  if (!hasCorrectBg) {
    if (hasAnyBg) {
      const deduction = 3;
      score -= deduction;
      violations.push({
        type: "wrong_background",
        severity: "degrading",
        detail: `Expected background "${spec.backgroundVariant}", found different variant`,
        suggestion: `Change <section class="slide ..." to include "${spec.backgroundVariant}"`,
      });
    } else {
      const deduction = 5;
      score -= deduction;
      violations.push({
        type: "wrong_background",
        severity: "degrading",
        detail: "No background variant class found on slide section",
        suggestion: `Add "${spec.backgroundVariant}" to the <section class="slide ..."> element`,
      });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const hasBlocking = violations.some(v => v.severity === "blocking");
  return {
    passed: !hasBlocking && score >= 50,
    score,
    violations,
  };
}

// ─── Deck-Level Composition Review ──────────────────────────

/**
 * Evaluate the assembled deck HTML for overall design quality.
 * Returns a DeckCompositionReview with per-dimension scores.
 */
export function reviewDeckComposition(
  slidesHtml: string[],
  backgroundVariants: string[],
): DeckCompositionReview {
  // 1. Component vocabulary — count distinct classes from design system
  const allClasses = new Set<string>();
  const classRegex = /class="([^"]*)"/g;
  for (const html of slidesHtml) {
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(html)) !== null) {
      for (const cls of match[1].split(/\s+/)) {
        if (cls.length > 0) allClasses.add(cls);
      }
    }
  }
  const vocabularyTarget = 30;
  const componentVocabulary = Math.min(100, (allClasses.size / vocabularyTarget) * 100);

  // 2. Animation diversity
  const allAnimations = new Set<string>();
  for (const html of slidesHtml) {
    for (const anim of ANIMATION_CLASSES) {
      const regex = new RegExp(`class="[^"]*\\b${escapeRegex(anim)}\\b`, "i");
      if (regex.test(html)) allAnimations.add(anim);
    }
  }
  const animTarget = 6;
  const animationDiversity = Math.min(100, (allAnimations.size / animTarget) * 100);

  // 3. Chart type diversity
  const allChartTypes = new Set<string>();
  for (const html of slidesHtml) {
    for (const ct of countChartTypes(html)) {
      allChartTypes.add(ct);
    }
  }
  const chartTarget = 4;
  const chartTypeDiversity = Math.min(100, (allChartTypes.size / chartTarget) * 100);

  // 4. Interactive richness — % of content slides with interactive elements
  const contentSlideCount = slidesHtml.length - 2; // exclude title + closing
  const slidesWithInteractive = slidesHtml.filter(
    html => countInteractiveComponents(html) > 0,
  ).length;
  const interactiveRichness = contentSlideCount > 0
    ? (slidesWithInteractive / contentSlideCount) * 100
    : 0;

  // 5. Background alternation — penalize adjacent same backgrounds
  let adjacentSamePairs = 0;
  for (let i = 1; i < backgroundVariants.length; i++) {
    if (backgroundVariants[i] === backgroundVariants[i - 1]) {
      adjacentSamePairs++;
    }
  }
  const maxPairs = Math.max(1, backgroundVariants.length - 1);
  const backgroundAlternation = ((maxPairs - adjacentSamePairs) / maxPairs) * 100;

  // 6. Visual rhythm — density should vary across slides
  const densities = slidesHtml.map(countContentElements);
  const densityStdDev = stdDev(densities);
  // A good deck has stddev > 2 (varies between sparse and rich)
  const visualRhythm = Math.min(100, (densityStdDev / 3) * 100);

  // Weighted composite
  const overallDesignScore =
    componentVocabulary * 0.22 +
    animationDiversity * 0.18 +
    chartTypeDiversity * 0.15 +
    interactiveRichness * 0.18 +
    backgroundAlternation * 0.12 +
    visualRhythm * 0.15;

  return {
    componentVocabulary: Math.round(componentVocabulary),
    animationDiversity: Math.round(animationDiversity),
    chartTypeDiversity: Math.round(chartTypeDiversity),
    interactiveRichness: Math.round(interactiveRichness),
    backgroundAlternation: Math.round(backgroundAlternation),
    visualRhythm: Math.round(visualRhythm),
    overallDesignScore: Math.round(overallDesignScore),
  };
}

// ─── Helpers ────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countInteractiveComponents(html: string): number {
  // Deduplicate — count component TYPES not instances
  const types = new Set<string>();
  if (/accordion-item|accordion-trigger/.test(html)) types.add("accordion");
  if (/tab-group|tab-list/.test(html)) types.add("tabs");
  if (/tooltip-wrap/.test(html)) types.add("tooltip");
  if (/\bcallout\b/.test(html)) types.add("callout");
  if (/process-flow/.test(html)) types.add("process-flow");
  if (/feature-grid/.test(html)) types.add("feature-grid");
  if (/icon-grid\b/.test(html)) types.add("icon-grid");
  return types.size;
}

function countContentElements(html: string): number {
  // Count top-level content elements inside slide-inner
  const innerMatch = html.match(/<div class="slide-inner">([\s\S]*?)<\/div>\s*<div class="slide-footer"/);
  if (!innerMatch) return 0;
  const inner = innerMatch[1];

  // Count direct children: divs, h2, h3, p, ul, svg, etc.
  const tags = inner.match(/<(?:div|h[1-6]|p|ul|ol|svg|section|nav|table)\s/gi);
  return tags ? tags.length : 0;
}

function countChartTypes(html: string): Set<string> {
  const types = new Set<string>();
  for (const cls of CHART_CLASSES) {
    const regex = new RegExp(`class="[^"]*\\b${escapeRegex(cls)}\\b`, "i");
    if (regex.test(html)) types.add(cls);
  }
  return types;
}

function getDensityRange(target: "sparse" | "standard" | "rich"): { min: number; max: number } {
  switch (target) {
    case "sparse": return { min: 2, max: 5 };
    case "standard": return { min: 4, max: 8 };
    case "rich": return { min: 6, max: 10 };
  }
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
