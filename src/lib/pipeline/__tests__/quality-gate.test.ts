import { describe, it, expect } from "vitest";
import {
  assertPresentationQuality,
  evaluatePresentationQuality,
  PresentationQualityError,
} from "../present/quality-gate";
import type { QualityScorecard } from "../present/types";

function makeScorecard(overrides?: Partial<QualityScorecard>): QualityScorecard {
  return {
    metrics: {
      classNameValidity: { score: 100, weight: 30, details: "" },
      structuralIntegrity: { score: 96, weight: 25, details: "" },
      chartAdoption: { score: 80, weight: 10, details: "" },
      animationVariety: { score: 90, weight: 10, details: "" },
      counterAdoption: { score: 70, weight: 5, details: "" },
      emergenceHierarchy: { score: 70, weight: 10, details: "" },
      sourceAttribution: { score: 100, weight: 10, details: "" },
      compositionCompliance: { score: 88, weight: 15, details: "" },
    },
    overall: 89,
    grade: "B+",
    perSlideIssues: [],
    ...overrides,
  };
}

describe("presentation quality gate", () => {
  it("passes strong decks", () => {
    const scorecard = makeScorecard();
    expect(evaluatePresentationQuality(scorecard)).toEqual({ passed: true, reasons: [] });
    expect(() => assertPresentationQuality(scorecard)).not.toThrow();
  });

  it("fails decks with blocking validator errors", () => {
    const scorecard = makeScorecard({
      perSlideIssues: [{ slideNumber: 2, severity: "error", message: "Missing required element: slide-footer" }],
    });

    const result = evaluatePresentationQuality(scorecard);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("blocking validation"))).toBe(true);
    expect(() => assertPresentationQuality(scorecard)).toThrow(PresentationQualityError);
  });

  it("fails decks that miss composition or overall thresholds", () => {
    const scorecard = makeScorecard({
      overall: 78,
      metrics: {
        ...makeScorecard().metrics,
        compositionCompliance: { score: 64, weight: 15, details: "" },
      },
    });

    const result = evaluatePresentationQuality(scorecard);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("overall score"))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes("composition compliance"))).toBe(true);
  });
});
