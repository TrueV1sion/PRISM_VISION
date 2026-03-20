// src/lib/signals/sentinel.ts
/**
 * SENTINEL — Autonomous Cross-Source Monitoring
 *
 * Runs a single monitoring cycle: correlates recent data sources
 * against all predefined patterns, emits signals and alerts for
 * detected patterns. Called by the cron job every 6 hours.
 */

import { SignalCorrelator } from "./correlator";
import { SignalEmitter } from "./emitter";
import { CORRELATION_PATTERNS } from "./patterns";

export interface SentinelResult {
  correlationWindowHours: number;
  patternsEvaluated: number;
  candidatesFound: number;
  signalsCreated: number;
  alertsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
}

/**
 * Run a single SENTINEL monitoring cycle.
 * Called by the cron job every 6 hours.
 */
export async function runSentinel(
  windowHours: number = 24,
): Promise<SentinelResult> {
  const errors: string[] = [];

  const correlator = new SignalCorrelator();
  const emitter = new SignalEmitter();

  let candidates;
  try {
    candidates = await correlator.correlate(windowHours);
  } catch (error) {
    return {
      correlationWindowHours: windowHours,
      patternsEvaluated: 0,
      candidatesFound: 0,
      signalsCreated: 0,
      alertsCreated: 0,
      duplicatesSkipped: 0,
      errors: [
        `Correlation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  let emitResult;
  try {
    emitResult = await emitter.emit(candidates);
  } catch (error) {
    errors.push(
      `Emission failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    emitResult = { signalsCreated: 0, alertsCreated: 0, duplicatesSkipped: 0 };
  }

  return {
    correlationWindowHours: windowHours,
    patternsEvaluated: CORRELATION_PATTERNS.length,
    candidatesFound: candidates.length,
    signalsCreated: emitResult.signalsCreated,
    alertsCreated: emitResult.alertsCreated,
    duplicatesSkipped: emitResult.duplicatesSkipped,
    errors,
  };
}
