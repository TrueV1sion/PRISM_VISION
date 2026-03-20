/**
 * Dataset Source Registry
 *
 * Defines the 12 government datasets that the snapshot-and-diff pipeline
 * monitors for changes. Each entry maps to a DatasetSource Prisma record
 * and drives the downloader + differ pipeline.
 */

// ─── Types ────────────────────────────────────────────────────

export interface DatasetSourceConfig {
  url: string;
  name: string;
  format: "csv" | "json" | "xlsx";
  category: string;
  entityKeyField: string;
  compareFields: string[];
  pollSchedule: "daily" | "weekly" | "monthly";
  description: string;
}

// ─── Registry ─────────────────────────────────────────────────

export const DATASET_REGISTRY: DatasetSourceConfig[] = [
  // 1. CMS Change of Ownership (CHOW)
  {
    url: "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities/data",
    name: "CMS CHOW (Change of Ownership)",
    format: "csv",
    category: "cms",
    entityKeyField: "PRVDR_NUM",
    compareFields: ["GNRL_CNTL_TYPE_CD", "CITY_NAME", "STATE_CD", "PRVDR_CTGRY_CD"],
    pollSchedule: "weekly",
    description:
      "Provider of Services file tracking hospital and facility ownership changes. " +
      "Detects M&A activity, ownership type transitions, and geographic shifts.",
  },

  // 2. CMS Star Ratings
  {
    url: "https://data.cms.gov/provider-data/dataset/xubh-q36u",
    name: "CMS Star Ratings",
    format: "csv",
    category: "cms",
    entityKeyField: "Facility ID",
    compareFields: ["Overall Rating", "Mortality Rating", "Safety Rating", "Patient Experience Rating"],
    pollSchedule: "monthly",
    description:
      "Hospital star ratings from CMS Hospital Compare. Tracks quality score changes " +
      "that signal operational improvements or degradations.",
  },

  // 3. Medicare Advantage Enrollment
  {
    url: "https://data.cms.gov/summary-statistics-on-beneficiary-enrollment/ma-enrollment/ma-state-county-enrollment",
    name: "MA Enrollment",
    format: "csv",
    category: "cms",
    entityKeyField: "Contract Number",
    compareFields: ["Enrollment", "Penetration"],
    pollSchedule: "monthly",
    description:
      "Medicare Advantage state/county enrollment data. Tracks plan growth, " +
      "market penetration shifts, and competitive dynamics by geography.",
  },

  // 4. CMS Open Payments
  {
    url: "https://openpaymentsdata.cms.gov/dataset/general-payments",
    name: "CMS Open Payments",
    format: "csv",
    category: "cms",
    entityKeyField: "Record_ID",
    compareFields: [
      "Total_Amount_of_Payment_USDollars",
      "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
    ],
    pollSchedule: "monthly",
    description:
      "General payments from manufacturers to physicians and teaching hospitals. " +
      "Detects payment pattern shifts and new manufacturer-physician relationships.",
  },

  // 5. Hospital Compare
  {
    url: "https://data.cms.gov/provider-data/dataset/xubh-q36u",
    name: "Hospital Compare",
    format: "csv",
    category: "cms",
    entityKeyField: "Facility ID",
    compareFields: [
      "Hospital overall rating",
      "Mortality national comparison",
      "Safety of care national comparison",
    ],
    pollSchedule: "monthly",
    description:
      "Hospital quality comparison data from CMS. Tracks overall ratings and " +
      "national comparison metrics for mortality and safety.",
  },

  // 6. Medicare Plan Finder
  {
    url: "https://data.cms.gov/Medicare-Enrollment/Medicare-Plan-Finder/data",
    name: "Medicare Plan Finder",
    format: "csv",
    category: "cms",
    entityKeyField: "Plan ID",
    compareFields: ["Plan Name", "Monthly Premium", "Star Rating"],
    pollSchedule: "monthly",
    description:
      "Medicare plan offerings including premiums and star ratings. " +
      "Detects pricing changes, plan name changes, and rating shifts.",
  },

  // 7. Provider Enrollment
  {
    url: "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-fee-for-service-public-provider-enrollment",
    name: "Provider Enrollment",
    format: "csv",
    category: "cms",
    entityKeyField: "NPI",
    compareFields: ["Provider Type", "State", "Enrollment Status"],
    pollSchedule: "weekly",
    description:
      "Medicare fee-for-service provider enrollment records. Tracks new enrollments, " +
      "provider type changes, and geographic mobility.",
  },

  // 8. Medicare Cost Reports
  {
    url: "https://data.cms.gov/provider-compliance/cost-report/hospital-provider-cost-report",
    name: "Medicare Cost Reports",
    format: "csv",
    category: "cms",
    entityKeyField: "Provider CCN",
    compareFields: ["Total Costs", "Total Revenue", "Net Income"],
    pollSchedule: "monthly",
    description:
      "Hospital provider cost report data. Tracks financial performance changes " +
      "including cost trends, revenue shifts, and margin movements.",
  },

  // 9. PECOS (Order and Referring)
  {
    url: "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/order-and-referring/data",
    name: "PECOS (Order & Referring)",
    format: "csv",
    category: "cms",
    entityKeyField: "NPI",
    compareFields: ["Last Name", "State", "Specialty"],
    pollSchedule: "weekly",
    description:
      "Provider Enrollment, Chain, and Ownership System order/referring data. " +
      "Tracks specialty changes, state relocations, and new provider entries.",
  },

  // 10. FDA NDC Directory
  {
    url: "https://download.open.fda.gov/drug/ndc/drug-ndc-0001-of-0001.json",
    name: "FDA NDC Directory",
    format: "json",
    category: "fda",
    entityKeyField: "product_ndc",
    compareFields: ["brand_name", "generic_name", "labeler_name", "marketing_category"],
    pollSchedule: "monthly",
    description:
      "National Drug Code directory with product information. Detects new drug listings, " +
      "brand/generic name changes, labeler transfers, and marketing category shifts.",
  },

  // 11. DEA ARCOS
  {
    url: "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/report_yr_2022.pdf",
    name: "DEA ARCOS",
    format: "csv",
    category: "dea",
    entityKeyField: "drug_code",
    compareFields: ["total_grams", "total_orders"],
    pollSchedule: "monthly",
    description:
      "Automation of Reports and Consolidated Orders System retail drug summary. " +
      "Tracks controlled substance distribution volumes and order patterns.",
  },

  // 12. Physician Compare
  {
    url: "https://data.cms.gov/provider-data/dataset/mj5m-pzi6",
    name: "Physician Compare",
    format: "csv",
    category: "cms",
    entityKeyField: "NPI",
    compareFields: ["Primary specialty", "Organization legal name", "City", "State"],
    pollSchedule: "monthly",
    description:
      "Physician-level data including specialty and organizational affiliation. " +
      "Detects specialty changes, group practice movements, and geographic shifts.",
  },
];
