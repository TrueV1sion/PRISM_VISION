"use client";

import { useState } from "react";
import {
  Settings2,
  GitBranch,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  Send,
  Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────

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

interface Annotation {
  id: string;
  authorName: string;
  content: string;
  targetField: string | null;
  resolved: boolean;
  createdAt: string;
  replies: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

interface InspectorPanelProps {
  slide: SlideVersion | null;
  annotations: Annotation[];
  onUpdateProperties: (props: {
    templateId?: string;
    backgroundVariant?: string;
    animationType?: string;
  }) => void;
  onAddAnnotation: (content: string) => void;
  onResolveAnnotation: (id: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────

type InspectorTab = "properties" | "provenance" | "comments";

const TABS: Array<{
  key: InspectorTab;
  label: string;
  icon: typeof Settings2;
}> = [
  { key: "properties", label: "Properties", icon: Settings2 },
  { key: "provenance", label: "Provenance", icon: GitBranch },
  { key: "comments", label: "Comments", icon: MessageSquare },
];

const TEMPLATE_IDS = [
  // Single Focus
  "SF-01-hero-stat",
  "SF-02-full-chart",
  "SF-03-quote-insight",
  "SF-04-section-divider",
  "SF-05-title-slide",
  // Data Viz
  "DV-01-trend-hero",
  "DV-02-composition-donut",
  "DV-03-comparison-bars",
  "DV-04-multi-metric",
  "DV-05-dual-chart",
  "DV-06-sparkline-row",
  "DV-07-counter-grid",
  "DV-08-ranked-list",
  // Content
  "CL-01-two-column",
  "CL-02-three-column-features",
  "CL-03-timeline",
  "CL-04-before-after",
  "CL-05-matrix-quadrant",
  "CL-06-process-flow",
  "CL-07-bullet-insights",
  // Composite
  "CO-01-dashboard",
  "CO-02-scorecard",
  "CO-03-market-map",
  "CO-04-competitive-landscape",
  "CO-05-strategic-recommendation",
];

const BG_VARIANTS = [
  { id: "gradient-dark", label: "Dark", color: "bg-gray-700" },
  { id: "gradient-blue", label: "Blue", color: "bg-blue-700" },
  { id: "gradient-radial", label: "Radial", color: "bg-purple-700" },
  { id: "dark-mesh", label: "Mesh", color: "bg-gray-600" },
  { id: "dark-particles", label: "Particles", color: "bg-indigo-700" },
];

const ANIMATION_TYPES = [
  { id: "anim", label: "Fade In" },
  { id: "anim-scale", label: "Scale" },
  { id: "anim-blur", label: "Blur Fade" },
  { id: "anim-slide-left", label: "Slide Left" },
  { id: "anim-slide-right", label: "Slide Right" },
  { id: "anim-spring", label: "Spring" },
  { id: "anim-fade", label: "Fade" },
  { id: "anim-zoom", label: "Zoom" },
  { id: "stagger-children", label: "Stagger" },
];

// ─── Component ──────────────────────────────────────────────────

export default function InspectorPanel({
  slide,
  annotations,
  onUpdateProperties,
  onAddAnnotation,
  onResolveAnnotation,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
  const [commentText, setCommentText] = useState("");
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  const handleAddComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onAddAnnotation(trimmed);
    setCommentText("");
  };

  if (!slide) {
    return (
      <div className="w-80 border-l border-white/8 bg-[#080d1a]/60 flex items-center justify-center">
        <p className="text-[11px] text-prism-muted/50">No slide selected</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-white/8 bg-[#080d1a]/60 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-white/8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const commentCount =
            tab.key === "comments"
              ? annotations.filter((a) => !a.resolved).length
              : 0;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-medium transition-all relative ${
                isActive
                  ? "text-prism-sky"
                  : "text-prism-muted hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {commentCount > 0 && (
                <span className="absolute -top-0.5 right-2 w-4 h-4 rounded-full bg-prism-sky/25 text-prism-sky text-[8px] font-bold flex items-center justify-center">
                  {commentCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="inspectorTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-prism-sky rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {/* ─── Properties Tab ─── */}
          {activeTab === "properties" && (
            <motion.div
              key="properties"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Template selector */}
              <div>
                <label className="text-[10px] font-mono text-prism-muted uppercase tracking-wider block mb-2">
                  Template
                </label>
                <div className="relative">
                  <button
                    onClick={() =>
                      setTemplateDropdownOpen(!templateDropdownOpen)
                    }
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-prism-text hover:border-white/20 transition-all"
                  >
                    <span className="font-mono truncate">
                      {slide.templateId ?? "None (legacy)"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-prism-muted transition-transform ${
                        templateDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {templateDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-30 top-full mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-[#0d1220] shadow-xl shadow-black/40"
                    >
                      {TEMPLATE_IDS.map((tid) => (
                        <button
                          key={tid}
                          onClick={() => {
                            onUpdateProperties({ templateId: tid });
                            setTemplateDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-white/5 transition-colors ${
                            slide.templateId === tid
                              ? "text-prism-sky bg-prism-sky/10"
                              : "text-prism-muted"
                          }`}
                        >
                          {tid}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Background variant picker */}
              <div>
                <label className="text-[10px] font-mono text-prism-muted uppercase tracking-wider block mb-2">
                  Background
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {BG_VARIANTS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() =>
                        onUpdateProperties({ backgroundVariant: bg.id })
                      }
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                        slide.backgroundVariant === bg.id
                          ? "border-prism-sky/30 bg-prism-sky/10 ring-1 ring-prism-sky/15"
                          : "border-white/6 hover:border-white/15"
                      }`}
                      title={bg.label}
                    >
                      <div className={`w-7 h-7 rounded-md ${bg.color}`} />
                      <span className="text-[8px] text-prism-muted">
                        {bg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Animation type selector */}
              <div>
                <label className="text-[10px] font-mono text-prism-muted uppercase tracking-wider block mb-2">
                  Animation
                </label>
                <div className="space-y-1">
                  {ANIMATION_TYPES.map((anim) => (
                    <button
                      key={anim.id}
                      onClick={() =>
                        onUpdateProperties({ animationType: anim.id })
                      }
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                        slide.animationType === anim.id
                          ? "bg-prism-sky/15 text-prism-sky border border-prism-sky/20"
                          : "text-prism-muted hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      {anim.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Provenance Tab ─── */}
          {activeTab === "provenance" && (
            <motion.div
              key="provenance"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Source agents */}
              <div>
                <label className="text-[10px] font-mono text-prism-muted uppercase tracking-wider block mb-2">
                  Contributing Agents
                </label>
                {slide.sourceAgentIds.length > 0 ? (
                  <div className="space-y-1.5">
                    {slide.sourceAgentIds.map((agent) => (
                      <div
                        key={agent}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8"
                      >
                        <Bot className="w-3.5 h-3.5 text-prism-sky/50" />
                        <span className="text-[10px] font-mono text-prism-text truncate">
                          {agent}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-prism-muted/50 italic">
                    No agent provenance recorded
                  </p>
                )}
              </div>

              {/* Source findings */}
              <div>
                <label className="text-[10px] font-mono text-prism-muted uppercase tracking-wider block mb-2">
                  Source Findings
                </label>
                {slide.sourceFindingIds.length > 0 ? (
                  <div className="space-y-1">
                    {slide.sourceFindingIds.map((fid) => (
                      <div
                        key={fid}
                        className="text-[9px] font-mono text-prism-muted/70 bg-white/[0.02] border border-white/6 rounded-md px-2.5 py-1.5 truncate"
                      >
                        {fid}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-prism-muted/50 italic">
                    No finding references recorded
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── Comments Tab ─── */}
          {activeTab === "comments" && (
            <motion.div
              key="comments"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-h-0"
            >
              {/* Annotation list */}
              <div className="flex-1 space-y-3 mb-4">
                {annotations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-6 h-6 text-prism-muted/30 mx-auto mb-2" />
                    <p className="text-[10px] text-prism-muted/50">
                      No comments yet
                    </p>
                  </div>
                ) : (
                  annotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className={`rounded-lg border p-3 transition-all ${
                        annotation.resolved
                          ? "border-white/5 bg-white/[0.01] opacity-50"
                          : "border-white/8 bg-white/[0.03]"
                      }`}
                    >
                      {/* Author + timestamp */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-prism-text">
                          {annotation.authorName}
                        </span>
                        <span className="text-[9px] text-prism-muted/50">
                          {formatTimestamp(annotation.createdAt)}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-[11px] text-prism-muted leading-relaxed mb-2">
                        {annotation.content}
                      </p>

                      {/* Target field badge */}
                      {annotation.targetField && (
                        <span className="inline-block text-[8px] font-mono px-1.5 py-0.5 rounded bg-prism-sky/10 text-prism-sky/60 mb-2">
                          @{annotation.targetField}
                        </span>
                      )}

                      {/* Replies */}
                      {annotation.replies.length > 0 && (
                        <div className="ml-3 pl-3 border-l border-white/8 space-y-2 mb-2">
                          {annotation.replies.map((reply) => (
                            <div key={reply.id}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[9px] font-medium text-prism-text">
                                  {reply.authorName}
                                </span>
                                <span className="text-[8px] text-prism-muted/40">
                                  {formatTimestamp(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-[10px] text-prism-muted leading-relaxed">
                                {reply.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resolve button */}
                      {!annotation.resolved && (
                        <button
                          onClick={() => onResolveAnnotation(annotation.id)}
                          className="flex items-center gap-1 text-[10px] text-prism-muted hover:text-emerald-400 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Resolve
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <div className="border-t border-white/8 pt-3">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-prism-text placeholder:text-prism-muted/40 focus:outline-none focus:border-prism-sky/30 resize-none"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-prism-sky/20 text-prism-sky text-xs font-medium hover:bg-prism-sky/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  Add Comment
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
