"use client";

import type { EngineManifest } from "@/lib/engines/types";
import EngineDashboard from "./EngineDashboard";
import { DollarSign, BarChart3, TrendingUp, PieChart, Target, Clock } from "lucide-react";

export default function FinanceDashboard({ engine }: { engine: EngineManifest }) {
  return (
    <EngineDashboard
      engine={engine}
      sections={[
        {
          title: "Market Sizing",
          icon: PieChart,
          items: [
            { label: "TAM estimate", value: "—" },
            { label: "SAM estimate", value: "—" },
            { label: "Growth rate (CAGR)", value: "—" },
            { label: "Market maturity", value: "—" },
          ],
        },
        {
          title: "Peer Comparison",
          icon: BarChart3,
          items: [
            { label: "Companies tracked", value: "—" },
            { label: "Revenue median", value: "—" },
            { label: "Margin median", value: "—" },
            { label: "Quartile ranking", value: "—" },
          ],
        },
        {
          title: "Financial Health",
          icon: DollarSign,
          items: [
            { label: "SEC filings analyzed", value: "—" },
            { label: "MLR trends", value: "—" },
            { label: "Debt-to-equity", value: "—" },
            { label: "Free cash flow", value: "—" },
          ],
        },
        {
          title: "Value Chain",
          icon: TrendingUp,
          items: [
            { label: "Margin pools mapped", value: "—" },
            { label: "Cost drivers identified", value: "—" },
            { label: "Pricing pressure signals", value: "—" },
          ],
        },
        {
          title: "Benchmarking",
          icon: Target,
          items: [
            { label: "Metrics benchmarked", value: "—" },
            { label: "Percentile rank (avg)", value: "—" },
            { label: "Outperformance areas", value: "—" },
          ],
        },
        {
          title: "Recent Activity",
          icon: Clock,
          items: [
            { label: "Last pipeline run", value: "—" },
            { label: "Data sources queried", value: "—" },
            { label: "Data freshness", value: "—" },
          ],
        },
      ]}
      capabilities={[
        "TAM/SAM/SOM market sizing with bottom-up and top-down approaches",
        "Peer financial comparison with percentile ranking",
        "SEC filing analysis for revenue, margins, and material events",
        "Value chain and margin pool mapping",
        "Pricing strategy analysis and willingness-to-pay modeling",
        "BLS and Census economic indicator integration",
        "CMS rate notice and reimbursement trend analysis",
        "Cross-source financial signal correlation",
      ]}
    />
  );
}
