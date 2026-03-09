"use client";

import type { Phase } from "@/lib/types";

const PIPELINE_STEPS: { phase: Phase[]; label: string }[] = [
    { phase: ["executing"], label: "Think" },
    { phase: ["executing"], label: "Construct" },
    { phase: ["executing"], label: "Deploy" },
    { phase: ["triage"], label: "Triage" },
    { phase: ["synthesis"], label: "Synthesize" },
    { phase: ["complete"], label: "Complete" },
];

// Map effective phases to step index
function getStepIndex(phase: Phase, streamPhase?: string): number {
    if (phase === "complete") return 5;
    if (phase === "synthesis") return 4;
    if (phase === "triage") return 3;
    if (phase === "executing") {
        if (streamPhase === "deploy") return 2;
        if (streamPhase === "construct") return 1;
        return 0; // think
    }
    return -1;
}

export default function PipelineStepper({
    phase,
    streamPhase,
}: {
    phase: Phase;
    streamPhase?: string;
}) {
    const currentStep = getStepIndex(phase, streamPhase);

    // Only show during pipeline execution
    if (currentStep < 0) return null;

    return (
        <div className="flex items-center justify-center gap-1 px-4 py-2">
            {PIPELINE_STEPS.map((step, i) => {
                const isComplete = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                    <div key={step.label} className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5">
                            <div
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                    isComplete
                                        ? "bg-prism-jade"
                                        : isCurrent
                                            ? "bg-prism-sky animate-pulse"
                                            : "bg-white/10"
                                }`}
                            />
                            <span
                                className={`text-[10px] font-mono transition-colors ${
                                    isComplete
                                        ? "text-prism-jade"
                                        : isCurrent
                                            ? "text-prism-sky"
                                            : "text-prism-muted/40"
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                        {i < PIPELINE_STEPS.length - 1 && (
                            <div
                                className={`w-6 h-px mx-1 transition-colors ${
                                    i < currentStep ? "bg-prism-jade/50" : "bg-white/5"
                                }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
