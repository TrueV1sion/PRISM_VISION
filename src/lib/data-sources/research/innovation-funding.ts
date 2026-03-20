// src/lib/data-sources/research/innovation-funding.ts
/**
 * research_innovation_funding — Layer 3 Intelligence Tool
 *
 * Compound research tool that aggregates SBIR/STTR awards, Grants.gov
 * opportunities, and USPTO patent landscape data to provide a comprehensive
 * view of innovation funding and IP activity. Makes 3-4 parallel Layer 1
 * API calls per invocation.
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

type SbirGovClientType = typeof import("../clients/sbir-gov").sbirGovClient;
type GrantsGovClientType = typeof import("../clients/grants-gov").grantsGovClient;
type UsptoPatentsClientType = typeof import("../clients/uspto-patents").usptoPatentsClient;

let sbirGovClientRef: SbirGovClientType | null | undefined;
let grantsGovClientRef: GrantsGovClientType | null | undefined;
let usptoPatentsClientRef: UsptoPatentsClientType | null | undefined;

async function getSbirGovClient(): Promise<SbirGovClientType | null> {
  if (sbirGovClientRef !== undefined) return sbirGovClientRef;
  try {
    const mod = await import("../clients/sbir-gov");
    sbirGovClientRef = mod.sbirGovClient;
  } catch {
    sbirGovClientRef = null;
  }
  return sbirGovClientRef;
}

async function getGrantsGovClient(): Promise<GrantsGovClientType | null> {
  if (grantsGovClientRef !== undefined) return grantsGovClientRef;
  try {
    const mod = await import("../clients/grants-gov");
    grantsGovClientRef = mod.grantsGovClient;
  } catch {
    grantsGovClientRef = null;
  }
  return grantsGovClientRef;
}

async function getUsptoPatentsClient(): Promise<UsptoPatentsClientType | null> {
  if (usptoPatentsClientRef !== undefined) return usptoPatentsClientRef;
  try {
    const mod = await import("../clients/uspto-patents");
    usptoPatentsClientRef = mod.usptoPatentsClient;
  } catch {
    usptoPatentsClientRef = null;
  }
  return usptoPatentsClientRef;
}

export const innovationFundingResearchTool: DataSourceTool = {
  name: "research_innovation_funding",
  description:
    "Comprehensive innovation funding intelligence: SBIR/STTR awards, Grants.gov " +
    "opportunities, and USPTO patent landscape. Makes multiple API calls and " +
    "returns a cross-referenced intelligence packet for funding and IP analysis.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Technology area, company, or topic to investigate" },
      timeframe: { type: "string", description: "How far back to search: '1y', '3y', '5y' (default '3y')" },
      focus: { type: "string", description: "Optional focus area: 'awards', 'grants', 'patents'" },
    },
    required: ["query"],
  },
  layer: 3,
  sources: ["sbir-gov", "grants-gov", "uspto-patents"],
  routingTags: ["funding", "innovation", "technology", "sbir", "grants"],

  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const query = input.query as string;
    const timeframe = (input.timeframe as string) ?? "3y";
    const yearsBack = parseInt(timeframe) || 3;
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - yearsBack;

    // ─── Resolve clients ─────────────────────────────────────────
    const [sbirClient, grantsClient, patentsClient] = await Promise.all([
      getSbirGovClient(),
      getGrantsGovClient(),
      getUsptoPatentsClient(),
    ]);

    // ─── Parallel API calls ──────────────────────────────────────
    const [sbirResult, grantsResult, patentsResult] = await Promise.all([
      sbirClient
        ? sbirClient.searchAwards({ query, year: startYear, limit: 10 })
            .catch(() => null)
        : null,
      grantsClient
        ? grantsClient.searchOpportunities({ keyword: query, rows: 10 })
            .catch(() => null)
        : null,
      patentsClient
        ? patentsClient.searchPatents({
            query,
            date_from: `${startYear}-01-01`,
            limit: 10,
          }).catch(() => null)
        : null,
    ]);

    // ─── Extract insights ────────────────────────────────────────
    const sbirAwards = sbirResult?.data?.results ?? [];
    const totalSbirAwards = sbirResult?.data?.total ?? 0;

    const grants = grantsResult?.data?.results ?? [];
    const totalGrants = grantsResult?.data?.total ?? 0;

    const patents = patentsResult?.data?.patents ?? [];
    const totalPatents = patentsResult?.data?.total ?? 0;

    // Calculate total SBIR funding
    const totalSbirFunding = sbirAwards.reduce((sum, r) => {
      const amt = Number(
        String(r.award_amount ?? r.amount ?? "0").replace(/[$,]/g, ""),
      ) || 0;
      return sum + amt;
    }, 0);

    // Identify top agencies in SBIR awards
    const agencyCounts: Record<string, number> = {};
    for (const award of sbirAwards) {
      const agency = String(award.agency ?? "Unknown");
      agencyCounts[agency] = (agencyCounts[agency] || 0) + 1;
    }

    // Identify top assignees in patents
    const assigneeCounts: Record<string, number> = {};
    for (const patent of patents) {
      const assignee = patent.assignees?.[0]?.assignee_organization ?? "Individual/Unknown";
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    }

    // ─── Confidence scoring ──────────────────────────────────────
    let sourcesReturned = 0;
    let sourcesQueried = 0;
    if (sbirClient) { sourcesQueried++; if (totalSbirAwards > 0) sourcesReturned++; }
    if (grantsClient) { sourcesQueried++; if (totalGrants > 0) sourcesReturned++; }
    if (patentsClient) { sourcesQueried++; if (totalPatents > 0) sourcesReturned++; }

    if (sourcesQueried === 0) sourcesQueried = 3;

    const confidence: "HIGH" | "MEDIUM" | "LOW" =
      sourcesReturned >= 3 ? "HIGH" : sourcesReturned >= 2 ? "MEDIUM" : "LOW";

    // ─── Build intelligence packet ───────────────────────────────
    const sections: string[] = [];

    const vintage = sbirResult?.vintage?.queriedAt?.slice(0, 10)
      ?? grantsResult?.vintage?.queriedAt?.slice(0, 10)
      ?? new Date().toISOString().slice(0, 10);

    sections.push(intelligenceHeader({
      topic: "Innovation Funding",
      subject: query,
      confidence,
      sourcesQueried,
      sourcesReturned,
      vintage,
    }));

    // Key Intelligence bullets
    const bullets: string[] = [];
    if (totalSbirAwards > 0) {
      bullets.push(`- **${formatNumber(totalSbirAwards)}** SBIR/STTR awards found`);
      if (totalSbirFunding > 0) {
        bullets.push(`- Total SBIR funding in sample: **$${formatNumber(totalSbirFunding)}**`);
      }
      if (Object.keys(agencyCounts).length > 0) {
        const topAgencies = Object.entries(agencyCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([agency]) => agency)
          .join(", ");
        bullets.push(`- Top funding agencies: ${topAgencies}`);
      }
    } else {
      bullets.push(`- No SBIR/STTR awards found for "${query}" since ${startYear}`);
    }
    if (totalGrants > 0) {
      bullets.push(`- **${formatNumber(totalGrants)}** active/recent grant opportunities`);
    }
    if (totalPatents > 0) {
      bullets.push(`- **${formatNumber(totalPatents)}** patents filed since ${startYear}`);
      if (Object.keys(assigneeCounts).length > 0) {
        const topAssignees = Object.entries(assigneeCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([assignee]) => assignee)
          .join(", ");
        bullets.push(`- Top patent holders: ${topAssignees}`);
      }
    }
    sections.push(`### Key Intelligence\n${bullets.join("\n")}`);

    // SBIR/STTR awards table
    if (sbirAwards.length > 0) {
      const sbirRows = sbirAwards.slice(0, 5).map((a) => {
        const amt = Number(String(a.award_amount ?? a.amount ?? "0").replace(/[$,]/g, "")) || 0;
        return [
          String(a.firm ?? a.company ?? a.firm_name ?? "Unknown").slice(0, 25),
          String(a.award_title ?? a.title ?? "—").slice(0, 35),
          String(a.agency ?? "—"),
          amt > 0 ? `$${formatNumber(amt)}` : "—",
          String(a.phase ?? a.program ?? "—"),
        ];
      });
      sections.push(`### SBIR/STTR Awards\n${markdownTable(["Company", "Title", "Agency", "Amount", "Phase"], sbirRows, 5, totalSbirAwards)}`);
    }

    // Grant opportunities table
    if (grants.length > 0) {
      const grantRows = grants.slice(0, 5).map((g) => {
        const title = g.title || "Unknown";
        const agency = g.agency || "—";
        const ceiling = g.award_ceiling;
        const ceilingStr = ceiling ? `$${formatNumber(Number(ceiling) || 0)}` : "—";
        const status = g.status || "—";
        return [
          title.slice(0, 40),
          agency.slice(0, 10),
          ceilingStr,
          status,
        ];
      });
      sections.push(`### Grant Opportunities\n${markdownTable(["Title", "Agency", "Ceiling", "Status"], grantRows, 5, totalGrants)}`);
    }

    // Patent landscape table
    if (patents.length > 0) {
      const patentRows = patents.slice(0, 5).map((p) => {
        const cited = Number(p.patent_num_cited_by_us_patents ?? 0);
        const assigneeName = p.assignees?.[0]?.assignee_organization ?? "—";
        return [
          String(p.patent_number ?? "—"),
          String(p.patent_title ?? "—").slice(0, 40),
          String(assigneeName).slice(0, 20),
          String(p.patent_date ?? "—"),
          String(cited),
        ];
      });
      sections.push(`### Patent Landscape\n${markdownTable(["Patent #", "Title", "Assignee", "Date", "Citations"], patentRows, 5, totalPatents)}`);
    }

    // ─── Citations ───────────────────────────────────────────────
    const citations = [];
    if (sbirResult) {
      citations.push({
        id: `[SBIR-${Date.now()}]`,
        source: "SBIR.gov",
        query,
        resultCount: totalSbirAwards,
      });
    }
    if (grantsResult) {
      citations.push({
        id: `[GRANTS-${Date.now()}]`,
        source: "Grants.gov",
        query,
        resultCount: totalGrants,
      });
    }
    if (patentsResult) {
      citations.push({
        id: `[USPTO-${Date.now()}]`,
        source: "USPTO PatentsView",
        query,
        resultCount: totalPatents,
      });
    }

    sections.push(formatCitations(citations));

    // Assemble and truncate
    const rawContent = sections.join("\n\n");
    const { content, truncated } = truncateToCharBudget(rawContent, LAYER_3_CHAR_BUDGET);

    return {
      content,
      citations,
      vintage: sbirResult?.vintage ?? grantsResult?.vintage ?? {
        queriedAt: new Date().toISOString(),
        source: "SBIR.gov + Grants.gov + USPTO PatentsView",
      },
      confidence,
      truncated,
    };
  },
};
