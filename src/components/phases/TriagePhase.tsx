"use client";

import { useState, useMemo } from "react";
import { Filter, ChevronRight, ArrowUpDown } from "lucide-react";
import FindingCard from "@/components/FindingCard";
import type { Finding, FindingAction } from "@/lib/types";

type ConfidenceFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type SortMode = "default" | "confidence";

const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

interface TriagePhaseProps {
    findings: Finding[];
    agentCount: number;
    onAction: (id: string, action: FindingAction) => void;
    onApproveAndSynthesize: () => void;
}

export default function TriagePhase({
    findings,
    agentCount,
    onAction,
    onApproveAndSynthesize,
}: TriagePhaseProps) {
    const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("ALL");
    const [sortMode, setSortMode] = useState<SortMode>("default");

    const keptCount = findings.filter(f => f.action === "keep" || f.action === "boost").length;
    const reviewedCount = findings.filter(f => f.action !== "keep").length;

    const filteredFindings = useMemo(() => {
        let result = [...findings];
        if (confidenceFilter !== "ALL") {
            result = result.filter(f => f.confidence === confidenceFilter);
        }
        if (sortMode === "confidence") {
            result.sort((a, b) => (CONFIDENCE_ORDER[a.confidence] ?? 1) - (CONFIDENCE_ORDER[b.confidence] ?? 1));
        }
        return result;
    }, [findings, confidenceFilter, sortMode]);

    return (
        <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        <Filter className="w-3.5 h-3.5" />
                        HITL GATE: FINDINGS TRIAGE
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white">Review Agent Findings</h2>
                    <p className="text-sm text-prism-muted max-w-xl mx-auto">
                        {findings.length} findings from {agentCount} agents. Dismiss unreliable claims before synthesis.
                    </p>
                </div>

                {/* Sticky action bar */}
                <div className="sticky top-0 z-10 glass-panel rounded-xl p-4 space-y-3 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6 text-xs font-mono">
                            <span className="text-prism-jade">{keptCount} kept</span>
                            <span className="text-prism-sky">{findings.filter(f => f.action === "boost").length} boosted</span>
                            <span className="text-amber-400">{findings.filter(f => f.action === "flag").length} flagged</span>
                            <span className="text-red-400">{findings.filter(f => f.action === "dismiss").length} dismissed</span>
                            <span className="text-prism-muted border-l border-white/10 pl-6">{reviewedCount}/{findings.length} reviewed</span>
                        </div>
                        <button
                            onClick={onApproveAndSynthesize}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-prism-jade text-prism-bg shadow-[0_0_15px_rgba(0,228,159,0.2)] hover:bg-white transition-all duration-300"
                        >
                            Approve & Synthesize
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Sort & Filter controls */}
                    <div className="flex items-center gap-3 border-t border-white/5 pt-3">
                        <button
                            onClick={() => setSortMode(s => s === "default" ? "confidence" : "default")}
                            className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                                sortMode === "confidence"
                                    ? "border-prism-sky/40 text-prism-sky bg-prism-sky/10"
                                    : "border-white/10 text-prism-muted hover:text-white"
                            }`}
                        >
                            <ArrowUpDown className="w-3 h-3" />
                            {sortMode === "confidence" ? "By Confidence" : "Default Order"}
                        </button>
                        <div className="w-px h-4 bg-white/10" />
                        {(["ALL", "HIGH", "MEDIUM", "LOW"] as ConfidenceFilter[]).map(level => (
                            <button
                                key={level}
                                onClick={() => setConfidenceFilter(level)}
                                className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                                    confidenceFilter === level
                                        ? level === "HIGH" ? "border-prism-jade/40 text-prism-jade bg-prism-jade/10"
                                        : level === "MEDIUM" ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                                        : level === "LOW" ? "border-red-400/40 text-red-400 bg-red-400/10"
                                        : "border-prism-sky/40 text-prism-sky bg-prism-sky/10"
                                        : "border-white/10 text-prism-muted hover:text-white"
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div data-tour-id="tour-finding-card" className="space-y-4">
                    {filteredFindings.map((finding, i) => (
                        <FindingCard key={finding.id} finding={finding} index={i} onAction={onAction} />
                    ))}
                    {filteredFindings.length === 0 && (
                        <div className="text-center py-12 text-sm text-prism-muted">
                            No findings match the current filter.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
