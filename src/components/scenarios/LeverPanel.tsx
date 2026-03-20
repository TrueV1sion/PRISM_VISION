"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Zap,
  HelpCircle,
  BarChart3,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AvailableLevers,
  AvailableLever,
  CreateLeverInput,
} from "@/lib/scenarios/types";

export interface LeverPreset {
  id: string;
  name: string;
  description: string;
  levers: CreateLeverInput[];
}

interface LeverPanelProps {
  availableLevers: AvailableLevers;
  activatedLevers: CreateLeverInput[];
  onLeversChange: (levers: CreateLeverInput[]) => void;
  isComputing: boolean;
  onCompute: () => void;
  onClear: () => void;
  presets: LeverPreset[];
  onApplyPreset: (preset: LeverPreset) => void;
  scenarioName: string;
}

const SECTION_ICONS = {
  tensions: AlertTriangle,
  gaps: HelpCircle,
  metrics: BarChart3,
  findings: FileText,
};

const SECTION_LABELS = {
  tensions: "Tensions",
  gaps: "Unknowns",
  metrics: "Key Metrics",
  findings: "Findings",
};

const SECTION_DESCRIPTIONS = {
  tensions: "Flip which position prevails when the narrative is contested.",
  gaps: "Inject a plausible assumption where the baseline still has open unknowns.",
  metrics: "Move a named metric and test how synthesis reacts downstream.",
  findings: "Stress or strengthen the claims carrying the most weight.",
};

