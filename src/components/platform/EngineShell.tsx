"use client";

import type { ReactNode } from "react";
import type { EngineManifest } from "@/lib/engines/types";

interface EngineShellProps {
  engine: EngineManifest;
  children: ReactNode;
}

export default function EngineShell({ engine, children }: EngineShellProps) {
  return (
    <div
      data-engine={engine.id}
      className="flex-1 flex flex-col min-h-0"
      style={{
        "--engine-accent": engine.accentColor,
        "--engine-accent-name": engine.accentColorName,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
