"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  RotateCcw,
  Bold,
  Italic,
  BarChart3,
  FileText,
  Type,
} from "lucide-react";
import type { SlideContent } from "@/lib/pipeline/present/types";

interface SlideVersion {
  id: string;
  slideNumber: number;
  templateId: string | null;
  backgroundVariant: string;
  animationType: string;
  content: Record<string, unknown>;
  sourceAgentIds: string[];
  sourceFindingIds: string[];
}

interface SlideCanvasProps {
  slide: SlideVersion | null;
  onUpdate: (content: Partial<SlideContent>) => void;
}

/** Background variant to gradient class mapping */
const BG_GRADIENTS: Record<string, string> = {
  "gradient-dark": "from-[#0a0f1e] to-[#111827]",
  "gradient-blue": "from-[#0a0f2e] to-[#1e3a5f]",
  "gradient-radial": "from-[#1a0a2e] to-[#0f0f1e]",
  "dark-mesh": "from-[#0f1520] to-[#1a1f2e]",
  "dark-particles": "from-[#0a0a20] to-[#151530]",
};

export default function SlideCanvas({ slide, onUpdate }: SlideCanvasProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Parse content from the Record<string, unknown> to SlideContent
  const content: SlideContent = (slide?.content as SlideContent) ?? {};

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        setToolbarPos({
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top - 40,
        });
        setShowToolbar(true);
      }
    } else {
      setShowToolbar(false);
    }
  }, []);

  const handleContentEdit = (
    field: keyof SlideContent,
    value: string
  ) => {
    onUpdate({ [field]: value });
  };

  const handleStatEdit = (
    index: number,
    key: "label" | "value",
    value: string
  ) => {
    if (!content.stats) return;
    const updated = [...content.stats];
    updated[index] = { ...updated[index], [key]: value };
    onUpdate({ stats: updated });
  };

  if (!slide) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050a14]">
        <p className="text-sm text-prism-muted/50">
          Select a slide to begin editing
        </p>
      </div>
    );
  }

  const bgClass =
    BG_GRADIENTS[slide.backgroundVariant] ?? BG_GRADIENTS["gradient-dark"];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#050a14]">
      {/* Canvas toolbar */}
      <div className="px-4 py-2 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono text-prism-muted">
          <span>Slide {slide.slideNumber}</span>
          {slide.templateId && (
            <>
              <span className="text-white/20">&middot;</span>
              <span className="text-prism-sky/70">{slide.templateId}</span>
            </>
          )}
          <span className="text-white/20">&middot;</span>
          <span>{slide.animationType}</span>
        </div>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] text-prism-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          title="Revert to original generated content"
        >
          <RotateCcw className="w-3 h-3" />
          Revert to Original
        </button>
      </div>

      {/* Slide preview canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-y-auto p-8 flex items-start justify-center relative"
        onMouseUp={handleTextSelection}
      >
        {/* Floating toolbar on text selection */}
        {showToolbar && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 flex items-center gap-0.5 bg-[#1a1f2e] border border-white/15 rounded-lg px-1 py-0.5 shadow-xl shadow-black/40"
            style={{ left: toolbarPos.x, top: toolbarPos.y, transform: "translateX(-50%)" }}
          >
            <button className="p-1.5 rounded hover:bg-white/10 text-prism-muted hover:text-white transition-colors">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded hover:bg-white/10 text-prism-muted hover:text-white transition-colors">
              <Italic className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={slide.id}
          className={`w-full max-w-4xl rounded-2xl bg-gradient-to-br ${bgClass} border border-white/8 shadow-2xl shadow-black/50 overflow-hidden`}
        >
          {/* Slide content */}
          <div className="p-10 space-y-6 min-h-[420px]">
            {/* Headline — contentEditable */}
            <EditableRegion
              label="Headline"
              icon={<Type className="w-3.5 h-3.5" />}
            >
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  handleContentEdit(
                    "headline",
                    e.currentTarget.textContent ?? ""
                  )
                }
                className="text-2xl font-bold text-white leading-tight outline-none focus:ring-1 focus:ring-prism-sky/30 focus:bg-white/[0.02] rounded-lg px-2 py-1 -mx-2 -my-1 transition-all"
              >
                {content.headline || ""}
              </div>
              {!content.headline && (
                <p className="text-2xl font-bold text-white/20 italic pointer-events-none absolute inset-0 px-2 py-1">
                  Slide title...
                </p>
              )}
            </EditableRegion>

            {/* Body — contentEditable */}
            <EditableRegion
              label="Body"
              icon={<FileText className="w-3.5 h-3.5" />}
            >
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  handleContentEdit(
                    "body",
                    e.currentTarget.textContent ?? ""
                  )
                }
                className="text-sm text-white/70 leading-relaxed outline-none focus:ring-1 focus:ring-prism-sky/30 focus:bg-white/[0.02] rounded-lg px-2 py-1 -mx-2 -my-1 transition-all"
              >
                {content.body || ""}
              </div>
              {!content.body && (
                <p className="text-sm text-white/20 italic pointer-events-none absolute inset-0 px-2 py-1">
                  Slide description...
                </p>
              )}
            </EditableRegion>

            {/* Stats grid */}
            {content.stats && content.stats.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-prism-muted/50 uppercase tracking-wider mb-2">
                  Key Metrics
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {content.stats.map((stat, i) => (
                    <div
                      key={i}
                      className="group/stat bg-white/5 rounded-xl p-4 border border-white/8 hover:border-prism-sky/20 transition-all relative"
                    >
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          handleStatEdit(
                            i,
                            "label",
                            e.currentTarget.textContent ?? ""
                          )
                        }
                        className="text-[10px] font-mono text-prism-muted uppercase tracking-wider mb-1 outline-none focus:ring-1 focus:ring-prism-sky/30 rounded px-1 -mx-1"
                      >
                        {stat.label}
                      </div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          handleStatEdit(
                            i,
                            "value",
                            e.currentTarget.textContent ?? ""
                          )
                        }
                        className="text-2xl font-bold text-white outline-none focus:ring-1 focus:ring-prism-sky/30 rounded px-1 -mx-1"
                      >
                        {stat.prefix}
                        {stat.value}
                        {stat.suffix}
                      </div>
                      {/* Pencil overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover/stat:opacity-100 transition-opacity">
                        <Pencil className="w-3 h-3 text-prism-sky/50" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart placeholder */}
            {content.chartData && content.chartData.length > 0 && (
              <div className="bg-white/[0.03] rounded-xl p-5 border border-white/6">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-prism-sky/60" />
                  <span className="text-[10px] font-mono text-prism-muted uppercase tracking-wider">
                    Chart Data
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {content.chartData.map((dp, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-prism-sky/10 text-prism-sky/70 border border-prism-sky/15"
                    >
                      Chart: {dp.type}
                      <span className="text-prism-muted">
                        &middot; {dp.label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Findings list */}
            {content.findings && content.findings.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-mono text-prism-muted/50 uppercase tracking-wider">
                  Findings
                </p>
                {content.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="bg-white/[0.03] rounded-lg p-3 border-l-2 border-prism-sky/30 hover:bg-white/[0.05] transition-colors"
                  >
                    <p className="text-xs text-prism-text leading-relaxed">
                      {finding.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          finding.confidence === "HIGH"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : finding.confidence === "MEDIUM"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {finding.confidence}
                      </span>
                      <span className="text-[9px] text-prism-muted">
                        {finding.sourceTier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Source attribution footer */}
            {content.sources && content.sources.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] font-mono text-prism-muted/50 uppercase tracking-wider mb-1">
                  Sources
                </p>
                <p className="text-[10px] text-prism-muted/40">
                  {content.sources.join(" &middot; ")}
                </p>
              </div>
            )}
          </div>

          {/* Slide footer */}
          <div className="px-10 py-3 border-t border-white/5 flex items-center justify-between text-[9px] text-prism-muted/40">
            <span>PRISM Intelligence</span>
            <span>Slide {slide.slideNumber}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Editable Region Wrapper ──────────────────────────────────

function EditableRegion({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group/edit relative">
      {children}
      {/* Pencil overlay on hover */}
      <div className="absolute -right-2 -top-2 opacity-0 group-hover/edit:opacity-100 transition-opacity pointer-events-none">
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-prism-sky/20 text-prism-sky text-[9px]">
          {icon}
          {label}
        </span>
      </div>
    </div>
  );
}
