"use client";

import type { EngineManifest } from "@/lib/engines/types";
import EngineDashboard from "./EngineDashboard";
import { Shield, FileText, Gavel, Globe, Calendar, Clock } from "lucide-react";

export default function RegulatoryDashboard({ engine }: { engine: EngineManifest }) {
  return (
    <EngineDashboard
      engine={engine}
      sections={[
        {
          title: "Rule Tracker",
          icon: Shield,
          items: [
            { label: "Active proposed rules", value: "—" },
            { label: "Final rules (30d)", value: "—" },
            { label: "Comment periods open", value: "—" },
            { label: "CMS rules tracked", value: "—" },
          ],
        },
        {
          title: "Legislative Pipeline",
          icon: Gavel,
          items: [
            { label: "Healthcare bills tracked", value: "—" },
            { label: "Committee activity (30d)", value: "—" },
            { label: "Floor votes pending", value: "—" },
            { label: "Signed into law (YTD)", value: "—" },
          ],
        },
        {
          title: "Lobbying & Influence",
          icon: Globe,
          items: [
            { label: "Lobbying filings (QTD)", value: "—" },
            { label: "Healthcare spend ($M)", value: "—" },
            { label: "Top lobbying entities", value: "—" },
            { label: "Revolving door moves", value: "—" },
          ],
        },
        {
          title: "Comment Deadlines",
          icon: Calendar,
          items: [
            { label: "Due this week", value: "—" },
            { label: "Due this month", value: "—" },
            { label: "High-impact pending", value: "—" },
          ],
        },
        {
          title: "Policy Intelligence",
          icon: FileText,
          items: [
            { label: "CBO scores available", value: "—" },
            { label: "GAO reports (30d)", value: "—" },
            { label: "Executive orders", value: "—" },
          ],
        },
        {
          title: "Recent Activity",
          icon: Clock,
          items: [
            { label: "Last pipeline run", value: "—" },
            { label: "Feed items (24h)", value: "—" },
            { label: "Data freshness", value: "—" },
          ],
        },
      ]}
      capabilities={[
        "Federal Register monitoring for CMS/HHS rulemaking",
        "Congressional bill tracking with committee status",
        "Comment period deadline alerting",
        "Lobbying activity and campaign contribution mapping",
        "CBO score and fiscal impact analysis",
        "Scenario modeling for policy impact",
        "Cross-source regulatory signal correlation",
        "Political risk assessment via influence mapping",
      ]}
    />
  );
}
