/**
 * Clean Presentation Pipeline
 *
 * Single unified pipeline: Data Enrichment → Agent Generation → Finish
 *
 * Replaces the multi-mode orchestrator with a single clean flow:
 *   1. Enrich captured tool calls into structured datasets
 *   2. Generate slides via agent-presenter (agentic tool-use loop)
 *   3. Assemble → Validate → Review → Remediate → Finalize
 */

import { generatePresentationWithAgent } from "./present/agent-presenter";
import { enrichToolCalls } from "./present/enricher";
import { assemble } from "./present/assembler";
import { validate } from "./present/validator";
import { reviewDesign } from "./present/design-reviewer";
import { remediateSlides } from "./present/remediator";
import { finalize } from "./present/finalizer";
import { assertPresentationQuality } from "./present/quality-gate";
import { reviewDeckComposition } from "./present/composition-validator";
import type {
  SlideHTML,
  RemediationInput,
  DesignReview,
  PipelineTimings,
  DatasetRegistry,
} from "./present/types";
import type { PresentationResult, AgentResult } from "./types";
import type { PresentInput } from "./present";

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generate a masterclass HTML5 presentation from synthesis results.
 *
 * Flow: Enrich → Agent Generate → Assemble → Validate → Review → Remediate → Finalize
 */
export async function presentClean(
  input: PresentInput,
): Promise<PresentationResult> {
  const { emitEvent, runId } = input;
  const capturedCount = input.capturedCalls?.length ?? 0;

  console.log(
    `[pipeline] 🎬 Starting clean presentation pipeline — capturedCalls: ${capturedCount}`,
  );

  // ── Stage 1: Data Enrichment (best-effort) ────────────────────────────────

  let datasets: DatasetRegistry = { runId, datasets: [], entities: [] };
  if (capturedCount > 0) {
    try {
      datasets = enrichToolCalls(runId, input.capturedCalls ?? []);
      console.log(
        `[pipeline] Stage 1 Enriched ${datasets.datasets.length} datasets from ${capturedCount} captured calls`,
      );
    } catch (enrichErr) {
      console.warn(
        `[pipeline] Enrichment failed (non-blocking): ${enrichErr instanceof Error ? enrichErr.message : String(enrichErr)}`,
      );
    }
  }

  // ── Stage 2: Agent Generation ─────────────────────────────────────────────

  const generateStart = Date.now();

  emitEvent({
    type: "phase_change",
    phase: "PRESENT_GENERATING",
    message: `Generating presentation with agent presenter (${datasets.datasets.length} datasets)...`,
  });

  const { slides, manifest } = await generatePresentationWithAgent({
    runId,
    synthesis: input.synthesis,
    agentResults: input.agentResults,
    datasets,
    blueprint: input.blueprint,
    emitEvent,
  });

  const generateMs = Date.now() - generateStart;
  console.log(
    `[pipeline] Stage 2 Agent generation complete: ${slides.length} slides in ${generateMs}ms`,
  );

  // ── Stages 3-7: Assemble → Validate → Review → Remediate → Finalize ──────

  return finishPipeline(input, slides, manifest, generateMs);
}

// ─── Finish Pipeline ──────────────────────────────────────────────────────────

