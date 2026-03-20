"use client";

import type { EngineManifest } from "@/lib/engines/types";
import EngineDashboard from "./EngineDashboard";
import { BarChart3, Target, Users, Briefcase, MapPin, Clock } from "lucide-react";

export default function SalesDashboard({ engine }: { engine: EngineManifest }) {
  return (
    <EngineDashboard
      engine={engine}
      sections={[
        {
          title: "Competitive Intel",
          icon: Target,
          items: [
            { label: "Competitors tracked", value: "—" },
            { label: "Battlecards generated", value: "—" },
            { label: "Win/loss signals (30d)", value: "—" },
            { label: "Pricing intelligence", value: "—" },
          ],
        },
        {
          title: "Territory Analysis",
          icon: MapPin,
          items: [
            { label: "Markets analyzed", value: "—" },
            { label: "Provider density", value: "—" },
            { label: "Payer concentration", value: "—" },
            { label: "Growth markets", value: "—" },
          ],
        },
        {
          title: "Talent & Hiring",
          icon: Users,
          items: [
            { label: "Hiring signals (30d)", value: "—" },
            { label: "Executive moves", value: "—" },
            { label: "Key departures", value: "—" },
            { label: "Team growth rate", value: "—" },
          ],
        },
        {
          title: "Ecosystem Mapping",
          icon: Briefcase,
          items: [
            { label: "Partnerships tracked", value: "—" },
            { label: "Integration ecosystems", value: "—" },
            { label: "Channel partners", value: "—" },
          ],
        },
        {
          title: "Pipeline Metrics",
          icon: BarChart3,
          items: [
            { label: "Prospect intelligence", value: "—" },
            { label: "Stakeholder mapped", value: "—" },
            { label: "Pain points identified", value: "—" },
          ],
        },
        {
          title: "Recent Activity",
          icon: Clock,
          items: [
            { label: "Last pipeline run", value: "—" },
            { label: "Reports generated", value: "—" },
            { label: "Data freshness", value: "—" },
          ],
        },
      ]}
      capabilities={[
        "Competitive battlecard generation with evidence",
        "Territory analysis with provider and payer density",
        "Hiring signal detection and talent flow tracking",
        "Executive movement monitoring",
        "Ecosystem and partnership mapping",
        "Customer proxy analysis for objection handling",
        "News-driven competitive intelligence alerts",
        "Prospect stakeholder mapping",
      ]}
    />
  );
}
