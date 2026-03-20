/**
 * Dataset Snapshot Indexer
 *
 * Extracts entity key fields and comparison fields from raw dataset records
 * into an indexed Map for efficient diffing. Includes parsers for CSV and JSON
 * formats used by government data sources.
 */

// ─── Types ────────────────────────────────────────────────────

export interface IndexedSnapshot {
  index: Map<string, Record<string, string>>;
  recordCount: number;
}

// ─── Index Builder ────────────────────────────────────────────

/**
 * Build an indexed snapshot from raw records.
 * Extracts the entity key field and comparison fields into a Map
 * keyed by entity key value → { field: stringValue }.
 *
 * Records missing the entity key field are silently skipped.
 * All values are coerced to strings for uniform comparison.
 */
export function indexSnapshot(
  records: Record<string, unknown>[],
  entityKeyField: string,
  compareFields: string[],
): IndexedSnapshot {
  const index = new Map<string, Record<string, string>>();

  for (const record of records) {
    const keyValue = record[entityKeyField];
    if (keyValue === null || keyValue === undefined || keyValue === "") {
      continue;
    }

    const key = String(keyValue).trim();
    if (key === "") continue;

    const fieldValues: Record<string, string> = {};
    for (const field of compareFields) {
      const raw = record[field];
      fieldValues[field] = raw === null || raw === undefined ? "" : String(raw).trim();
    }

    // If duplicate key, last-write-wins (consistent with how datasets
    // are typically structured — last row for a key is the most current)
    index.set(key, fieldValues);
  }

  return { index, recordCount: index.size };
}

// ─── CSV Parser ───────────────────────────────────────────────

/**
 * Parse CSV content into an array of records.
 * Handles quoted fields (including embedded commas and newlines within quotes),
 * and strips BOM if present.
 *
 * This is a lightweight parser suitable for well-formed government CSV files.
 * For extremely large files (>100MB), consider streaming instead.
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  // Strip BOM
  const content = csvContent.charCodeAt(0) === 0xfeff ? csvContent.slice(1) : csvContent;

  const rows = parseCSVRows(content);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip completely empty rows
    if (row.length === 1 && row[0].trim() === "") continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < row.length ? row[j].trim() : "";
    }
    records.push(record);
  }

  return records;
}

/**
 * Low-level CSV row parser that handles quoted fields with embedded
 * commas, newlines, and escaped double-quotes ("").
 */
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        // Look ahead: "" is an escaped quote, otherwise end of quoted field
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\r") {
        // Handle \r\n or bare \r
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < content.length && content[i] === "\n") {
          i++;
        }
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Final field/row
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// ─── JSON Parser ──────────────────────────────────────────────

/**
 * Parse JSON content into an array of records.
 * Handles both direct arrays and common wrapper patterns:
 * - Direct array: [{ ... }, { ... }]
 * - Wrapped: { "results": [...] } or { "data": [...] }
 */
export function parseJSON(jsonContent: string): Record<string, unknown>[] {
  const parsed = JSON.parse(jsonContent);

  // Direct array
  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }

  // Common wrapper patterns
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // Try common wrapper keys
    for (const key of ["results", "data", "items", "records", "rows"]) {
      if (Array.isArray(obj[key])) {
        return obj[key] as Record<string, unknown>[];
      }
    }

    // Single-object response — wrap in array
    return [obj];
  }

  return [];
}
