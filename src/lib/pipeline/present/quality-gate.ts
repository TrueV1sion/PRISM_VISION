import type { QualityScorecard } from "./types";

const MIN_OVERALL_SCORE = 85;
const MIN_COMPOSITION_SCORE = 80;
const MIN_STRUCTURAL_SCORE = 90;

export interface QualityGateResult {
  passed: boolean;
  reasons: string[];
}

export class PresentationQualityError extends Error {
  public readonly scorecard: QualityScorecard;
  public readonly reasons: string[];

  constructor(scorecard: QualityScorecard, reasons: string[]) {
    super(`Presentation quality gate failed: ${reasons.join("; ")}`);
    this.name = "PresentationQualityError";
    this.scorecard = scorecard;
    this.reasons = reasons;
  }
}

export function evaluatePresentationQuality(scorecard: QualityScorecard): QualityGateResult {
  const reasons: string[] = [];
  const errorCount = scorecard.perSlideIssues.filter((issue) => issue.severity === "error").length;
  const compositionScore = scorecard.metrics.compositionCompliance?.score ?? 100;

  if (errorCount > 0) {
    reasons.push(`${errorCount} blocking validation issue(s) remain`);
  }

  if (scorecard.overall < MIN_OVERALL_SCORE) {
    reasons.push(`overall score ${scorecard.overall} is below ${MIN_OVERALL_SCORE}`);
  }

  if (compositionScore < MIN_COMPOSITION_SCORE) {
    reasons.push(`composition compliance ${compositionScore} is below ${MIN_COMPOSITION_SCORE}`);
  }

  if (scorecard.metrics.structuralIntegrity.score < MIN_STRUCTURAL_SCORE) {
    reasons.push(
      `structural integrity ${scorecard.metrics.structuralIntegrity.score} is below ${MIN_STRUCTURAL_SCORE}`,
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

export function assertPresentationQuality(scorecard: QualityScorecard): void {
  const result = evaluatePresentationQuality(scorecard);
  if (!result.passed) {
    throw new PresentationQualityError(scorecard, result.reasons);
  }
}
