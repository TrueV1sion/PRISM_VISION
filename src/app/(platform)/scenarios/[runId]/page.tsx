"use client";

import { useState, useEffect, useCallback, use } from "react";
import {
  ArrowLeft,
  Plus,
  GitBranch,
  Loader2,
  Download,
  Columns,
  Shield,
  Telescope,
  Zap,
  Clock3,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import LeverPanel, {
  type LeverPreset,
} from "@/components/scenarios/LeverPanel";
import InsightCanvas from "@/components/scenarios/InsightCanvas";
import ComparisonPanel from "@/components/scenarios/ComparisonPanel";
import type {
  AvailableLevers,
  CreateLeverInput,
  ScenarioDiff,
} from "@/lib/scenarios/types";

interface ScenarioLever {
  id: string;
  leverType: string;
  targetId: string;
  targetLabel: string;
  baseline: unknown;
  adjusted: unknown;
  impact: string | null;
}

interface ScenarioResult {
  id: string;
  confidenceShift: number;
  computedAt: string;
  briefPath?: string | null;
  memoPath?: string | null;
}

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  levers: ScenarioLever[];
  result: ScenarioResult | null;
  children: Array<{ id: string; name: string; status: string }>;
}

interface RunInfo {
  id: string;
  query: string;
  tier: string;
  status: string;
  completedAt: string | null;
}

interface CompareTarget {
  id: string;
  name: string;
}