async function finishPipeline(
  input: PresentInput,
  slides: SlideHTML[],
  manifest: { title: string; subtitle: string; slides: { title: string; type: string }[] },
  generateMs: number,
): Promise<PresentationResult> {
  const { emitEvent } = input;
  const timings: { reviewMs?: number; remediateMs?: number } = {};

  // ── Stage 3: Assemble ───────────────────────────────────────────────────────

  const assembleStart = Date.now();
  const assemblerManifest = {
    title: manifest.title,
    subtitle: manifest.subtitle,
    totalSlides: manifest.slides.length,
    slides: manifest.slides.map((s, i) => ({
      slideNumber: i + 1,
      title: s.title ?? `Slide ${i + 1}`,
      type: (s.type ?? "data-metrics") as "data-metrics",
      templateId: null,
      purpose: "",
      agentSources: [] as string[],
      componentHints: [] as string[],
      animationType: "anim" as const,
      dataPoints: [],
    })),
  };
  const assemblerOutput = assemble({ slides, manifest: assemblerManifest });
  const assembleMs = Date.now() - assembleStart;

  console.log(
    `[pipeline] Stage 3 Assemble: ${assemblerOutput.slideCount} slides, ${assemblerOutput.html.length} chars in ${assembleMs}ms`,
  );

  // ── Stage 4: Validate ────────────────────────────────────────────────────────

  const validateStart = Date.now();
  let scorecard = validate(assemblerOutput.html);
  const validateMs = Date.now() - validateStart;

  console.log(
    `[pipeline] Stage 4 Validate: grade=${scorecard.grade}, score=${scorecard.overall} in ${validateMs}ms`,
  );

  // ── Stage 4b: Deck Composition Review ─────────────────────────────────────

  const slidesHtml = slides.map(s => s.html);
  const backgroundVariants = slides.map(s => {
    const bgMatch = s.html.match(/class="slide\s+([^"]*?)"/);
    if (!bgMatch) return "gradient-dark";
    const classes = bgMatch[1].split(/\s+/);
    return classes.find(c => c.startsWith("gradient-") || c.startsWith("dark-")) ?? "gradient-dark";
  });
  const deckReview = reviewDeckComposition(slidesHtml, backgroundVariants);

  console.log(
    `[pipeline] Deck composition: vocabulary=${deckReview.componentVocabulary}, ` +
    `animation=${deckReview.animationDiversity}, charts=${deckReview.chartTypeDiversity}, ` +
    `interactive=${deckReview.interactiveRichness}, overall=${deckReview.overallDesignScore}`,
  );

  // Emit quality report
  emitEvent({
    type: "quality_report",
    report: {
      totalFindings: input.agentResults.reduce((sum, ar) => sum + ar.findings.length, 0),
      sourcedFindings: input.agentResults
        .flatMap(ar => ar.findings)
        .filter(f => f.source && f.source.trim().length > 0).length,
      sourceCoveragePercent: 0,
      confidenceDistribution: {
        high: countByConf(input.agentResults, "HIGH"),
        medium: countByConf(input.agentResults, "MEDIUM"),
        low: countByConf(input.agentResults, "LOW"),
      },
      sourceTierDistribution: {
        primary: countByTier(input.agentResults, "PRIMARY"),
        secondary: countByTier(input.agentResults, "SECONDARY"),
        tertiary: countByTier(input.agentResults, "TERTIARY"),
      },
      emergenceYield: input.synthesis.emergentInsights.length,
      gapCount: input.agentResults.reduce((sum, ar) => sum + ar.gaps.length, 0),
      provenanceComplete: false,
      grade: scorecard.grade,
      overallScore: scorecard.overall,
    },
  });

  // ── Stages 5-6: Design Review + Remediation Loop ──────────────────────────

  let bestHtml = assemblerOutput.html;
  let bestScore = scorecard.overall;
  let remediationRounds = 0;
  let lastReview: DesignReview | null = null;
  const MAX_ITERATIONS = 2;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Stage 5: Design Review
    const reviewStart = Date.now();
    const review = await reviewDesign({
      html: bestHtml,
      manifest: assemblerManifest,
      scorecard,
    });
    timings.reviewMs = (timings.reviewMs ?? 0) + (Date.now() - reviewStart);

    if (review) {
      lastReview = review;
      console.log(
        `[pipeline] Stage 5 Design Review (iteration ${iteration + 1}): overallScore=${review.overallScore.toFixed(1)}`,
      );
    } else {
      console.warn(
        `[pipeline] Stage 5 Design Review unavailable on iteration ${iteration + 1}`,
      );
    }

    // Collect slides needing remediation
    const slidesToRemediate: RemediationInput[] = [];
    const reviewBySlide = new Map(
      (review?.slides ?? []).map(sr => [sr.slideNumber, sr] as const),
    );
    const slideNumbersToEvaluate = new Set<number>();

    for (const issue of scorecard.perSlideIssues) {
      if (issue.severity === "error" || issue.severity === "warning") {
        slideNumbersToEvaluate.add(issue.slideNumber);
      }
    }
    for (const slideReview of review?.slides ?? []) {
      if (slideReview.regenerate) {
        slideNumbersToEvaluate.add(slideReview.slideNumber);
      }
    }

    for (const slideNumber of [...slideNumbersToEvaluate].sort((a, b) => a - b)) {
      const validatorIssues = scorecard.perSlideIssues.filter(
        issue => issue.slideNumber === slideNumber,
      );
      const slideReview = reviewBySlide.get(slideNumber);
      const hasValidatorIssues = validatorIssues.some(
        issue => issue.severity === "error" || issue.severity === "warning",
      );
      const shouldRemediate = Boolean(slideReview?.regenerate) || hasValidatorIssues;

      if (!shouldRemediate) continue;

      const slideIdx = slides.findIndex(slide => slide.slideNumber === slideNumber);
      const slideMeta = assemblerManifest.slides[slideIdx];

      if (slideIdx >= 0 && slideMeta) {
        slidesToRemediate.push({
          slideNumber,
          slideType: slideMeta.type,
          templateId: null,
          componentHints: slideMeta.componentHints,
          originalHtml: slides[slideIdx].html,
          validatorIssues,
          reviewerFeedback: slideReview?.feedback,
          exemplarHtml: "",
          chartFragments: [],
          compositionViolations: [],
        });
      }
    }

    if (slidesToRemediate.length === 0) break;

    console.log(
      `[pipeline] Stage 6 Remediating ${slidesToRemediate.length} slides (iteration ${iteration + 1})...`,
    );

    // Stage 6: Remediate
    const remediateStart = Date.now();
    const remediated = await remediateSlides(slidesToRemediate);
    timings.remediateMs = (timings.remediateMs ?? 0) + (Date.now() - remediateStart);
    remediationRounds++;

    // Replace remediated slides
    for (const fixed of remediated) {
      const idx = slides.findIndex(s => s.slideNumber === fixed.slideNumber);
      if (idx >= 0) slides[idx] = fixed;
    }

    // Re-assemble and re-validate
    const reAssembled = assemble({ slides, manifest: assemblerManifest });
    const reScored = validate(reAssembled.html);

    console.log(
      `[pipeline] Stage 6 Remediation round ${remediationRounds}: score ${bestScore} → ${reScored.overall} (${reScored.grade})`,
    );

    if (reScored.overall >= bestScore) {
      bestHtml = reAssembled.html;
      bestScore = reScored.overall;
      scorecard = reScored;
    } else {
      console.warn(
        `[pipeline] Remediation regression (${reScored.overall} < ${bestScore}) — reverting`,
      );
      break;
    }
  }

  console.log(
    `[pipeline] QA complete: ${remediationRounds} remediation round(s), final score=${bestScore} (${scorecard.grade})`,
  );

  assertPresentationQuality(scorecard);

  // ── Stage 7: Finalize ─────────────────────────────────────────────────────

  const pipelineTimings: PipelineTimings = {
    planMs: 0,
    chartCompileMs: 0,
    generateMs,
    assembleMs,
    validateMs,
    reviewMs: timings.reviewMs ?? 0,
    remediateMs: timings.remediateMs ?? 0,
    finalizeMs: 0,
    totalMs: 0,
  };

  const slideStructures = slides
    .filter(s => s.structure)
    .map(s => s.structure!);

  const finalizeStart = Date.now();
  const htmlPath = await finalize(
    bestHtml,
    input.runId,
    scorecard,
    lastReview,
    pipelineTimings,
    remediationRounds,
    slideStructures.length > 0 ? slideStructures : undefined,
  );
  pipelineTimings.finalizeMs = Date.now() - finalizeStart;
  pipelineTimings.totalMs =
    generateMs + assembleMs + validateMs +
    (timings.reviewMs ?? 0) + (timings.remediateMs ?? 0) + pipelineTimings.finalizeMs;

  console.log(
    `[pipeline] Pipeline complete in ${pipelineTimings.totalMs}ms — grade: ${scorecard.grade}`,
  );

  emitEvent({
    type: "presentation_complete",
    title: manifest.title,
    slideCount: assemblerOutput.slideCount,
    htmlPath,
  });

  // Read back finalized HTML
  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const finalizedHtml = readFileSync(resolve(process.cwd(), htmlPath), "utf-8");

  return {
    html: finalizedHtml,
    htmlPath: `/decks/${input.runId}.html`,
    title: manifest.title,
    subtitle: manifest.subtitle,
    slideCount: assemblerOutput.slideCount,
    slideStructures: slideStructures.length > 0 ? slideStructures : undefined,
    quality: { overall: scorecard.overall, grade: scorecard.grade },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countByConf(results: AgentResult[], level: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter(f => f.confidence === level).length,
    0,
  );
}

function countByTier(results: AgentResult[], tier: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter(f => f.sourceTier === tier).length,
    0,
  );
}