export default function LeverPanel({
  availableLevers,
  activatedLevers,
  onLeversChange,
  isComputing,
  onCompute,
  onClear,
  presets,
  onApplyPreset,
  scenarioName,
}: LeverPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["tensions", "gaps"]),
  );

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isLeverActivated = (targetId: string) =>
    activatedLevers.some((l) => l.targetId === targetId);

  const setLever = useCallback(
    (lever: CreateLeverInput) => {
      onLeversChange([
        ...activatedLevers.filter((l) => l.targetId !== lever.targetId),
        lever,
      ]);
    },
    [activatedLevers, onLeversChange],
  );

  const removeLever = useCallback(
    (targetId: string) => {
      onLeversChange(activatedLevers.filter((l) => l.targetId !== targetId));
    },
    [activatedLevers, onLeversChange],
  );

  const sections = (
    Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>
  ).filter((key) => availableLevers[key].length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
              Scenario Workbench
            </div>
            <h2 className="mt-1 text-sm font-semibold text-prism-text">
              Shape the counterfactual
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-prism-muted">
              Build a lever package for{" "}
              <span className="font-medium text-prism-text">{scenarioName}</span>
              , then re-synthesize to see where the narrative moves.
            </p>
          </div>
          {activatedLevers.length > 0 && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-prism-muted transition-colors hover:border-white/20 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          <StatTile label="Active levers" value={String(activatedLevers.length)} />
          <StatTile label="Preset recipes" value={String(presets.length)} />
          <StatTile
            label="Compute mode"
            value={isComputing ? "Live" : "Ready"}
            accent={isComputing ? "text-amber-300" : "text-emerald-300"}
          />
        </div>

        {presets.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
              <Sparkles className="h-3.5 w-3.5 text-prism-sky" />
              Scenario Recipes
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onApplyPreset(preset)}
                  className="min-w-[132px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-all hover:border-prism-sky/30 hover:bg-prism-sky/10"
                >
                  <div className="text-[11px] font-semibold text-prism-text">
                    {preset.name}
                  </div>
                  <div className="mt-1 text-[10px] leading-snug text-prism-muted">
                    {preset.description}
                  </div>
                  <div className="mt-2 text-[9px] font-mono uppercase tracking-[0.12em] text-prism-sky/80">
                    {preset.levers.length} lever{preset.levers.length === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activatedLevers.length > 0 && (
          <div className="mt-4 rounded-2xl border border-prism-sky/20 bg-prism-sky/[0.08] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-sky/80">
                Selected levers
              </div>
              <div className="text-[10px] text-prism-muted">
                {activatedLevers.length} active
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activatedLevers.map((lever) => (
                <button
                  key={lever.targetId}
                  onClick={() => removeLever(lever.targetId)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-prism-sky/20 bg-[#09111f] px-2 py-1 text-[10px] text-prism-text transition-colors hover:border-prism-sky/40 hover:text-white"
                >
                  <span className="truncate">
                    {lever.targetLabel}: {summarizeAdjustedValue(lever)}
                  </span>
                  <X className="h-3 w-3 shrink-0 text-prism-muted" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((sectionKey) => {
          const Icon = SECTION_ICONS[sectionKey];
          const levers = availableLevers[sectionKey];
          const isExpanded = expandedSections.has(sectionKey);
          const activatedCount = levers.filter((l) =>
            isLeverActivated(l.targetId),
          ).length;

          return (
            <div key={sectionKey} className="border-b border-white/5">
              <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-white/3"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-prism-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-prism-muted" />
                  )}
                  <Icon className="h-4 w-4 text-prism-sky" />
                  <span className="flex-1 text-xs font-medium text-prism-text">
                    {SECTION_LABELS[sectionKey]}
                  </span>
                  <span className="text-[10px] text-prism-muted">
                    {levers.length}
                  </span>
                  {activatedCount > 0 && (
                    <span className="rounded-full bg-prism-sky/20 px-1.5 py-0.5 text-[10px] font-mono text-prism-sky">
                      {activatedCount} active
                    </span>
                  )}
                </div>
                <div className="mt-1 pl-6 text-[10px] leading-relaxed text-prism-muted">
                  {SECTION_DESCRIPTIONS[sectionKey]}
                </div>
              </button>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 px-2 pb-3">
                      {levers.map((lever) => (
                        <LeverCard
                          key={lever.targetId}
                          lever={lever}
                          sectionKey={sectionKey}
                          isActivated={isLeverActivated(lever.targetId)}
                          activatedLever={activatedLevers.find(
                            (l) => l.targetId === lever.targetId,
                          )}
                          onActivate={setLever}
                          onDeactivate={removeLever}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/8 bg-[#0a0f1e]/60 px-4 py-4">
        <button
          onClick={onCompute}
          disabled={activatedLevers.length === 0 || isComputing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-prism-sky/85 to-prism-accent/85 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-prism-sky hover:to-prism-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-4 w-4" />
          {isComputing
            ? "Re-synthesizing scenario..."
            : activatedLevers.length === 0
              ? "Select levers to compute"
              : `Compute scenario with ${activatedLevers.length} lever${activatedLevers.length === 1 ? "" : "s"}`}
        </button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-prism-muted">
          Scenario compute re-runs synthesis only, so the interaction stays fast
          while keeping the baseline investigation intact.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent = "text-prism-text",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2">
      <div className={`text-sm font-semibold ${accent}`}>{value}</div>
      <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-prism-muted">
        {label}
      </div>
    </div>
  );
}

interface LeverCardProps {
  lever: AvailableLever;
  sectionKey: string;
  isActivated: boolean;
  activatedLever?: CreateLeverInput;
  onActivate: (lever: CreateLeverInput) => void;
  onDeactivate: (targetId: string) => void;
}

function LeverCard({
  lever,
  sectionKey,
  isActivated,
  activatedLever,
  onActivate,
  onDeactivate,
}: LeverCardProps) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 transition-all ${
        isActivated
          ? "border-prism-sky/35 bg-prism-sky/[0.06] shadow-[0_0_0_1px_rgba(89,221,253,0.05)]"
          : "border-white/6 bg-white/[0.025] hover:border-white/12"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-prism-text">
            {lever.targetLabel}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-prism-muted">
            {lever.description}
          </p>
        </div>
        {isActivated && (
          <span className="rounded-full bg-prism-sky/15 px-1.5 py-0.5 text-[9px] font-mono text-prism-sky">
            active
          </span>
        )}
      </div>

      <div className="mt-3">
        {sectionKey === "tensions" && lever.options && (
          <TensionControl
            lever={lever}
            isActivated={isActivated}
            activatedLever={activatedLever}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
          />
        )}
        {sectionKey === "gaps" && (
          <GapControl
            lever={lever}
            isActivated={isActivated}
            activatedLever={activatedLever}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
          />
        )}
        {sectionKey === "findings" && (
          <FindingControl
            lever={lever}
            isActivated={isActivated}
            activatedLever={activatedLever}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
          />
        )}
        {sectionKey === "metrics" && (
          <MetricControl
            lever={lever}
            isActivated={isActivated}
            activatedLever={activatedLever}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
          />
        )}
      </div>
    </div>
  );
}

function TensionControl({
  lever,
  isActivated,
  activatedLever,
  onActivate,
  onDeactivate,
}: {
  lever: AvailableLever;
  isActivated: boolean;
  activatedLever?: CreateLeverInput;
  onActivate: (lever: CreateLeverInput) => void;
  onDeactivate: (targetId: string) => void;
}) {
  const selectedIdx = isActivated
    ? (activatedLever?.adjusted as { winningPosition: number })?.winningPosition
    : undefined;

  return (
    <div className="space-y-1.5">
      {lever.options?.map((option, idx) => (
        <button
          key={idx}
          onClick={() => {
            if (isActivated && selectedIdx === idx) {
              onDeactivate(lever.targetId);
            } else {
              onActivate({
                leverType: "tension_flip",
                targetId: lever.targetId,
                targetLabel: lever.targetLabel,
                baseline: lever.currentValue,
                adjusted: { winningPosition: idx },
              });
            }
          }}
          className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[10px] transition-all ${
            selectedIdx === idx
              ? "border-prism-sky/30 bg-prism-sky/15 text-prism-sky"
              : "border-transparent bg-white/4 text-prism-muted hover:bg-white/7"
          }`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
          <span className="flex-1 truncate">{option.label}</span>
          <span className="shrink-0 text-[9px] opacity-70">
            {(option.confidence * 100).toFixed(0)}%
          </span>
        </button>
      ))}
    </div>
  );
}

function GapControl({
  lever,
  isActivated,
  activatedLever,
  onActivate,
  onDeactivate,
}: {
  lever: AvailableLever;
  isActivated: boolean;
  activatedLever?: CreateLeverInput;
  onActivate: (lever: CreateLeverInput) => void;
  onDeactivate: (targetId: string) => void;
}) {
  const directions = ["optimistic", "pessimistic", "neutral"] as const;
  const selectedDirection = isActivated
    ? (activatedLever?.adjusted as { direction: string })?.direction
    : undefined;

  return (
    <div className="flex gap-1.5">
      {directions.map((dir) => (
        <button
          key={dir}
          onClick={() => {
            if (isActivated && selectedDirection === dir) {
              onDeactivate(lever.targetId);
            } else {
              onActivate({
                leverType: "gap_resolve",
                targetId: lever.targetId,
                targetLabel: lever.targetLabel,
                baseline: lever.currentValue,
                adjusted: {
                  direction: dir,
                  assumption: `${dir} resolution of: ${lever.targetLabel}`,
                },
              });
            }
          }}
          className={`flex-1 rounded-xl border px-2 py-2 text-[10px] font-medium transition-all ${
            selectedDirection === dir
              ? dir === "optimistic"
                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                : dir === "pessimistic"
                  ? "border-red-500/30 bg-red-500/20 text-red-300"
                  : "border-amber-500/30 bg-amber-500/20 text-amber-300"
              : "border-transparent bg-white/4 text-prism-muted hover:bg-white/7"
          }`}
        >
          {dir.charAt(0).toUpperCase() + dir.slice(1)}
        </button>
      ))}
    </div>
  );
}

function FindingControl({
  lever,
  isActivated,
  activatedLever,
  onActivate,
  onDeactivate,
}: {
  lever: AvailableLever;
  isActivated: boolean;
  activatedLever?: CreateLeverInput;
  onActivate: (lever: CreateLeverInput) => void;
  onDeactivate: (targetId: string) => void;
}) {
  const weight = isActivated ? (activatedLever?.adjusted as number) ?? 1 : 1;

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[9px] text-prism-muted">
        {weight < 1 ? "Down" : weight > 1 ? "Up" : "Flat"}
      </span>
      <input
        type="range"
        min="0"
        max="200"
        step="10"
        value={weight * 100}
        onChange={(e) => {
          const newWeight = parseInt(e.target.value, 10) / 100;
          if (Math.abs(newWeight - 1) < 0.05) {
            onDeactivate(lever.targetId);
          } else {
            onActivate({
              leverType:
                newWeight < 1 ? "finding_suppress" : "finding_amplify",
              targetId: lever.targetId,
              targetLabel: lever.targetLabel,
              baseline: lever.currentValue,
              adjusted: newWeight,
            });
          }
        }}
        className="h-1.5 flex-1 accent-prism-sky"
      />
      <span className="w-11 text-right text-[9px] font-mono text-prism-muted">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function MetricControl({
  lever,
  isActivated,
  activatedLever,
  onActivate,
  onDeactivate,
}: {
  lever: AvailableLever;
  isActivated: boolean;
  activatedLever?: CreateLeverInput;
  onActivate: (lever: CreateLeverInput) => void;
  onDeactivate: (targetId: string) => void;
}) {
  const multiplier = isActivated
    ? ((activatedLever?.adjusted as { multiplier?: number })?.multiplier ?? 1)
    : 1;

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[9px] text-prism-muted">0.5x</span>
      <input
        type="range"
        min="50"
        max="150"
        step="5"
        value={multiplier * 100}
        onChange={(e) => {
          const nextMultiplier = parseInt(e.target.value, 10) / 100;
          if (Math.abs(nextMultiplier - 1) < 0.05) {
            onDeactivate(lever.targetId);
          } else {
            onActivate({
              leverType: "metric_adjust",
              targetId: lever.targetId,
              targetLabel: lever.targetLabel,
              baseline: lever.currentValue,
              adjusted: { multiplier: nextMultiplier },
            });
          }
        }}
        className="h-1.5 flex-1 accent-prism-sky"
      />
      <span className="w-11 text-right text-[9px] font-mono text-prism-muted">
        {multiplier.toFixed(2)}x
      </span>
    </div>
  );
}

function summarizeAdjustedValue(lever: CreateLeverInput): string {
  if (lever.leverType === "tension_flip") {
    const adjusted = lever.adjusted as { winningPosition?: number };
    return `flip to option ${(adjusted.winningPosition ?? 0) + 1}`;
  }

  if (lever.leverType === "gap_resolve") {
    const adjusted = lever.adjusted as { direction?: string };
    return adjusted.direction ?? "assumed";
  }

  if (lever.leverType === "metric_adjust") {
    const adjusted = lever.adjusted as { multiplier?: number };
    return `${(adjusted.multiplier ?? 1).toFixed(2)}x`;
  }

  if (typeof lever.adjusted === "number") {
    return `${Math.round(lever.adjusted * 100)}% weight`;
  }

  return lever.leverType.replace(/_/g, " ");
}
