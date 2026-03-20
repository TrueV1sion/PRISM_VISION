"use client";

import type { EngineManifest } from "@/lib/engines/types";
import EngineDashboard from "./EngineDashboard";
import { Layers, Cpu, Compass, Lightbulb, GitBranch, Clock } from "lucide-react";

export default function ProductDashboard({ engine }: { engine: EngineManifest }) {
  return (
    <EngineDashboard
      engine={engine}
      sections={[
        {
          title: "Feature Landscape",
          icon: Layers,
          items: [
            { label: "Competitors analyzed", value: "—" },
            { label: "Feature gaps identified", value: "—" },
            { label: "UX benchmarks", value: "—" },
            { label: "Differentiation score", value: "—" },
          ],
        },
        {
          title: "Technology Radar",
          icon: Cpu,
          items: [
            { label: "Patents tracked", value: "—" },
            { label: "SBIR health-tech awards", value: "—" },
            { label: "Emerging tech signals", value: "—" },
            { label: "Adoption maturity", value: "—" },
          ],
        },
        {
          title: "Ecosystem Map",
          icon: GitBranch,
          items: [
            { label: "Platform integrations", value: "—" },
            { label: "API ecosystems mapped", value: "—" },
            { label: "Partner density", value: "—" },
            { label: "Lock-in indicators", value: "—" },
          ],
        },
        {
          title: "Maturity Assessment",
          icon: Compass,
          items: [
            { label: "Categories assessed", value: "—" },
            { label: "Hype cycle position", value: "—" },
            { label: "Market readiness", value: "—" },
          ],
        },
        {
          title: "Innovation Pipeline",
          icon: Lightbulb,
          items: [
            { label: "Innovation clusters", value: "—" },
            { label: "Funding trends", value: "—" },
            { label: "Startup activity", value: "—" },
          ],
        },
        {
          title: "Recent Activity",
          icon: Clock,
          items: [
            { label: "Last pipeline run", value: "—" },
            { label: "Sources queried", value: "—" },
            { label: "Data freshness", value: "—" },
          ],
        },
      ]}
      capabilities={[
        "UX benchmarking and feature matrix comparison",
        "Technology maturity and Hype Cycle positioning",
        "Ecosystem and integration landscape mapping",
        "Patent landscape analysis for health tech",
        "SBIR/STTR innovation funding tracking",
        "Trend extrapolation and future scenario planning",
        "Platform strategy intelligence",
        "Competitive feature gap analysis",
      ]}
    />
  );
}
