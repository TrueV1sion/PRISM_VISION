// src/lib/data-sources/research/provider-quality.ts
/**
 * research_provider_quality — Layer 3 Intelligence Tool
 *
 * Compound research tool that aggregates hospital quality scores,
 * Leapfrog safety grades, and CMS Open Payments data for a comprehensive
 * view of healthcare provider quality and financial relationships.
 * Makes 3+ parallel Layer 1 API calls per invocation.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { LAYER_3_CHAR_BUDGET } from "../types";
import {
  intelligenceHeader,
  markdownTable,
  formatCitations,
  formatNumber,
  truncateToCharBudget,
} from "../format";

// Forward-safe imports: clients may not exist yet during
// vertical slice development. Loaded lazily on first call.

type HospitalCompareClientType = typeof import("../clients/hospital-compare").hospitalCompareClient;
type LeapfrogClientType = typeof import("../clients/leapfrog").leapfrogClient;
type CmsOpenPaymentsClientType = typeof import("../clients/cms-open-payments").cmsOpenPaymentsClient;

let hospitalCompareClientRef: HospitalCompareClientType | null | undefined;
let leapfrogClientRef: LeapfrogClientType | null | undefined;
let cmsOpenPaymentsClientRef: CmsOpenPaymentsClientType | null | undefined;

async function getHospitalCompareClient(): Promise<HospitalCompareClientType | null> {
  if (hospitalCompareClientRef !== undefined) return hospitalCompareClientRef;
  try {
    const mod = await import("../clients/hospital-compare");
    hospitalCompareClientRef = mod.hospitalCompareClient;
  } catch {
    hospitalCompareClientRef = null;
  }
  return hospitalCompareClientRef;
}

async function getLeapfrogClient(): Promise<LeapfrogClientType | null> {
  if (leapfrogClientRef !== undefined) return leapfrogClientRef;
  try {
    const mod = await import("../clients/leapfrog");
    leapfrogClientRef = mod.leapfrogClient;
  } catch {
    leapfrogClientRef = null;
  }
  return leapfrogClientRef;
}

async function getCmsOpenPaymentsClient(): Promise<CmsOpenPaymentsClientType | null> {
  if (cmsOpenPaymentsClientRef !== undefined) return cmsOpenPaymentsClientRef;
  try {
    const mod = await import("../clients/cms-open-payments");
    cmsOpenPaymentsClientRef = mod.cmsOpenPaymentsClient;
  } catch {
    cmsOpenPaymentsClientRef = null;
  }
  return cmsOpenPaymentsClientRef;
}

export const providerQualityResearchTool: DataSourceTool = {
  name: "research_provider_quality",
  description:
    "Comprehensive provider quality intelligence: hospital quality measures, " +
    "patient safety grades, patient experience scores, and industry payment data. " +
    "Makes multiple API calls and returns a cross-referenced intelligence packet.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Hospital name, provider ID, or state to investigate" },
      state: { type: "string", description: "Two-letter state code for regional analysis" },
      focus: { type: "string", description: "Optional focus area: 'quality', 'safety', 'payments'" },
    },
    required: ["query"],
  },
  layer: 3,
  sources: ["hospital-compare", "leapfrog", "cms-open-payments"],
  routingTags: ["quality", "hospital", "provider", "safety", "benchmarking"],

  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const query = input.query as string;
    const state = input.state as string | undefined;

    // ─── Resolve clients ─────────────────────────────────────────
    const [hcClient, lfClient, opClient] = await Promise.all([
      getHospitalCompareClient(),
      getLeapfrogClient(),
      getCmsOpenPaymentsClient(),
    ]);

    // ─── Parallel API calls ──────────────────────────────────────
    const [hospitalResult, safetyResult, paymentsResult] = await Promise.all([
      hcClient
        ? hcClient.searchHospitals({ query, state, limit: 10 })
            .catch(() => null)
        : null,
      lfClient
        ? lfClient.searchHospitalGrades({ query, state, limit: 10 })
            .catch(() => null)
        : null,
      opClient
        ? opClient.searchPayments({ query, limit: 10 })
            .catch(() => null)
        : null,
    ]);

    // ─── Extract insights ────────────────────────────────────────
    const hospitals = hospitalResult?.data?.results ?? [];
    const totalHospitals = hospitalResult?.data?.total ?? 0;

    const safetyGrades = safetyResult?.data?.results ?? [];
    const totalSafety = safetyResult?.data?.total ?? 0;

    const payments = paymentsResult?.data?.results ?? [];
    const totalPayments = paymentsResult?.data?.total ?? 0;

    // Calculate aggregate payment amount
    const totalPaymentAmount = payments.reduce((sum, r) => {
      const amt = Number(
        String(r.total_amount_of_payment_usdollars ?? r.amount ?? "0").replace(/[$,]/g, ""),
      ) || 0;
      return sum + amt;
    }, 0);

    // Summarize ratings distribution
    const ratingCounts: Record<string, number> = {};
    for (const h of hospitals) {
      const rating = String(h.hospital_overall_rating ?? h.overall_rating ?? "Not Rated");
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
    }

    // Summarize safety grades
    const gradeCounts: Record<string, number> = {};
    for (const g of safetyGrades) {
      const grade = String(g.safety_grade ?? g.grade ?? g.letter_grade ?? "Unknown");
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }

    // ─── Confidence scoring ──────────────────────────────────────
    let sourcesReturned = 0;
    let sourcesQueried = 0;
    if (hcClient) { sourcesQueried++; if (totalHospitals > 0) sourcesReturned++; }
    if (lfClient) { sourcesQueried++; if (totalSafety > 0) sourcesReturned++; }
    if (opClient) { sourcesQueried++; if (totalPayments > 0) sourcesReturned++; }

    if (sourcesQueried === 0) sourcesQueried = 3;

    const confidence: "HIGH" | "MEDIUM" | "LOW" =
      sourcesReturned >= 3 ? "HIGH" : sourcesReturned >= 2 ? "MEDIUM" : "LOW";

    // ─── Build intelligence packet ───────────────────────────────
    const sections: string[] = [];

    const vintage = hospitalResult?.vintage?.queriedAt?.slice(0, 10)
      ?? safetyResult?.vintage?.queriedAt?.slice(0, 10)
      ?? new Date().toISOString().slice(0, 10);

    sections.push(intelligenceHeader({
      topic: "Provider Quality",
      subject: query,
      confidence,
      sourcesQueried,
      sourcesReturned,
      vintage,
    }));

    // Key Intelligence bullets
    const bullets: string[] = [];
    if (totalHospitals > 0) {
      bullets.push(`- **${formatNumber(totalHospitals)}** hospitals found matching "${query}"`);
      const ratingDist = Object.entries(ratingCounts)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([rating, count]) => `${rating}-star: ${count}`)
        .join(", ");
      if (ratingDist) bullets.push(`- CMS star ratings: ${ratingDist}`);
    }
    if (totalSafety > 0) {
      const gradeDist = Object.entries(gradeCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([grade, count]) => `${grade}: ${count}`)
        .join(", ");
      bullets.push(`- Leapfrog safety grades: ${gradeDist}`);
    }
    if (totalPayments > 0) {
      bullets.push(`- **$${formatNumber(totalPaymentAmount)}** in industry payments across **${formatNumber(totalPayments)}** records`);
    }
    sections.push(`### Key Intelligence\n${bullets.join("\n")}`);

    // Hospital quality table
    if (hospitals.length > 0) {
      const hospitalRows = hospitals.slice(0, 5).map((h) => [
        String(h.hospital_name ?? h.name ?? "Unknown").slice(0, 35),
        String(h.city ?? "—"),
        String(h.state ?? "—"),
        String(h.hospital_overall_rating ?? h.overall_rating ?? "—"),
        String(h.hospital_type ?? "—").slice(0, 20),
      ]);
      sections.push(`### CMS Hospital Quality\n${markdownTable(["Hospital", "City", "State", "Rating", "Type"], hospitalRows, 5, totalHospitals)}`);
    }

    // Safety grades table
    if (safetyGrades.length > 0) {
      const safetyRows = safetyGrades.slice(0, 5).map((g) => [
        String(g.hospital_name ?? g.name ?? g.hospital ?? "Unknown").slice(0, 35),
        String(g.state ?? "—"),
        String(g.safety_grade ?? g.grade ?? g.letter_grade ?? "—"),
        String(g.weighted_score ?? g.score ?? "—"),
      ]);
      sections.push(`### Leapfrog Safety Grades\n${markdownTable(["Hospital", "State", "Grade", "Score"], safetyRows, 5, totalSafety)}`);
    }

    // Industry payments summary
    if (payments.length > 0) {
      const paymentRows = payments.slice(0, 5).map((p) => {
        const firstName = String(p.covered_recipient_first_name ?? "");
        const lastName = String(p.covered_recipient_last_name ?? "");
        const name = `${firstName} ${lastName}`.trim() || "Unknown";
        const company = String(
          p.applicable_manufacturer_or_applicable_gpo_making_payment_name ?? "Unknown",
        );
        const amt = Number(String(p.total_amount_of_payment_usdollars ?? "0").replace(/[$,]/g, "")) || 0;
        return [
          name.slice(0, 25),
          company.slice(0, 25),
          `$${formatNumber(amt)}`,
          String(p.nature_of_payment_or_transfer_of_value ?? "—").slice(0, 25),
        ];
      });
      sections.push(`### Industry Payments\n${markdownTable(["Physician", "Company", "Amount", "Nature"], paymentRows, 5, totalPayments)}`);
    }

    // ─── Citations ───────────────────────────────────────────────
    const citations = [];
    if (hospitalResult) {
      citations.push({
        id: `[HC-${Date.now()}]`,
        source: "CMS Hospital Compare",
        query,
        resultCount: totalHospitals,
      });
    }
    if (safetyResult) {
      citations.push({
        id: `[LF-${Date.now()}]`,
        source: "Leapfrog Safety Grade",
        query,
        resultCount: totalSafety,
      });
    }
    if (paymentsResult) {
      citations.push({
        id: `[CMS-OP-${Date.now()}]`,
        source: "CMS Open Payments",
        query,
        resultCount: totalPayments,
      });
    }

    sections.push(formatCitations(citations));

    // Assemble and truncate
    const rawContent = sections.join("\n\n");
    const { content, truncated } = truncateToCharBudget(rawContent, LAYER_3_CHAR_BUDGET);

    return {
      content,
      citations,
      vintage: hospitalResult?.vintage ?? safetyResult?.vintage ?? {
        queriedAt: new Date().toISOString(),
        source: "Hospital Compare + Leapfrog + CMS Open Payments",
      },
      confidence,
      truncated,
    };
  },
};
