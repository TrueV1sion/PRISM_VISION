"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  FileJson,
  Table,
  ChevronDown,
  Sparkles,
  FileDown,
  FolderArchive,
} from "lucide-react";

interface ExportFormat {
  id: string;
  label: string;
  description: string;
  icon: typeof Download;
  href: (runId: string) => string;
}

const FORMATS: ExportFormat[] = [
  {
    id: "html-brief",
    label: "HTML Brief",
    description: "Self-contained cinematic briefing",
    icon: Sparkles,
    href: (runId) => `/api/decks/${runId}/download`,
  },
  {
    id: "executive-memo",
    label: "Executive Memo",
    description: "McKinsey-style 2-3 page memo",
    icon: FileText,
    href: (runId) => `/api/run/${runId}/export?format=executive-memo`,
  },
  {
    id: "data-export-json",
    label: "JSON Export",
    description: "Full IR Graph as structured JSON",
    icon: FileJson,
    href: (runId) => `/api/run/${runId}/export?format=data-export-json`,
  },
  {
    id: "pdf",
    label: "PDF Report",
    description: "Print-ready PDF from executive memo",
    icon: FileDown,
    href: (runId) => `/api/run/${runId}/export?format=pdf`,
  },
  {
    id: "data-export-csv",
    label: "CSV Export",
    description: "Findings & emergences tables",
    icon: Table,
    href: (runId) => `/api/run/${runId}/export?format=data-export-csv`,
  },
  {
    id: "data-room",
    label: "Data Room (ZIP)",
    description: "Due diligence package: memo + data + sources",
    icon: FolderArchive,
    href: (runId) => `/api/run/${runId}/export?format=data-room`,
  },
];

interface ExportDropdownProps {
  runId: string;
  compact?: boolean;
  className?: string;
}

export default function ExportDropdown({
  runId,
  compact = false,
  className = "",
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const close = useCallback(() => setOpen(false), []);

  // Compute position when opening
  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setOpen((prev) => {
        if (!prev && triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          const menuWidth = 256;
          const menuHeight = 260;
          const spaceBelow = window.innerHeight - rect.bottom;
          const openAbove = spaceBelow < menuHeight && rect.top > menuHeight;
          const idealLeft = rect.right - menuWidth;
          setPos({
            top: openAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
            left: Math.max(8, Math.min(idealLeft, window.innerWidth - menuWidth - 8)),
          });
        }
        return !prev;
      });
    },
    [],
  );

  // Close on outside click (delayed to avoid catching the opening click)
  useEffect(() => {
    if (!open) return;
    let armed = false;
    const armTimer = requestAnimationFrame(() => {
      armed = true;
    });
    function handleClick(e: MouseEvent) {
      if (!armed) return;
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
      close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(armTimer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  const handleExport = (format: ExportFormat) => {
    const a = document.createElement("a");
    a.href = format.href(runId);
    a.click();
    close();
  };

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-[9999] w-64 rounded-xl border border-white/12 bg-[#0a0f1e] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-white/8">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-prism-muted">
            Export Format
          </span>
        </div>
        <div className="py-1">
          {FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.id}
                onClick={() => handleExport(format)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors group"
              >
                <Icon className="w-4 h-4 text-prism-muted group-hover:text-prism-sky transition-colors shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-prism-text group-hover:text-white transition-colors">
                    {format.label}
                  </div>
                  <div className="text-[10px] text-prism-muted leading-tight">
                    {format.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );

  if (compact) {
    return (
      <>
        <button
          ref={triggerRef}
          onClick={toggle}
          className={`p-1.5 rounded-lg border border-white/10 text-prism-muted hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors ${className}`}
          title="Export"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        {menu}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={`prism-button-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2 ${className}`}
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </>
  );
}
