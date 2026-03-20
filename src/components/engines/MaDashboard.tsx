"use client";

import type { EngineManifest } from "@/lib/engines/types";
import EngineDashboard from "./EngineDashboard";
import { TrendingUp, FileText, Users, Activity, Clock, AlertTriangle } from "lucide-react";

export default function MaDashboard({ engine }: { engine: EngineManifest }) {
  return (
    <EngineDashboard
      engine={engine}
      sections={[
        {
          title: "Deal Pipeline",
          icon: TrendingUp,
          items: [
            { label: "Pre-deal signals (30d)", value: "—", trend: "neutral" },
            { label: "Active CHOW filings", value: "—" },
            { label: "HSR filings detected", value: "—" },
            { label: "Pipeline confidence", value: "—" },
          ],
        },
        {
          title: "Due Diligence",
          icon: FileText,
          items: [
            { label: "Audits completed", value: "—" },
            { label: "Open risks", value: "—" },
            { label: "Source coverage", value: "—" },
            { label: "Entity matches", value: "—" },
          ],
        },
        {
          title: "Integration Monitoring",
          icon: Activity,
          items: [
            { label: "Post-deal entities tracked", value: "—" },
            { label: "NPPES changes (30d)", value: "—" },
            { label: "License transfers", value: "—" },
            { label: "Integration alerts", value: "—" },
          ],
        },
        {
          title: "Network Intelligence",
          icon: Users,
          items: [
            { label: "Board interlocks mapped", value: "—" },
            { label: "Co-investment clusters", value: "—" },
            { label: "Advisor networks", value: "—" },
          ],
        },
        {
          title: "Signal Feed",
          icon: AlertTriangle,
          items: [
            { label: "M&A signals (7d)", value: "—" },
            { label: "Consolidation alerts", value: "—" },
            { label: "SENTINEL correlations", value: "—" },
          ],
        },
        {
          title: "Recent Activity",
          icon: Clock,
          items: [
            { label: "Last pipeline run", value: "—" },
            { label: "Findings generated", value: "—" },
            { label: "Data freshness", value: "—" },
          ],
        },
      ]}
      capabilities={[
        "Pre-deal signal detection from weak indicators",
        "CHOW filing monitoring and ownership tracking",
        "Systematic due diligence across all data sources",
        "Post-acquisition integration monitoring",
        "Board interlock and co-investment network mapping",
        "SEC filing analysis for material events",
        "Cross-source M&A pattern correlation via SENTINEL",
        "Competitive landscape impact assessment",
      ]}
    />
  );
}
