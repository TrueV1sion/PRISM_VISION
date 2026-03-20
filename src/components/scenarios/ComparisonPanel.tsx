"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { ScenarioDiff, EmergenceDelta, TensionDelta } from "@/lib/scenarios/types";

interface ComparisonPanelProps {
  scenarioAId: string;
  scenarioAName: string;
  scenarioBId: string; // "baseline" or another scenario ID
  scenarioBName: string;
  onClose: () => void;
}

export default function ComparisonPanel({
  scenarioAId,
  scenarioAName,
  scenarioBId,
  scenarioBName,
  onClose,
}: ComparisonPanelProps) {
  const [diff, setDiff] = useState<ScenarioDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDiff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/scenarios/${scenarioAId}/diff/${scenarioBId}`,
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load comparison");
          return;
        }
        const data = await res.json();
        setDiff(data.diff);
      } catch {
        setError("Failed to load comparison");
      } finally {
        setIsLoading(false);
      }
    };
    loadDiff();
  }, [scenarioAId, scenarioBId]);

  return (
    <div className="flex min-h-0 h-full w-full flex-col bg-[#080d1a]/80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-prism-muted mb-1">
            Comparison
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-prism-text font-medium truncate max-w-[120px]">
              {scenarioBName}
            </span>
            <ArrowRight className="w-3 h-3 text-prism-muted shrink-0" />
            <span className="text-prism-sky font-medium truncate max-w-[120px]">
              {scenarioAName}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/5 text-prism-muted hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-prism-sky animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-8 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-prism-muted">{error}</p>
          </div>
        )}

        {diff && (
          <div className="space-y-0">
            {/* Summary stats */}
            <SummaryBar diff={diff} />

            {/* Emergence deltas */}
            <ComparisonSection
              title="Emergence Changes"
              icon={<Sparkles className="w-3.5 h-3.5 text-prism-sky" />}
              count={diff.emergencesDelta.length}
            >
              {diff.emergencesDelta.length === 0 ? (
                <p className="text-[10px] text-prism-muted/50 px-4 py-3">
                  No emergence changes
                </p>
              ) : (
                diff.emergencesDelta.map((delta, i) => (
                  <EmergenceDeltaRow key={i} delta={delta} />
                ))
              )}
            </ComparisonSection>

            {/* Tension deltas */}
            <ComparisonSection
              title="Tension Changes"
              icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              count={diff.tensionsDelta.length}
            >
              {diff.tensionsDelta.length === 0 ? (
                <p className="text-[10px] text-prism-muted/50 px-4 py-3">
                  No tension changes
                </p>
              ) : (
                diff.tensionsDelta.map((delta, i) => (
                  <TensionDeltaRow key={i} delta={delta} />
                ))
              )}
            </ComparisonSection>

            {/* Sensitivity ranking */}
            <ComparisonSection
              title="Lever Impact"
              icon={<HelpCircle className="w-3.5 h-3.5 text-prism-accent" />}
              count={diff.sensitivityMap.length}
            >
              {diff.sensitivityMap.length === 0 ? (
                <p className="text-[10px] text-prism-muted/50 px-4 py-3">
                  No sensitivity data
                </p>
              ) : (
                diff.sensitivityMap
                  .sort((a, b) => b.impactScore - a.impactScore)
                  .map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-4 py-2 border-b border-white/3 last:border-0"
                    >
                      <span className="text-[9px] font-mono text-prism-muted w-3">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-prism-text truncate">
                          {entry.leverLabel}
                        </p>
                      </div>
                      <ImpactBar score={entry.impactScore} />
                    </div>
                  ))
              )}
            </ComparisonSection>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────

function SummaryBar({ diff }: { diff: ScenarioDiff }) {
  const newCount = diff.emergencesDelta.filter((d) => d.type === "new").length;
  const removedCount = diff.emergencesDelta.filter((d) => d.type === "removed").length;
  const changedCount = diff.emergencesDelta.filter((d) => d.type === "changed").length;
  return (
    <div className="px-4 py-3 border-b border-white/8 bg-white/2">
      <div className="grid grid-cols-4 gap-2">
        <StatBox
          label="New"
          value={`+${newCount}`}
          color="text-emerald-400"
          icon={<Plus className="w-3 h-3" />}
        />
        <StatBox
          label="Lost"
          value={`−${removedCount}`}
          color="text-red-400"
          icon={<Minus className="w-3 h-3" />}
        />
        <StatBox
          label="Shifted"
          value={`~${changedCount}`}
          color="text-amber-400"
          icon={<Sparkles className="w-3 h-3" />}
        />
        <StatBox
          label="Confidence"
          value={`${diff.confidenceShift >= 0 ? "+" : ""}${(diff.confidenceShift * 100).toFixed(1)}%`}
          color={diff.confidenceShift >= 0 ? "text-emerald-400" : "text-red-400"}
          icon={
            diff.confidenceShift >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )
          }
        />
      </div>
      <p className="text-[10px] text-prism-muted mt-2 leading-relaxed">
        {diff.summary}
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <div className={`text-sm font-mono font-bold ${color} flex items-center justify-center gap-0.5`}>
        {icon}
        {value}
      </div>
      <div className="text-[9px] text-prism-muted mt-0.5">{label}</div>
    </div>
  );
}

// ─── Comparison Section ──────────────────────────────────────

function ComparisonSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setIsExpanded((s) => !s)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/3 transition-colors"
      >
        {icon}
        <span className="text-[11px] font-medium text-prism-text flex-1 text-left">
          {title}
        </span>
        <span className="text-[10px] text-prism-muted">{count}</span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Emergence Delta Row ─────────────────────────────────────

function EmergenceDeltaRow({ delta }: { delta: EmergenceDelta }) {
  const config = {
    new: { badge: "NEW", badgeColor: "text-emerald-400 bg-emerald-500/15", border: "border-l-emerald-500/40" },
    changed: { badge: "SHIFT", badgeColor: "text-amber-400 bg-amber-500/15", border: "border-l-amber-500/40" },
    removed: { badge: "GONE", badgeColor: "text-red-400 bg-red-500/15", border: "border-l-red-500/40" },
  }[delta.type];

  return (
    <div className={`px-4 py-2 border-b border-white/3 border-l-2 ${config.border} last:border-b-0`}>
      <div className="flex items-start gap-2">
        <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0 mt-0.5 ${config.badgeColor}`}>
          {config.badge}
        </span>
        <p className={`text-[10px] leading-relaxed ${delta.type === "removed" ? "text-prism-muted/50 line-through" : "text-prism-text/80"}`}>
          {delta.emergence.insight.length > 150
            ? delta.emergence.insight.slice(0, 150) + "…"
            : delta.emergence.insight}
        </p>
      </div>
      {delta.changeDescription && (
        <p className="text-[9px] text-prism-muted/60 mt-1 ml-8">
          {delta.changeDescription}
        </p>
      )}
    </div>
  );
}

