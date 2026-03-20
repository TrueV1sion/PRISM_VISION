"use client";

import { motion } from "framer-motion";
import { GripVertical, Plus, Layout } from "lucide-react";

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

interface SlideListProps {
  slides: SlideVersion[];
  activeSlide: number;
  onSelect: (n: number) => void;
  onAdd: () => void;
}

export default function SlideList({
  slides,
  activeSlide,
  onSelect,
  onAdd,
}: SlideListProps) {
  return (
    <div className="w-64 border-r border-white/8 bg-[#080d1a]/60 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layout className="w-3.5 h-3.5 text-prism-muted" />
          <span className="text-[10px] font-mono text-prism-muted uppercase tracking-wider">
            Slides
          </span>
          <span className="text-[9px] font-mono text-prism-sky/60 bg-prism-sky/10 px-1.5 py-0.5 rounded-full">
            {slides.length}
          </span>
        </div>
      </div>

      {/* Slide thumbnail list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
        {slides.map((slide) => {
          const isActive = slide.slideNumber === activeSlide;
          const headline =
            typeof slide.content?.headline === "string"
              ? slide.content.headline
              : null;

          return (
            <motion.button
              key={slide.id}
              onClick={() => onSelect(slide.slideNumber)}
              className={`w-full group relative rounded-lg border transition-all text-left ${
                isActive
                  ? "border-prism-sky/40 bg-prism-sky/10 ring-1 ring-prism-sky/20"
                  : "border-white/6 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"
              }`}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="flex items-start gap-2 px-2.5 py-2.5">
                {/* Drag handle */}
                <div className="mt-0.5 text-white/15 group-hover:text-white/30 transition-colors cursor-grab">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Slide number badge + template ID */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-bold ${
                        isActive
                          ? "bg-prism-sky/25 text-prism-sky"
                          : "bg-white/8 text-prism-muted"
                      }`}
                    >
                      {slide.slideNumber}
                    </span>
                    {slide.templateId && (
                      <span className="text-[8px] font-mono text-prism-sky/50 bg-prism-sky/8 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                        {slide.templateId}
                      </span>
                    )}
                  </div>

                  {/* Headline preview */}
                  <p className="text-[10px] text-prism-text truncate leading-tight">
                    {headline || "Untitled Slide"}
                  </p>
                </div>
              </div>

              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="slideActiveBar"
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-prism-sky"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Add Slide button */}
      <div className="px-2 py-2 border-t border-white/8">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/12 text-prism-muted hover:text-prism-sky hover:border-prism-sky/30 hover:bg-prism-sky/5 transition-all text-[11px] font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Slide
        </button>
      </div>
    </div>
  );
}
