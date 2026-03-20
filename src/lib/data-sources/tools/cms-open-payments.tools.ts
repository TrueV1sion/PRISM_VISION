// src/lib/data-sources/tools/cms-open-payments.tools.ts
/**
 * CMS Open Payments Layer 2 Granular Tools
 *
 * 2 tools that wrap CMS Open Payments Layer 1 API client calls and return
 * markdown-formatted ToolResult responses. Agents see these tools
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { MAX_TABLE_ROWS_LAYER_2 } from "../types";
import { cmsOpenPaymentsClient } from "../clients/cms-open-payments";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  dig,
} from "../format";

// ─── search_physician_payments ───────────────────────────────

const searchPhysicianPayments: DataSourceTool = {
  name: "search_physician_payments",
  description:
    "Search CMS Open Payments for physician–industry financial relationships. " +
    "Returns payments from pharmaceutical and medical device companies to physicians. " +
    "Useful for identifying potential conflicts of interest.",
  inputSchema: {
    type: "object",
    properties: {
      physician_name: { type: "string", description: "Physician last name (or full name)" },
      physician_id: { type: "string", description: "CMS physician profile ID (if known)" },
      company_name: { type: "string", description: "Company or manufacturer name" },
      limit: { type: "number", description: "Max results (default 25)" },
    },
  },
  layer: 2,
  sources: ["cms-open-payments"],
  routingTags: ["payments", "provider", "conflict-of-interest", "transparency"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    let response;

    if (input.physician_id) {
      response = await cmsOpenPaymentsClient.getPaymentsByPhysician({
        physicianId: input.physician_id as string,
        limit: (input.limit as number | undefined) ?? 25,
      });
    } else {
      response = await cmsOpenPaymentsClient.searchPayments({
        physicianName: input.physician_name as string | undefined,
        companyName: input.company_name as string | undefined,
        limit: (input.limit as number | undefined) ?? 25,
      });
    }

    const headers = ["Physician", "Company", "Amount", "Nature of Payment", "Date"];
    const rows = response.data.results.map((r) => {
      const firstName = dig(r, "covered_recipient_first_name", "");
      const lastName = dig(r, "covered_recipient_last_name", "");
      const name = `${firstName} ${lastName}`.trim() || "Unknown";
      const amount = Number(dig(r, "total_amount_of_payment_usdollars", "0")) || 0;

      return [
        name,
        dig(r, "applicable_manufacturer_or_applicable_gpo_making_payment_name", "Unknown").slice(0, 40),
        `$${formatNumber(amount)}`,
        dig(r, "nature_of_payment_or_transfer_of_value", "—").slice(0, 40),
        dig(r, "date_of_payment", dig(r, "program_year", "—")),
      ];
    });

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.physician_name ?? input.physician_id ?? input.company_name ?? "all") as string;

    // Calculate total payment amount from results
    const totalAmount = response.data.results.reduce((sum, r) => {
      return sum + (Number(dig(r, "total_amount_of_payment_usdollars", "0")) || 0);
    }, 0);

    const citation = {
      id: `[CMS-OP-${Date.now()}]`,
      source: "CMS Open Payments",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Physician Payments: ${queryDesc}\n\n**${formatNumber(response.data.total)} payments found** | Total: **$${formatNumber(totalAmount)}**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_company_payments ─────────────────────────────────

const searchCompanyPayments: DataSourceTool = {
  name: "search_company_payments",
  description:
    "Search CMS Open Payments by company/manufacturer name to see their payments " +
    "to physicians and teaching hospitals. Returns payment totals and categories.",
  inputSchema: {
    type: "object",
    properties: {
      company_name: { type: "string", description: "Company or manufacturer name" },
      year: { type: "number", description: "Program year to filter" },
      limit: { type: "number", description: "Max results (default 25)" },
    },
    required: ["company_name"],
  },
  layer: 2,
  sources: ["cms-open-payments"],
  routingTags: ["payments", "corporate", "conflict-of-interest", "transparency"],
  handler: async (input: Record<string, unknown>, _cache: ToolCache): Promise<ToolResult> => {
    const response = await cmsOpenPaymentsClient.getPaymentsByCompany({
      companyName: input.company_name as string,
      year: input.year as number | undefined,
      limit: (input.limit as number | undefined) ?? 25,
    });

    const headers = ["Physician", "Specialty", "Amount", "Nature of Payment", "City/State"];
    const rows = response.data.results.map((r) => {
      const firstName = dig(r, "covered_recipient_first_name", "");
      const lastName = dig(r, "covered_recipient_last_name", "");
      const name = `${firstName} ${lastName}`.trim() || "Unknown";
      const amount = Number(dig(r, "total_amount_of_payment_usdollars", "0")) || 0;
      const city = dig(r, "recipient_city", "");
      const state = dig(r, "recipient_state", "");
      const location = [city, state].filter(Boolean).join(", ") || "—";

      return [
        name,
        dig(r, "covered_recipient_specialty_1", "—").slice(0, 30),
        `$${formatNumber(amount)}`,
        dig(r, "nature_of_payment_or_transfer_of_value", "—").slice(0, 35),
        location.slice(0, 25),
      ];
    });

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = input.company_name as string;

    // Calculate total payment amount from results
    const totalAmount = response.data.results.reduce((sum, r) => {
      return sum + (Number(dig(r, "total_amount_of_payment_usdollars", "0")) || 0);
    }, 0);

    const citation = {
      id: `[CMS-OP-CO-${Date.now()}]`,
      source: "CMS Open Payments",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Company Payments: ${queryDesc}\n\n**${formatNumber(response.data.total)} payments found** | Total: **$${formatNumber(totalAmount)}**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const cmsOpenPaymentsTools: DataSourceTool[] = [
  searchPhysicianPayments,
  searchCompanyPayments,
];
