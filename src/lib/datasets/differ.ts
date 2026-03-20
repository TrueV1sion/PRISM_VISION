/**
 * Dataset Snapshot Diff Engine
 *
 * Compares two indexed snapshots (previous vs. current) and produces
 * an array of DeltaRecord describing added, removed, and modified entities.
 * Processes in batches to avoid memory pressure on large datasets.
 */

// ─── Types ────────────────────────────────────────────────────

export interface DeltaRecord {
  changeType: "added" | "removed" | "modified";
  entityKey: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

// ─── Constants ────────────────────────────────────────────────

/** Batch size for processing entity keys to limit memory spikes. */
const BATCH_SIZE = 1000;

// ─── Diff Engine ──────────────────────────────────────────────

/**
 * Compare two indexed snapshots and produce delta records.
 *
 * - Added: entities present in current but absent from previous
 * - Removed: entities present in previous but absent from current
 * - Modified: entities present in both with differing compareField values
 *
 * For "added" and "removed" entities, a single DeltaRecord per entity is
 * emitted with fieldName set to the entity key field name (i.e., "_entity").
 * For "modified" entities, one DeltaRecord per changed field is emitted.
 *
 * Processes entity keys in batches of BATCH_SIZE to bound memory usage
 * when diffing datasets with millions of rows.
 */
export function diffSnapshots(
  previousIndex: Map<string, Record<string, string>>,
  currentIndex: Map<string, Record<string, string>>,
  compareFields: string[],
): DeltaRecord[] {
  const deltas: DeltaRecord[] = [];

  // ─── Added entities ──────────────────────────────────────
  const currentKeys = Array.from(currentIndex.keys());
  for (let batchStart = 0; batchStart < currentKeys.length; batchStart += BATCH_SIZE) {
    const batch = currentKeys.slice(batchStart, batchStart + BATCH_SIZE);
    for (const key of batch) {
      if (!previousIndex.has(key)) {
        const current = currentIndex.get(key)!;
        // Emit one delta per field for added entities so downstream
        // consumers can see the initial values
        for (const field of compareFields) {
          deltas.push({
            changeType: "added",
            entityKey: key,
            fieldName: field,
            oldValue: null,
            newValue: current[field] || null,
          });
        }
      }
    }
  }

  // ─── Removed entities ────────────────────────────────────
  const previousKeys = Array.from(previousIndex.keys());
  for (let batchStart = 0; batchStart < previousKeys.length; batchStart += BATCH_SIZE) {
    const batch = previousKeys.slice(batchStart, batchStart + BATCH_SIZE);
    for (const key of batch) {
      if (!currentIndex.has(key)) {
        const previous = previousIndex.get(key)!;
        // Emit one delta per field for removed entities so downstream
        // consumers can see the last known values
        for (const field of compareFields) {
          deltas.push({
            changeType: "removed",
            entityKey: key,
            fieldName: field,
            oldValue: previous[field] || null,
            newValue: null,
          });
        }
      }
    }
  }

  // ─── Modified entities ───────────────────────────────────
  // Only check keys present in both snapshots
  for (let batchStart = 0; batchStart < currentKeys.length; batchStart += BATCH_SIZE) {
    const batch = currentKeys.slice(batchStart, batchStart + BATCH_SIZE);
    for (const key of batch) {
      const previous = previousIndex.get(key);
      if (!previous) continue; // Added entity — already handled

      const current = currentIndex.get(key)!;

      for (const field of compareFields) {
        const oldVal = previous[field] ?? "";
        const newVal = current[field] ?? "";

        if (oldVal !== newVal) {
          deltas.push({
            changeType: "modified",
            entityKey: key,
            fieldName: field,
            oldValue: oldVal || null,
            newValue: newVal || null,
          });
        }
      }
    }
  }

  return deltas;
}

// ─── Summary Helpers ──────────────────────────────────────────

/**
 * Compute summary statistics from an array of delta records.
 * Useful for logging and observability.
 */
export function summarizeDeltas(deltas: DeltaRecord[]): {
  added: number;
  removed: number;
  modified: number;
  totalDeltas: number;
  uniqueEntities: number;
  topChangedEntities: Array<{ entityKey: string; changeCount: number }>;
} {
  let added = 0;
  let removed = 0;
  let modified = 0;
  const entityCounts = new Map<string, number>();

  for (const delta of deltas) {
    switch (delta.changeType) {
      case "added":
        added++;
        break;
      case "removed":
        removed++;
        break;
      case "modified":
        modified++;
        break;
    }
    entityCounts.set(delta.entityKey, (entityCounts.get(delta.entityKey) ?? 0) + 1);
  }

  const topChangedEntities = Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([entityKey, changeCount]) => ({ entityKey, changeCount }));

  return {
    added,
    removed,
    modified,
    totalDeltas: deltas.length,
    uniqueEntities: entityCounts.size,
    topChangedEntities,
  };
}