// ─── Tension Delta Row ───────────────────────────────────────

function TensionDeltaRow({ delta }: { delta: TensionDelta }) {
  const config = {
    resolved: { badge: "RESOLVED", badgeColor: "text-emerald-400 bg-emerald-500/15", border: "border-l-emerald-500/40" },
    shifted: { badge: "SHIFTED", badgeColor: "text-amber-400 bg-amber-500/15", border: "border-l-amber-500/40" },
    new: { badge: "NEW", badgeColor: "text-prism-sky bg-prism-sky/15", border: "border-l-prism-sky/40" },
    removed: { badge: "GONE", badgeColor: "text-red-400 bg-red-500/15", border: "border-l-red-500/40" },
  }[delta.type];

  return (
    <div className={`px-4 py-2 border-b border-white/3 border-l-2 ${config.border} last:border-b-0`}>
      <div className="flex items-start gap-2">
        <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0 mt-0.5 ${config.badgeColor}`}>
          {config.badge}
        </span>
        <p className="text-[10px] text-prism-text/80 leading-relaxed">
          {delta.tension.claim.length > 120
            ? delta.tension.claim.slice(0, 120) + "…"
            : delta.tension.claim}
        </p>
      </div>
    </div>
  );
}

// ─── Impact Bar ──────────────────────────────────────────────

function ImpactBar({ score }: { score: number }) {
  const color = score > 0.6 ? "bg-red-400" : score > 0.3 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-[9px] font-mono ${score > 0.6 ? "text-red-400" : score > 0.3 ? "text-amber-400" : "text-emerald-400"}`}>
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}
