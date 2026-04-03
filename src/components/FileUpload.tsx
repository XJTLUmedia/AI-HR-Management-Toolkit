"use client";

import { useCallback, useState } from "react";
import type { ProviderConfig } from "./ProviderSelector";

interface FileUploadProps {
  onFileProcessed: (data: {
    rawText: string;
    structured: Record<string, unknown>;
    pageCount: number | null;
    algorithmicAnalysis?: Record<string, unknown>;
  }) => void;
  providerConfig?: ProviderConfig;
}

export function FileUpload({ onFileProcessed, providerConfig }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (providerConfig?.apiKey) headers["x-api-key"] = providerConfig.apiKey;
    if (providerConfig?.provider) headers["x-ai-provider"] = providerConfig.provider;
    if (providerConfig?.model) headers["x-ai-model"] = providerConfig.model;
    return headers;
  }, [providerConfig]);

  const processFile = useCallback(
    async (file: File) => {
      if (!providerConfig?.apiKey || !providerConfig?.provider || !providerConfig?.model) {
        setError("Configure provider, API key, and select a live model before parsing.");
        return;
      }
      setError(null);
      setFileName(file.name);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse", {
          method: "POST",
          headers: buildHeaders(),
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to parse resume");
        }

        const data = await res.json();
        onFileProcessed(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      } finally {
        setIsLoading(false);
      }
    },
    [onFileProcessed, buildHeaders]
  );

  const processUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    if (!providerConfig?.apiKey || !providerConfig?.provider || !providerConfig?.model) {
      setError("Configure provider, API key, and select a live model before parsing.");
      return;
    }
    setError(null);
    setFileName(urlInput);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("url", urlInput.trim());

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: buildHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to parse URL");
      }

      const data = await res.json();
      onFileProcessed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse URL");
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, onFileProcessed, buildHeaders, providerConfig]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="card-elevated overflow-hidden">
      {/* File drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="relative p-8 text-center transition-all duration-300"
        style={{
          borderBottom: "1px solid var(--border)",
          background: isDragging
            ? "linear-gradient(135deg, rgba(79,70,229,0.06), rgba(6,182,212,0.04))"
            : "transparent",
        }}
      >
        {/* Dashed border overlay */}
        <div
          className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed transition-colors duration-300"
          style={{
            borderColor: isDragging ? "var(--primary)" : "var(--border)",
          }}
        />

        {isLoading ? (
          <div className="relative flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-transparent"
                style={{ borderTopColor: "var(--primary)", borderRightColor: "var(--primary-light)" }} />
              <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full opacity-20"
                style={{ background: "var(--primary)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              Analyzing <span style={{ color: "var(--primary)" }}>{fileName}</span>…
            </p>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-4 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 hover:scale-105"
              style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(6,182,212,0.08))" }}>
              <svg
                className="h-7 w-7 transition-transform duration-300"
                style={{ color: "var(--primary)" }}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Drop your resume here, or{" "}
                <label className="cursor-pointer underline decoration-[var(--primary)]/40 underline-offset-2 transition-colors hover:decoration-[var(--primary)]"
                  style={{ color: "var(--primary)" }}>
                  browse files
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md,.markdown"
                    onChange={handleFileInput}
                  />
                </label>
              </p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
                Supports PDF, DOCX, TXT, and Markdown — up to 10 MB
              </p>
            </div>
            {fileName && !error && (
              <p className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(16,185,129,0.1)", color: "var(--success)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                {fileName}
              </p>
            )}
            {error && (
              <p className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* URL input */}
      <div className="flex gap-2 p-4">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && processUrl()}
          placeholder="Or paste a LinkedIn / resume page URL…"
          disabled={isLoading}
          className="input-field flex-1 disabled:opacity-50"
        />
        <button
          onClick={processUrl}
          disabled={!urlInput.trim() || isLoading}
          className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
        >
          Parse URL
        </button>
      </div>
    </div>
  );
}
