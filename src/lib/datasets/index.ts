/**
 * Dataset Pipeline — Barrel Exports
 *
 * Government dataset snapshot-and-diff pipeline for detecting changes
 * across CMS, FDA, DEA, and other federal data sources.
 */

export { DATASET_REGISTRY, type DatasetSourceConfig } from "./registry";
export { downloadAndSnapshot, snapshotAllDatasets } from "./downloader";
export { diffSnapshots, type DeltaRecord } from "./differ";
export { indexSnapshot, type IndexedSnapshot } from "./indexer";
