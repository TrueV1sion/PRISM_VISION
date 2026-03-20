/**
 * Blob Storage Wrapper
 *
 * Wraps @vercel/blob for dataset snapshot storage.
 * Used by Phase 3 (Dataset Pipeline) to store bulk government dataset snapshots.
 */

// NOTE: @vercel/blob must be installed before using this module.
// Run: npm install @vercel/blob

export interface SnapshotMetadata {
  sourceId: string;
  sourceName: string;
  format: string;
  recordCount: number;
  snapshotAt: string;
}

export interface UploadResult {
  blobUrl: string;
  sizeBytes: number;
  metadata: SnapshotMetadata;
}

/**
 * Upload a dataset snapshot to Vercel Blob storage.
 * Returns the blob URL for storage in DatasetSnapshot.blobUrl.
 */
export async function uploadDatasetSnapshot(
  sourceId: string,
  buffer: Buffer,
  metadata: Omit<SnapshotMetadata, "sourceId">,
): Promise<UploadResult> {
  // Lazy import to avoid build failures when @vercel/blob isn't installed yet
  const { put } = await import("@vercel/blob");

  const filename = `datasets/${sourceId}/${metadata.snapshotAt.replace(/[:.]/g, "-")}.${metadata.format}`;

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: getContentType(metadata.format),
    addRandomSuffix: false,
  });

  return {
    blobUrl: blob.url,
    sizeBytes: buffer.length,
    metadata: { sourceId, ...metadata },
  };
}

/**
 * Get a download URL for a snapshot. For Vercel Blob, the URL is directly
 * accessible so this is a pass-through — but the wrapper allows future
 * migration to signed URLs if needed.
 */
export function getSnapshotUrl(blobUrl: string): string {
  return blobUrl;
}

/**
 * Delete a snapshot from blob storage.
 */
export async function deleteSnapshot(blobUrl: string): Promise<void> {
  const { del } = await import("@vercel/blob");
  await del(blobUrl);
}

function getContentType(format: string): string {
  switch (format) {
    case "csv": return "text/csv";
    case "json": return "application/json";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default: return "application/octet-stream";
  }
}
