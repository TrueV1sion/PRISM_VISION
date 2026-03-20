"use client";

import { createElement, useState } from "react";
import { motion } from "framer-motion";
import type { EngineManifest } from "@/lib/engines/types";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Play,
  AlertTriangle,
  Activity,
  Clock,
  TrendingUp,
  Users,
  FileText,
  Zap,
} from "lucide-react";

// ─── Icon Cache ────────────────────────────────────────────

const iconCache = new Map<string, LucideIcon>();

function getIcon(name: string): LucideIcon {
  if (iconCache.has(name)) return iconCache.get(name)!;
  const icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name] || LucideIcons.Hexagon;
  iconCache.set(name, icon);
  return icon;
}

// ─── Shared Types ──────────────────────────────────────────

interface DashboardSection {
  title: string;
  icon: LucideIcon;
  items: { label: string; value: string; trend?: "up" | "down" | "neutral" }[];
}

interface EngineDashboardProps {
  engine: EngineManifest;
  sections: DashboardSection[];
  capabilities: string[];
}

// ─── Engine Dashboard Shell ────────────────────────────────

export default function EngineDashboard({ engine, sections, capabilities }: EngineDashboardProps) {
  const [queryInput, setQueryInput] = useState(engine.defaultQuery ?? "");
  const EngineIcon = getIcon(engine.icon);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${engine.accentColor}25, ${engine.accentColor}08)`,
            border: `1px solid ${engine.accentColor}35`,
            boxShadow: `0 0 30px ${engine.accentColor}12`,
          }}
        >
          {createElement(EngineIcon, {
            className: "w-7 h-7",
            style: { color: engine.accentColor },
          })}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{engine.name}</h1>
          <p className="text-sm text-slate-400">{engine.description}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400/80">Active</span>
        </div>
      </motion.div>

      {/* Query Input */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-2xl p-4"
      >
        <label className="block text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
          Engine-Scoped Query
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={engine.defaultQuery ?? "Enter a query for this engine..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20 transition-colors"
          />
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: `linear-gradient(135deg, ${engine.accentColor}30, ${engine.accentColor}15)`,
              border: `1px solid ${engine.accentColor}40`,
              color: engine.accentColor,
            }}
          >
            <Play className="w-4 h-4" />
            Run
          </button>
        </div>
        {engine.archetypes && engine.archetypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {engine.archetypes.map((archetype) => (
              <span
                key={archetype}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-slate-500"
              >
                {archetype}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Metric Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06 }}
            className="glass-panel rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              {createElement(section.icon, { className: "w-4 h-4 text-slate-400" })}
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            </div>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white">{item.value}</span>
                    {item.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    {item.trend === "down" && <TrendingUp className="w-3 h-3 text-red-400 rotate-180" />}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Capabilities */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Capabilities</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {capabilities.map((cap) => (
            <div key={cap} className="flex items-start gap-2 text-xs text-slate-400">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: engine.accentColor }}
              />
              {cap}
            </div>
          ))}
        </div>
      </motion.div>

      {/* SENTINEL Alert Feed Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-panel rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400/80" />
          <h3 className="text-sm font-semibold text-white">SENTINEL Alerts</h3>
          <span className="ml-auto text-[10px] font-mono text-slate-500">Engine-scoped</span>
        </div>
        <div className="text-xs text-slate-500 italic">
          No active alerts for this engine scope. SENTINEL monitors signals every 6 hours.
        </div>
      </motion.div>
    </div>
  );
}