export default function ScenarioExplorerPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [availableLevers, setAvailableLevers] = useState<AvailableLevers | null>(
    null,
  );
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [activatedLevers, setActivatedLevers] = useState<CreateLeverInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [diff, setDiff] = useState<ScenarioDiff | null>(null);
  const [showNewScenario, setShowNewScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(null);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [isForecasting, setIsForecasting] = useState(false);
  const [stressTestStatus, setStressTestStatus] = useState<string | null>(null);
  const [forecastStatus, setForecastStatus] = useState<string | null>(null);

  const loadScenarios = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/scenarios`);
      if (!res.ok) return;
      const data = await res.json();
      setRunInfo(data.run);
      setScenarios(data.scenarios);
      if (data.availableLevers) {
        setAvailableLevers(data.availableLevers);
      }
    } catch (err) {
      console.error("Failed to load scenarios:", err);
    }
  }, [runId]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadScenarios();
      setIsLoading(false);
    };
    init();
  }, [loadScenarios]);

  useEffect(() => {
    if (!isComputing || !activeScenarioId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scenarios/${activeScenarioId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "complete") {
          setIsComputing(false);
          const diffRes = await fetch(
            `/api/scenarios/${activeScenarioId}/diff/baseline`,
          );
          if (diffRes.ok) {
            const diffData = await diffRes.json();
            setDiff(diffData.diff);
          }
          loadScenarios();
        } else if (data.status === "failed") {
          setIsComputing(false);
          loadScenarios();
        }
      } catch {
        // Ignore transient polling failures.
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeScenarioId, isComputing, loadScenarios]);

  const startScenarioCompute = useCallback(
    async (scenarioId: string) => {
      setIsComputing(true);
      setDiff(null);
      await fetch(`/api/scenarios/${scenarioId}/compute`, { method: "POST" });
      loadScenarios();
    },
    [loadScenarios],
  );

  const createScenario = async (options?: { compute?: boolean; levers?: CreateLeverInput[] }) => {
    const name = newScenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    const leversToPersist = options?.levers ?? activatedLevers;

    try {
      const res = await fetch(`/api/runs/${runId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          levers: leversToPersist.length > 0 ? leversToPersist : undefined,
        }),
      });
      if (!res.ok) return;

      const scenario = (await res.json()) as Scenario;
      setActiveScenarioId(scenario.id);
      setShowNewScenario(false);
      setNewScenarioName("");
      setActivatedLevers(leversToPersist);
      await loadScenarios();

      if (options?.compute) {
        await startScenarioCompute(scenario.id);
      }
    } catch (err) {
      console.error("Failed to create scenario:", err);
      setIsComputing(false);
    }
  };

  const computeScenario = async () => {
    if (!activeScenarioId) {
      await createScenario({ compute: true });
      return;
    }

    try {
      await fetch(`/api/scenarios/${activeScenarioId}/levers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levers: activatedLevers }),
      });
      await startScenarioCompute(activeScenarioId);
    } catch (err) {
      setIsComputing(false);
      console.error("Failed to compute scenario:", err);
    }
  };

  const selectScenario = async (scenario: Scenario) => {
    setActiveScenarioId(scenario.id);
    setActivatedLevers(
      scenario.levers.map((lever) => ({
        leverType: lever.leverType as CreateLeverInput["leverType"],
        targetId: lever.targetId,
        targetLabel: lever.targetLabel,
        baseline: lever.baseline,
        adjusted: lever.adjusted,
      })),
    );

    if (scenario.status === "complete") {
      try {
        const res = await fetch(`/api/scenarios/${scenario.id}/diff/baseline`);
        if (res.ok) {
          const data = await res.json();
          setDiff(data.diff);
        }
      } catch {
        setDiff(null);
      }
      return;
    }

    if (scenario.status === "computing") {
      setIsComputing(true);
    } else {
      setIsComputing(false);
    }
    setDiff(null);
  };

  const resetScenario = async (scenarioId: string) => {
    try {
      await fetch(`/api/scenarios/${scenarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      setIsComputing(false);
      setDiff(null);
      loadScenarios();
    } catch {
      // Ignore reset failures here; the UI remains interactive.
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      await fetch(`/api/scenarios/${scenarioId}`, { method: "DELETE" });
      if (activeScenarioId === scenarioId) {
        setActiveScenarioId(null);
        setActivatedLevers([]);
        setDiff(null);
        setCompareTarget(null);
      }
      loadScenarios();
    } catch {
      // Ignore delete failures here; reload will reconcile state later.
    }
  };

  const triggerStressTest = async () => {
    if (!activeScenarioId || isStressTesting) return;
    setIsStressTesting(true);
    setStressTestStatus("Deploying adversarial agents...");
    try {
      const res = await fetch(`/api/scenarios/${activeScenarioId}/stress-test`, {
        method: "POST",
      });
      if (!res.ok) {
        setStressTestStatus("Failed to start stress-test");
        setIsStressTesting(false);
        return;
      }
      setStressTestStatus("Stress-test agents running (~60s)...");
      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/scenarios/${activeScenarioId}`);
          if (!checkRes.ok) return;
          const data = await checkRes.json();
          const sensitivity = data.result?.sensitivityMap;
          if (
            Array.isArray(sensitivity) &&
            sensitivity.some((entry: { type?: string }) => entry.type === "stress_test")
          ) {
            clearInterval(pollInterval);
            setIsStressTesting(false);
            setStressTestStatus("Stress-test complete!");
            loadScenarios();
            const diffRes = await fetch(
              `/api/scenarios/${activeScenarioId}/diff/baseline`,
            );
            if (diffRes.ok) {
              const diffData = await diffRes.json();
              setDiff(diffData.diff);
            }
            setTimeout(() => setStressTestStatus(null), 3000);
          }
        } catch {
          // Ignore transient polling failures.
        }
      }, 5000);
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsStressTesting(false);
        setStressTestStatus(null);
      }, 180000);
    } catch (err) {
      console.error("Failed to trigger stress-test:", err);
      setIsStressTesting(false);
      setStressTestStatus("Stress-test failed");
      setTimeout(() => setStressTestStatus(null), 3000);
    }
  };

  const triggerForecast = async () => {
    if (!activeScenarioId || isForecasting) return;
    setIsForecasting(true);
    setForecastStatus("Deploying forecast agents...");
    try {
      const res = await fetch(`/api/scenarios/${activeScenarioId}/forecast`, {
        method: "POST",
      });
      if (!res.ok) {
        setForecastStatus("Failed to start forecast");
        setIsForecasting(false);
        return;
      }
      setForecastStatus("Forecast agents running (~60s)...");
      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/scenarios/${activeScenarioId}`);
          if (!checkRes.ok) return;
          const data = await checkRes.json();
          const sensitivity = data.result?.sensitivityMap;
          if (
            Array.isArray(sensitivity) &&
            sensitivity.some((entry: { type?: string }) => entry.type === "forecast")
          ) {
            clearInterval(pollInterval);
            setIsForecasting(false);
            setForecastStatus("Forecast complete!");
            loadScenarios();
            const diffRes = await fetch(
              `/api/scenarios/${activeScenarioId}/diff/baseline`,
            );
            if (diffRes.ok) {
              const diffData = await diffRes.json();
              setDiff(diffData.diff);
            }
            setTimeout(() => setForecastStatus(null), 3000);
          }
        } catch {
          // Ignore transient polling failures.
        }
      }, 5000);
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsForecasting(false);
        setForecastStatus(null);
      }, 180000);
    } catch (err) {
      console.error("Failed to trigger forecast:", err);
      setIsForecasting(false);
      setForecastStatus("Forecast failed");
      setTimeout(() => setForecastStatus(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-prism-sky" />
      </div>
    );
  }

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId);
  const effectiveCompareTarget =
    compareTarget &&
    (compareTarget.id === "baseline" ||
      scenarios.some((scenario) => scenario.id === compareTarget.id))
      ? compareTarget
      : null;
  const scenarioPresets = buildScenarioPresets(availableLevers);
  const compareOptions = scenarios.filter((scenario) => scenario.id !== activeScenarioId);
  const availableLeverCount = availableLevers
    ? availableLevers.tensions.length +
      availableLevers.gaps.length +
      availableLevers.metrics.length +
      availableLevers.findings.length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(89,221,253,0.07),transparent_28%),radial-gradient(circle_at_top_right,rgba(78,132,196,0.08),transparent_32%),#050912]">
      <div className="border-b border-white/8 bg-[#07101d]/80 backdrop-blur">
        <div className="px-6 py-5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Link
                  href="/history"
                  className="rounded-xl border border-white/10 p-2 text-prism-muted transition-colors hover:border-white/20 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-prism-muted">
                    Strategic Simulation Lab
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-prism-sky" />
                    <h1 className="text-xl font-semibold text-prism-text">
                      Scenario Explorer
                    </h1>
                  </div>
                </div>
              </div>
              {runInfo && (
                <p className="mt-4 max-w-4xl text-sm leading-relaxed text-prism-muted">
                  {runInfo.query}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill label={`Tier ${runInfo?.tier ?? "Unknown"}`} />
                <Pill label={`${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}`} />
                <Pill label={`${availableLeverCount} available levers`} />
                <Pill label={`${activatedLevers.length} active levers`} accent="text-prism-sky" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              <HeaderStat
                label="Scenario status"
                value={activeScenario ? titleCase(activeScenario.status) : "Baseline"}
                sublabel={
                  activeScenario?.result?.computedAt
                    ? `Computed ${formatShortDate(activeScenario.result.computedAt)}`
                    : runInfo?.completedAt
                      ? `Run complete ${formatShortDate(runInfo.completedAt)}`
                      : "Select or create a scenario"
                }
              />
              <HeaderStat
                label="Workbench"
                value={activeScenario ? activeScenario.name : "New scenario"}
                sublabel={
                  activeScenario
                    ? `${activeScenario.levers.length} persisted levers`
                    : "Use presets or custom levers"
                }
              />
              <HeaderStat
                label="Compute lane"
                value={isComputing ? "Running" : "Ready"}
                sublabel={isComputing ? "Re-synthesizing active scenario" : "Scenario synthesis only"}
                accent={isComputing ? "text-amber-300" : "text-emerald-300"}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/6 px-6 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
              Scenario rail
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewScenario((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-medium text-prism-text transition-colors hover:border-prism-sky/30 hover:text-prism-sky"
              >
                <Plus className="h-3.5 w-3.5" />
                New scenario
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            <ScenarioRailCard
              title="Baseline"
              subtitle={runInfo?.tier ?? "Run"}
              meta={`${availableLeverCount} levers available`}
              isActive={!activeScenarioId}
              status="baseline"
              onClick={() => {
                setActiveScenarioId(null);
                setActivatedLevers([]);
                setDiff(null);
                setIsComputing(false);
                setCompareTarget(null);
              }}
            />
            {scenarios.map((scenario) => (
              <ScenarioRailCard
                key={scenario.id}
                title={scenario.name}
                subtitle={scenario.description ?? titleCase(scenario.status)}
                meta={`${scenario.levers.length} levers · ${scenario.children.length} branch${scenario.children.length === 1 ? "" : "es"}`}
                isActive={activeScenarioId === scenario.id}
                status={scenario.status}
                confidenceShift={scenario.result?.confidenceShift ?? null}
                onClick={() => selectScenario(scenario)}
                onDelete={() => deleteScenario(scenario.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {showNewScenario && (
        <div className="border-b border-prism-sky/10 bg-prism-sky/[0.06] px-6 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
                Scenario name
              </label>
              <input
                type="text"
                placeholder="Expansion case, downside shock, regulatory flip..."
                value={newScenarioName}
                onChange={(event) => setNewScenarioName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void createScenario();
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07101d] px-4 py-3 text-sm text-prism-text placeholder:text-prism-muted/60 focus:border-prism-sky/40 focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={() => void createScenario()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-prism-text transition-colors hover:border-white/20 hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
              Create draft
            </button>
            <button
              onClick={() => void createScenario({ compute: true })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-prism-sky/85 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-prism-sky"
            >
              <Zap className="h-4 w-4" />
              Create + compute
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-white/6 bg-[#060c17]/70 px-6 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceAction
              icon={Shield}
              label={isStressTesting ? "Stress-testing..." : stressTestStatus ?? "Stress test"}
              disabled={!activeScenario || activeScenario.status !== "complete" || isStressTesting}
              onClick={() => void triggerStressTest()}
              tone={isStressTesting ? "warn" : stressTestStatus ? "success" : "default"}
            />
            <WorkspaceAction
              icon={Telescope}
              label={isForecasting ? "Forecasting..." : forecastStatus ?? "Forecast"}
              disabled={!activeScenario || activeScenario.status !== "complete" || isForecasting}
              onClick={() => void triggerForecast()}
              tone={isForecasting ? "info" : forecastStatus ? "success" : "default"}
            />
            <WorkspaceAction
              icon={Download}
              label="Export memo"
              href={`/api/run/${runId}/export?format=executive-memo`}
              disabled={!activeScenario || activeScenario.status !== "complete"}
            />
            {isComputing && activeScenarioId && (
              <WorkspaceAction
                icon={Loader2}
                label="Reset run"
                onClick={() => void resetScenario(activeScenarioId)}
                tone="warn"
              />
            )}
          </div>

          {activeScenario?.status === "complete" && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
                Compare against
              </label>
              <div className="relative">
                <Columns className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prism-muted" />
                <select
                  value={effectiveCompareTarget?.id ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      setCompareTarget(null);
                      return;
                    }
                    if (value === "baseline") {
                      setCompareTarget({ id: "baseline", name: "Baseline" });
                      return;
                    }
                    const target = compareOptions.find((scenario) => scenario.id === value);
                    if (target) {
                      setCompareTarget({ id: target.id, name: target.name });
                    }
                  }}
                  className="rounded-xl border border-white/10 bg-[#07101d] py-2 pl-9 pr-10 text-[11px] text-prism-text focus:border-prism-sky/35 focus:outline-none"
                >
                  <option value="">No comparison</option>
                  <option value="baseline">Baseline</option>
                  {compareOptions.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="order-2 w-full border-t border-white/8 bg-[#070d18]/70 xl:order-1 xl:w-[360px] xl:border-r xl:border-t-0">
          {availableLevers ? (
            <LeverPanel
              availableLevers={availableLevers}
              activatedLevers={activatedLevers}
              onLeversChange={setActivatedLevers}
              isComputing={isComputing}
              onCompute={computeScenario}
              onClear={() => setActivatedLevers([])}
              presets={scenarioPresets}
              onApplyPreset={(preset) => setActivatedLevers(preset.levers)}
              scenarioName={activeScenario?.name ?? "New scenario"}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-5">
              <p className="text-center text-xs leading-relaxed text-prism-muted">
                Scenario levers are only available after a run completes and an
                IR graph has been persisted.
              </p>
            </div>
          )}
        </div>

        <div className="order-1 min-w-0 flex-1 xl:order-2">
          <div className="border-b border-white/6 bg-white/[0.02] px-6 py-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
                      Active workspace
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-prism-text">
                      {activeScenario?.name ?? "Baseline workspace"}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-prism-muted">
                      {activeScenario
                        ? activeScenario.description ??
                          "Working scenario branch ready for recompute, comparison, and stress-testing."
                        : "Start from baseline, or create a draft scenario to explore specific assumption changes."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${
                      activeScenario?.status === "complete"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : activeScenario?.status === "computing"
                          ? "bg-amber-500/15 text-amber-300"
                          : activeScenario?.status === "failed"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-white/10 text-prism-muted"
                    }`}
                  >
                    {activeScenario ? titleCase(activeScenario.status) : "Baseline"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  icon={Clock3}
                  label="Last compute"
                  value={
                    activeScenario?.result?.computedAt
                      ? formatShortDate(activeScenario.result.computedAt)
                      : runInfo?.completedAt
                        ? formatShortDate(runInfo.completedAt)
                        : "Not yet"
                  }
                />
                <MiniStat
                  icon={Zap}
                  label="Persisted levers"
                  value={`${activeScenario?.levers.length ?? activatedLevers.length}`}
                />
              </div>
            </div>
          </div>

          <InsightCanvas
            diff={diff}
            isComputing={isComputing}
            scenarioName={activeScenario?.name ?? "New scenario"}
          />
        </div>

        <div className="order-3 w-full border-t border-white/8 bg-[#070d18]/70 xl:w-[360px] xl:border-l xl:border-t-0">
          {effectiveCompareTarget && activeScenarioId && activeScenario?.status === "complete" ? (
            <ComparisonPanel
              scenarioAId={activeScenarioId}
              scenarioAName={activeScenario.name}
              scenarioBId={effectiveCompareTarget.id}
              scenarioBName={effectiveCompareTarget.name}
              onClose={() => setCompareTarget(null)}
            />
          ) : (
            <ScenarioContextPanel
              scenario={activeScenario}
              activatedLevers={activatedLevers}
              diff={diff}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function buildScenarioPresets(
  availableLevers: AvailableLevers | null,
): LeverPreset[] {
  if (!availableLevers) return [];

  const presets: LeverPreset[] = [];
  const topFindings = availableLevers.findings.slice(0, 3);
  const topGaps = availableLevers.gaps.slice(0, 2);
  const topTensions = availableLevers.tensions.slice(0, 2);

  const resolveUnknowns = topGaps.map((gap) => ({
    leverType: "gap_resolve" as const,
    targetId: gap.targetId,
    targetLabel: gap.targetLabel,
    baseline: gap.currentValue,
    adjusted: {
      direction: "neutral",
      assumption: `Neutral resolution of: ${gap.targetLabel}`,
    },
  }));
  if (resolveUnknowns.length > 0) {
    presets.push({
      id: "resolve-unknowns",
      name: "Resolve Unknowns",
      description: "Fill the biggest open gaps with neutral assumptions first.",
      levers: resolveUnknowns,
    });
  }

  const upsideCase = [
    ...topGaps.slice(0, 1).map((gap) => ({
      leverType: "gap_resolve" as const,
      targetId: gap.targetId,
      targetLabel: gap.targetLabel,
      baseline: gap.currentValue,
      adjusted: {
        direction: "optimistic",
        assumption: `Optimistic resolution of: ${gap.targetLabel}`,
      },
    })),
    ...topFindings.slice(0, 2).map((finding) => ({
      leverType: "finding_amplify" as const,
      targetId: finding.targetId,
      targetLabel: finding.targetLabel,
      baseline: finding.currentValue,
      adjusted: 1.35,
    })),
  ];
  if (upsideCase.length > 0) {
    presets.push({
      id: "upside-case",
      name: "Upside Case",
      description: "Boost the strongest findings and resolve one key unknown optimistically.",
      levers: upsideCase,
    });
  }

  const downsideCase = [
    ...topGaps.slice(0, 1).map((gap) => ({
      leverType: "gap_resolve" as const,
      targetId: gap.targetId,
      targetLabel: gap.targetLabel,
      baseline: gap.currentValue,
      adjusted: {
        direction: "pessimistic",
        assumption: `Pessimistic resolution of: ${gap.targetLabel}`,
      },
    })),
    ...topFindings.slice(0, 2).map((finding) => ({
      leverType: "finding_suppress" as const,
      targetId: finding.targetId,
      targetLabel: finding.targetLabel,
      baseline: finding.currentValue,
      adjusted: 0.65,
    })),
  ];
  if (downsideCase.length > 0) {
    presets.push({
      id: "downside-case",
      name: "Downside Case",
      description: "Pressure the key claims and assume the most adverse missing answer.",
      levers: downsideCase,
    });
  }

  const tensionFlip = topTensions
    .filter((tension) => (tension.options?.length ?? 0) > 1)
    .map((tension) => {
      const winningPosition = findLowestConfidenceOptionIndex(tension);
      return {
        leverType: "tension_flip" as const,
        targetId: tension.targetId,
        targetLabel: tension.targetLabel,
        baseline: tension.currentValue,
        adjusted: { winningPosition },
      };
    });
  if (tensionFlip.length > 0) {
    presets.push({
      id: "tension-flip",
      name: "Tension Flip",
      description: "Force a contrarian resolution on the most visible open tensions.",
      levers: tensionFlip,
    });
  }

  const convictionTest = topFindings.map((finding, index) => ({
    leverType: index === 0 ? ("finding_suppress" as const) : ("finding_amplify" as const),
    targetId: finding.targetId,
    targetLabel: finding.targetLabel,
    baseline: finding.currentValue,
    adjusted: index === 0 ? 0.6 : 1.2,
  }));
  if (convictionTest.length > 0) {
    presets.push({
      id: "conviction-test",
      name: "Conviction Test",
      description: "Suppress one core claim and strengthen the next ones to test narrative resilience.",
      levers: convictionTest,
    });
  }

  return presets;
}

function findLowestConfidenceOptionIndex(lever: AvailableLevers["tensions"][number]) {
  if (!lever.options || lever.options.length === 0) return 0;

  let lowestIndex = 0;
  let lowestConfidence = lever.options[0]?.confidence ?? 0;

  for (let index = 1; index < lever.options.length; index++) {
    const confidence = lever.options[index]?.confidence ?? 0;
    if (confidence < lowestConfidence) {
      lowestConfidence = confidence;
      lowestIndex = index;
    }
  }

  return lowestIndex;
}

function ScenarioRailCard({
  title,
  subtitle,
  meta,
  isActive,
  status,
  confidenceShift,
  onClick,
  onDelete,
}: {
  title: string;
  subtitle: string;
  meta: string;
  isActive: boolean;
  status: string;
  confidenceShift?: number | null;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative min-w-[240px] rounded-[24px] border px-4 py-4 text-left transition-all ${
        isActive
          ? "border-prism-sky/35 bg-prism-sky/[0.12] shadow-[0_0_0_1px_rgba(89,221,253,0.05)]"
          : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "complete"
                  ? "bg-emerald-400"
                  : status === "computing"
                    ? "animate-pulse bg-amber-400"
                    : status === "failed"
                      ? "bg-red-400"
                      : status === "baseline"
                        ? "bg-prism-sky"
                        : "bg-white/40"
              }`}
            />
            <div className="text-sm font-semibold text-prism-text">{title}</div>
          </div>
          <div className="mt-1 text-[11px] text-prism-muted">{subtitle}</div>
        </div>
        {onDelete && (
          <span
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1 text-prism-muted opacity-0 transition-opacity hover:bg-white/5 hover:text-red-300 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
          {meta}
        </div>
        {typeof confidenceShift === "number" && (
          <div
            className={`rounded-full px-2 py-1 text-[10px] font-mono ${
              confidenceShift >= 0
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {confidenceShift >= 0 ? "+" : ""}
            {(confidenceShift * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </button>
  );
}

function ScenarioContextPanel({
  scenario,
  activatedLevers,
  diff,
}: {
  scenario: Scenario | undefined;
  activatedLevers: CreateLeverInput[];
  diff: ScenarioDiff | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
          Scenario notebook
        </div>
        <h3 className="mt-1 text-sm font-semibold text-prism-text">
          {scenario?.name ?? "Baseline notes"}
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-prism-muted">
          {scenario
            ? scenario.description ??
              "Track the active branch, its persisted levers, and the latest synthesis movement."
            : "Create a scenario or select an existing branch to inspect its assumptions and impact."}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <NotebookCard
          title="Current selection"
          body={
            scenario
              ? `${scenario.levers.length} persisted lever${scenario.levers.length === 1 ? "" : "s"} · ${titleCase(scenario.status)}`
              : `${activatedLevers.length} active lever${activatedLevers.length === 1 ? "" : "s"} staged on baseline`
          }
        />
        <NotebookCard
          title="Change summary"
          body={diff?.summary ?? "No computed diff yet. Apply levers and run compute to populate the change map."}
        />
        <NotebookCard
          title="Active lever stack"
          body={
            activatedLevers.length === 0
              ? "No active levers selected."
              : activatedLevers
                  .slice(0, 6)
                  .map((lever) => `${lever.targetLabel} (${lever.leverType.replace(/_/g, " ")})`)
                  .join(" · ")
          }
        />
      </div>
    </div>
  );
}

function NotebookCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-prism-muted">
        {title}
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-prism-text/85">
        {body}
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  sublabel,
  accent = "text-prism-text",
}: {
  label: string;
  value: string;
  sublabel: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-prism-muted">
        {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${accent}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-prism-muted">
        {sublabel}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center gap-2 text-prism-muted">
        <Icon className="h-4 w-4 text-prism-sky" />
        <span className="text-[10px] font-mono uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-prism-text">{value}</div>
    </div>
  );
}

function WorkspaceAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  tone = "default",
}: {
  icon: typeof Shield;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "warn" | "info" | "success";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300 border-amber-500/20 bg-amber-500/[0.08]"
      : tone === "info"
        ? "text-prism-sky border-prism-sky/20 bg-prism-sky/[0.08]"
        : tone === "success"
          ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.08]"
          : "text-prism-muted border-white/10 bg-white/[0.03] hover:text-prism-text";

  const content = (
    <>
      <Icon className={`h-3.5 w-3.5 ${label.includes("...") ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors ${
          disabled ? "pointer-events-none opacity-40" : toneClass
        }`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition-colors ${
        disabled ? "cursor-not-allowed opacity-40" : toneClass
      }`}
    >
      {content}
    </button>
  );
}

function Pill({
  label,
  accent = "text-prism-muted",
}: {
  label: string;
  accent?: string;
}) {
  return (
    <span
      className={`rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${accent}`}
    >
      {label}
    </span>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
