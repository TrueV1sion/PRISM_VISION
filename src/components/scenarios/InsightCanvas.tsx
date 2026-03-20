"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GitBranch,
  Grid3X3,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Plus,
  Radar,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import type { ScenarioDiff, EmergenceDelta, TensionDelta } from "@/lib/scenarios/types";

interface InsightCanvasProps {
  diff: ScenarioDiff | null;
  isComputing: boolean;
  scenarioName: string;
}

type ViewMode = "overview" | "emergences" | "tensions" | "sensitivity";

export default function InsightCanvas({
  diff,
  isComputing,
  scenarioName,
}: InsightCanvasProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const modes: Array<{ key: ViewMode; label: string; icon: typeof Sparkles }> = [
    { key: "overview", label: "Overview", icon: Radar },
    { key: "emergences", label: "Emergences", icon: Sparkles },
    { key: "tensions", label: "Tensions", icon: GitBranch },
    { key: "sensitivity", label: "Sensitivity", icon: Grid3X3 },
  ];

  if (!diff && !isComputing) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-xl text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-prism-sky/20 bg-[radial-gradient(circle_at_top_left,rgba(89,221,253,0.2),transparent_60%),linear-gradient(135deg,rgba(89,221,253,0.08),rgba(44,74,143,0.14))]">
            <Radar className="h-9 w-9 text-prism-sky/70" />
          </div>
          <h3 className="text-xl font-semibold text-prism-text">
            Map the scenario before you compute it
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-prism-muted">
            Select a scenario or apply a preset to activate levers. Once you
            compute, this canvas will show what changed, what broke, and which
            assumptions mattered most.
          </p>
        </div>
      </div>
    );
  }

  if (isComputing) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto mb-5 h-24 w-24">
            <motion.div
              className="absolute inset-0 rounded-full border border-prism-sky/25"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-3 rounded-full border border-prism-accent/25"
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 2.8, ease: "linear" }}
            />
            <div className="absolute inset-6 flex items-center justify-center rounded-full bg-prism-sky/10">
              <Sparkles className="h-6 w-6 animate-pulse text-prism-sky" />
            </div>
          </div>
          <h3 className="text-base font-semibold text-prism-text">
            Re-synthesizing {scenarioName}
          </h3>
          <p className="mt-2 text-sm text-prism-muted">
            Applying lever mutations, rebuilding the scenario IR, and ranking
            the downstream shifts.
          </p>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.18em] text-prism-muted">
            estimated time ~30 seconds
          </p>
        </div>
      </div>
    );
  }

  if (!diff) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
              Scenario intelligence
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-prism-text">
                {scenarioName}
              </h2>
              <DiffBadge diff={diff} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-prism-muted">
              {diff.summary}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-all ${
                    viewMode === mode.key
                      ? "border-prism-sky/25 bg-prism-sky/15 text-prism-sky"
                      : "border-transparent text-prism-muted hover:border-white/10 hover:bg-white/5 hover:text-prism-text"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {viewMode === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <OverviewView diff={diff} />
            </motion.div>
          )}
          {viewMode === "emergences" && (
            <motion.div
              key="emergences"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <EmergenceView
                deltas={diff.emergencesDelta}
                expandedId={expandedId}
                onToggle={setExpandedId}
              />
            </motion.div>
          )}
          {viewMode === "tensions" && (
            <motion.div
              key="tensions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <TensionView deltas={diff.tensionsDelta} />
            </motion.div>
          )}
          {viewMode === "sensitivity" && (
            <motion.div
              key="sensitivity"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <SensitivityView entries={diff.sensitivityMap} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OverviewView({ diff }: { diff: ScenarioDiff }) {
  const topSensitivity = [...diff.sensitivityMap]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3);
  const topEmergences = diff.emergencesDelta
    .filter((delta) => delta.type !== "removed")
    .slice(0, 3);
  const topTensions = diff.tensionsDelta.slice(0, 3);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <OverviewStat
          label="New emergences"
          value={String(diff.emergencesDelta.filter((d) => d.type === "new").length)}
          accent="text-emerald-300"
        />
        <OverviewStat
          label="Shifted tensions"
          value={String(diff.tensionsDelta.filter((d) => d.type === "shifted").length)}
          accent="text-amber-300"
        />
        <OverviewStat
          label="Finding delta"
          value={`${diff.newFindings - diff.removedFindings >= 0 ? "+" : ""}${diff.newFindings - diff.removedFindings}`}
          accent="text-prism-sky"
        />
        <OverviewStat
          label="Confidence"
          value={`${diff.confidenceShift >= 0 ? "+" : ""}${(diff.confidenceShift * 100).toFixed(1)}%`}
          accent={diff.confidenceShift >= 0 ? "text-emerald-300" : "text-red-300"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
                Change narrative
              </div>
              <h3 className="mt-1 text-sm font-semibold text-prism-text">
                What moved first
              </h3>
            </div>
            <ArrowUpRight className="h-4 w-4 text-prism-sky" />
          </div>
          <div className="mt-4 space-y-3">
            {topEmergences.length === 0 ? (
              <EmptyListMessage message="No emergence shifts rose above the matching threshold." />
            ) : (
              topEmergences.map((delta) => (
                <div
                  key={delta.emergence.id}
                  className="rounded-2xl border border-white/6 bg-[#0c1322] px-3 py-3"
                >
                  <div className="flex items-start gap-2">
                    <DeltaIndicator type={delta.type} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-prism-text">
                        {delta.emergence.insight}
                      </div>
                      {delta.changeDescription && (
                        <div className="mt-1 text-[10px] leading-relaxed text-prism-muted">
                          {delta.changeDescription}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
              Highest leverage
            </div>
            <div className="mt-3 space-y-3">
              {topSensitivity.length === 0 ? (
                <EmptyListMessage message="No lever impact map available for this scenario yet." />
              ) : (
                topSensitivity.map((entry, index) => (
                  <div
                    key={`${entry.leverId}-${index}`}
                    className="rounded-2xl border border-white/6 bg-[#0c1322] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-prism-text">
                          {entry.leverLabel}
                        </div>
                        <div className="mt-1 text-[10px] text-prism-muted">
                          {entry.leverType.replace(/_/g, " ")} ·{" "}
                          {entry.affectedEmergences.length} emergence /{" "}
                          {entry.affectedTensions.length} tension
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-prism-sky">
                        {(entry.impactScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
              Tension watchlist
            </div>
            <div className="mt-3 space-y-2">
              {topTensions.length === 0 ? (
                <EmptyListMessage message="No tension movement detected in this recompute." />
              ) : (
                topTensions.map((delta, index) => (
                  <div
                    key={`${delta.tension.id}-${index}`}
                    className="rounded-2xl border border-white/6 bg-[#0c1322] px-3 py-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-prism-text">
                          {delta.tension.claim}
                        </div>
                        <div className="mt-1 text-[10px] text-prism-muted">
                          {delta.changeDescription ?? delta.type}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function OverviewStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className={`text-lg font-semibold ${accent}`}>{value}</div>
      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
        {label}
      </div>
    </div>
  );
}

function EmptyListMessage({ message }: { message: string }) {
  return <div className="text-[11px] leading-relaxed text-prism-muted">{message}</div>;
}

function DiffBadge({ diff }: { diff: ScenarioDiff }) {
  const newCount = diff.emergencesDelta.filter((d) => d.type === "new").length;
  const changedCount = diff.emergencesDelta.filter((d) => d.type === "changed").length;
  const resolvedCount = diff.tensionsDelta.filter((d) => d.type === "resolved").length;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
      {newCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
          <Plus className="h-3 w-3" />
          {newCount} new
        </span>
      )}
      {changedCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-amber-300">
          ~{changedCount} shifted
        </span>
      )}
      {resolvedCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-prism-sky/15 px-2 py-1 text-prism-sky">
          {resolvedCount} resolved
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
          diff.confidenceShift >= 0
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-red-500/15 text-red-300"
        }`}
      >
        {diff.confidenceShift >= 0 ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {(diff.confidenceShift * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function EmergenceView({
  deltas,
  expandedId,
  onToggle,
}: {
  deltas: EmergenceDelta[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (deltas.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-prism-muted">No emergence changes detected</p>
        <p className="mt-1 text-xs text-prism-muted/60">
          The lever package did not create a distinct emergence signature.
        </p>
      </div>
    );
  }

  const sorted = [...deltas].sort((a, b) => {
    const order = { new: 0, changed: 1, removed: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <>
      {sorted.map((delta) => {
        const emergence = delta.emergence;
        const isExpanded = expandedId === emergence.id;
        const scores = emergence.qualityScores;

        return (
          <motion.div
            key={emergence.id}
            layout
            className={`overflow-hidden rounded-[24px] border transition-colors ${
              delta.type === "new"
                ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                : delta.type === "removed"
                  ? "border-red-500/20 bg-red-500/[0.05] opacity-60"
                  : "border-amber-500/20 bg-amber-500/[0.05]"
            }`}
          >
            <button
              onClick={() => onToggle(isExpanded ? null : emergence.id)}
              className="flex w-full items-start gap-3 px-4 py-4 text-left"
            >
              <DeltaIndicator type={delta.type} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium leading-relaxed ${
                    delta.type === "removed"
                      ? "text-prism-muted line-through"
                      : "text-prism-text"
                  }`}
                >
                  {emergence.insight}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-mono text-prism-muted">
                    {emergence.algorithm.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-prism-muted">
                    {emergence.supportingAgents.length} supporting agents
                  </span>
                  {delta.changeDescription && (
                    <span className="text-[9px] text-amber-300/80">
                      {delta.changeDescription}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-prism-muted transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    <div className="mb-4 grid grid-cols-5 gap-2">
                      {(
                        ["novelty", "grounding", "actionability", "depth", "surprise"] as const
                      ).map((dimension) => (
                        <div
                          key={dimension}
                          className="rounded-2xl border border-white/5 bg-[#0c1322] px-2 py-2 text-center"
                        >
                          <div className="text-[9px] uppercase tracking-[0.12em] text-prism-muted">
                            {dimension.slice(0, 3)}
                          </div>
                          <div
                            className={`mt-1 text-sm font-semibold ${
                              scores[dimension] >= 4
                                ? "text-emerald-300"
                                : scores[dimension] >= 3
                                  ? "text-amber-300"
                                  : "text-red-300"
                            }`}
                          >
                            {scores[dimension]}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-[#0c1322] px-3 py-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
                        Why multi-agent
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-prism-text/80">
                        {emergence.whyMultiAgent}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {emergence.supportingAgents.map((agent) => (
                        <span
                          key={agent}
                          className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-prism-muted"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>

                    {delta.type === "changed" && delta.baseline && (
                      <div className="mt-4 border-t border-white/5 pt-3">
                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
                          Baseline version
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-prism-muted/80">
                          {delta.baseline.insight}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </>
  );
}

function DeltaIndicator({ type }: { type: EmergenceDelta["type"] }) {
  if (type === "new") {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-mono font-bold text-emerald-300">
        NEW
      </span>
    );
  }
  if (type === "removed") {
    return (
      <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-1 text-[9px] font-mono font-bold text-red-300">
        GONE
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[9px] font-mono font-bold text-amber-300">
      SHIFT
    </span>
  );
}

function TensionView({ deltas }: { deltas: TensionDelta[] }) {
  if (deltas.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-prism-muted">No tension changes detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deltas.map((delta, index) => (
        <div
          key={`${delta.tension.id}-${index}`}
          className={`rounded-[22px] border px-4 py-4 ${
            delta.type === "resolved"
              ? "border-emerald-500/20 bg-emerald-500/[0.05]"
              : delta.type === "new"
                ? "border-prism-sky/20 bg-prism-sky/[0.05]"
                : delta.type === "shifted"
                  ? "border-amber-500/20 bg-amber-500/[0.05]"
                  : "border-red-500/20 bg-red-500/[0.05] opacity-60"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-mono font-bold ${
                delta.type === "resolved"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : delta.type === "new"
                    ? "bg-prism-sky/15 text-prism-sky"
                    : delta.type === "shifted"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
              }`}
            >
              {delta.type.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-relaxed text-prism-text">
                {delta.tension.claim}
              </p>
              {delta.tension.resolution && (
                <p className="mt-2 text-[11px] text-prism-muted">
                  Resolution: {delta.tension.resolution}
                </p>
              )}
              {delta.changeDescription && (
                <p className="mt-1 text-[11px] text-amber-300/80">
                  {delta.changeDescription}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SensitivityView({
  entries,
}: {
  entries: ScenarioDiff["sensitivityMap"];
}) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-prism-muted">No sensitivity data available</p>
        <p className="mt-1 text-xs text-prism-muted/60">
          The engine did not link visible changes back to specific levers.
        </p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => b.impactScore - a.impactScore);

  return (
    <div className="space-y-3">
      {sorted.map((entry, index) => (
        <div
          key={`${entry.leverId}-${index}`}
          className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 text-[10px] font-mono text-prism-muted">
              #{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-prism-text">
                {entry.leverLabel}
              </p>
              <p className="mt-1 text-[10px] text-prism-muted">
                {entry.leverType.replace(/_/g, " ")} · {entry.affectedEmergences.length}{" "}
                emergence(s), {entry.affectedTensions.length} tension(s)
              </p>
            </div>
            <span
              className={`text-[10px] font-mono ${
                entry.impactScore > 0.6
                  ? "text-red-300"
                  : entry.impactScore > 0.3
                    ? "text-amber-300"
                    : "text-emerald-300"
              }`}
            >
              {(entry.impactScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${entry.impactScore * 100}%` }}
              className={`h-full rounded-full ${
                entry.impactScore > 0.6
                  ? "bg-red-400"
                  : entry.impactScore > 0.3
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
