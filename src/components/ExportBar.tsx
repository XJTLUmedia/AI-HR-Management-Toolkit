"use client";

import { useState } from "react";
import type { BatchResult } from "./BatchUpload";

interface ExportBarProps {
  results: BatchResult[];
}

export function ExportBar({ results }: ExportBarProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const successResults = results.filter((r) => r.success);

  const handleExport = async (format: "excel" | "pdf" | "json") => {
    if (!successResults.length) return;
    setExporting(format);

    try {
      const payload = {
        format,
        results: successResults.map((r) => ({
          fileName: r.fileName,
          structured: r.structured,
        })),
      };

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const ext = format === "excel" ? "xlsx" : format;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumes-export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  if (!successResults.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Export:</span>
      <button
        onClick={() => handleExport("excel")}
        disabled={!!exporting}
        className="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium disabled:opacity-50"
        style={{ color: 'var(--success)' }}
      >
        {exporting === "excel" ? (
          <span className="h-3 w-3 animate-spin rounded-full" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--success)' }} />
        ) : "📊"} Excel
      </button>
      <button
        onClick={() => handleExport("pdf")}
        disabled={!!exporting}
        className="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium disabled:opacity-50"
        style={{ color: 'var(--danger)' }}
      >
        {exporting === "pdf" ? (
          <span className="h-3 w-3 animate-spin rounded-full" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--danger)' }} />
        ) : "📄"} PDF
      </button>
      <button
        onClick={() => handleExport("json")}
        disabled={!!exporting}
        className="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium disabled:opacity-50"
        style={{ color: 'var(--primary)' }}
      >
        {exporting === "json" ? (
          <span className="h-3 w-3 animate-spin rounded-full" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }} />
        ) : "{ }"} JSON
      </button>
    </div>
  );
}
