/**
 * Entity Extraction
 *
 * Regex-based entity extraction from feed item titles and summaries.
 * Extracts companies, drugs, regulation IDs, agencies, and financial amounts.
 *
 * Designed for speed over precision — false positives are acceptable
 * since entities are used for search/correlation, not authoritative tagging.
 */

export interface ExtractedEntities {
  companies: string[];
  drugs: string[];
  regulations: string[];
  agencies: string[];
  amounts: string[];
}

// ─── Company Patterns ──────────────────────────────────────────

/** Top 50 pharmaceutical / healthcare companies (case-insensitive match) */
const PHARMA_COMPANIES = [
  "Pfizer", "Johnson & Johnson", "Roche", "Novartis", "Merck",
  "AbbVie", "Eli Lilly", "Bristol-Myers Squibb", "AstraZeneca", "Amgen",
  "Gilead", "Sanofi", "GSK", "GlaxoSmithKline", "Bayer",
  "Novo Nordisk", "Regeneron", "Moderna", "Vertex", "Biogen",
  "Takeda", "Boehringer Ingelheim", "Astellas", "Daiichi Sankyo", "Eisai",
  "Teva", "Viatris", "Bausch Health", "Jazz Pharmaceuticals", "Alexion",
  "Incyte", "BioMarin", "Seagen", "Illumina", "Edwards Lifesciences",
  "Intuitive Surgical", "Medtronic", "Abbott", "Becton Dickinson", "Stryker",
  "Baxter", "Boston Scientific", "Zimmer Biomet", "Cardinal Health", "McKesson",
  "CVS Health", "UnitedHealth", "Cigna", "Anthem", "Humana",
];

/**
 * Build a case-insensitive regex alternation from the company list.
 * Escaped to handle special characters like '&' and parentheses.
 */
const companyPattern = new RegExp(
  `\\b(${PHARMA_COMPANIES.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

// ─── Drug Name Patterns ────────────────────────────────────────

/**
 * Common drug name suffixes from INN (International Nonproprietary Names).
 * Matches capitalized words ending in these suffixes.
 * Examples: trastuzumab, pembrolizumab, semaglutide, atorvastatin, lisinopril
 */
const DRUG_SUFFIXES = [
  "mab", "nib", "tide", "stat", "pril", "sartan", "olol", "pine",
  "azole", "cillin", "mycin", "cycline", "vir", "navir", "prazole",
  "lukast", "gliptin", "flozin", "zumab", "ximab", "mumab", "tinib",
  "rafenib", "ciclib", "lisib", "parin", "platin", "taxel", "mide",
  "semide", "thiazide", "barb", "pam", "lam", "done", "fentanil",
];

const drugSuffixPattern = new RegExp(
  `\\b[A-Z][a-z]+(${DRUG_SUFFIXES.join("|")})\\b`,
  "g",
);

/**
 * Also match all-caps drug brand names that appear in headlines.
 * Must be at least 4 chars to reduce false positives.
 */
const brandNamePattern = /\b(?:HUMIRA|KEYTRUDA|REVLIMID|ELIQUIS|OPDIVO|IMBRUVICA|STELARA|OZEMPIC|WEGOVY|MOUNJARO|DUPIXENT|TRULICITY|JARDIANCE|XARELTO|ENTRESTO|EYLEA|DARZALEX|TECVAYLI|TALVEY|EPKINLY|COLUMVI)\b/gi;

// ─── Regulation Patterns ───────────────────────────────────────

/** U.S. legislative/regulation ID patterns */
const regulationPatterns = [
  /\bH\.?\s*R\.?\s*\d{1,5}\b/g,                     // H.R. 123 / HR 123
  /\bS\.?\s*\d{1,5}\b/g,                              // S. 123 / S 123
  /\bP\.?\s*L\.?\s*\d{2,3}-\d{1,4}\b/g,              // P.L. 117-169
  /\b\d{2}\s*CFR\s*(?:Part\s*)?\d+/gi,               // 42 CFR Part 422
  /\bCMS-\d{4}-[A-Z]{1,3}\b/g,                       // CMS-4201-F
  /\bFR\s+Doc\.\s*\d{4}-\d{5,6}\b/g,                 // FR Doc. 2024-12345
];

// ─── Agency Patterns ───────────────────────────────────────────

const AGENCIES = [
  "FDA", "CMS", "HHS", "NIH", "CDC", "OIG", "OCR", "AHRQ",
  "HRSA", "SAMHSA", "CMMI", "ONC", "DEA", "FTC", "DOJ",
  "VA", "GAO", "CBO", "OMB", "OSHA",
];

const agencyPattern = new RegExp(
  `\\b(${AGENCIES.join("|")})\\b`,
  "g",
);

// ─── Financial Amount Patterns ─────────────────────────────────

/** Matches dollar amounts: $1.2 billion, $500 million, $2.3B, $500M */
const amountPattern = /\$[\d,.]+\s*(?:billion|million|trillion|B|M|T)\b/gi;

// ─── Extraction ────────────────────────────────────────────────

/**
 * Extract entities from the combined title + summary text of a feed item.
 * Returns deduplicated arrays for each entity type.
 */
export function extractEntities(text: string): ExtractedEntities {
  const companies = new Set<string>();
  const drugs = new Set<string>();
  const regulations = new Set<string>();
  const agencies = new Set<string>();
  const amounts = new Set<string>();

  // Companies
  for (const match of text.matchAll(companyPattern)) {
    companies.add(normalizeCompanyName(match[0]));
  }

  // Drugs — INN suffix matches
  for (const match of text.matchAll(drugSuffixPattern)) {
    drugs.add(match[0].toLowerCase());
  }

  // Drugs — known brand names
  for (const match of text.matchAll(brandNamePattern)) {
    drugs.add(match[0].toUpperCase());
  }

  // Regulations
  for (const pattern of regulationPatterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      regulations.add(match[0].replace(/\s+/g, " ").trim());
    }
  }

  // Agencies
  for (const match of text.matchAll(agencyPattern)) {
    agencies.add(match[0]);
  }

  // Financial amounts
  for (const match of text.matchAll(amountPattern)) {
    amounts.add(match[0]);
  }

  return {
    companies: [...companies],
    drugs: [...drugs],
    regulations: [...regulations],
    agencies: [...agencies],
    amounts: [...amounts],
  };
}

/**
 * Normalize company names to canonical form.
 * E.g., "PFIZER" -> "Pfizer", "johnson & johnson" -> "Johnson & Johnson"
 */
function normalizeCompanyName(raw: string): string {
  const lower = raw.toLowerCase();
  const found = PHARMA_COMPANIES.find((c) => c.toLowerCase() === lower);
  return found ?? raw;
}
