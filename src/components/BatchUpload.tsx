"use client";

import { useCallback, useState } from "react";
import type { ProviderConfig } from "./ProviderSelector";

export interface BatchResult {
  fileName: string;
  success: boolean;
  rawText?: string;
  structured?: Record<string, unknown>;
  pipeline?: Record<string, unknown>;
  error?: string;
}

export interface BatchData {
  total: number;
  successful: number;
  failed: number;
  results: BatchResult[];
}

interface BatchUploadProps {
  onBatchProcessed: (data: BatchData) => void;
  providerConfig?: ProviderConfig;
}

export function BatchUpload({ onBatchProcessed, providerConfig }: BatchUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const ACCEPTED = ".pdf,.docx,.txt,.md";

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (providerConfig?.apiKey) headers["x-api-key"] = providerConfig.apiKey;
    if (providerConfig?.provider) headers["x-ai-provider"] = providerConfig.provider;
    if (providerConfig?.model) headers["x-ai-model"] = providerConfig.model;
    return headers;
  }, [providerConfig]);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!providerConfig?.apiKey || !providerConfig?.provider || !providerConfig?.model) {
        setError("Configure provider, API key, and select a live model before batch processing.");
        return;
      }
      setError(null);
      setIsLoading(true);
      setProgress(`Processing ${files.length} files...`);

      try {
        const formData = new FormData();
        for (const f of files) {
          formData.append("files", f);
        }

        const res = await fetch("/api/batch-parse", {
          method: "POST",
          headers: buildHeaders(),
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Batch processing failed");
        }

        const data: BatchData = await res.json();
        setProgress(`Done: ${data.successful}/${data.total} successful`);
        onBatchProcessed(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process files");
      } finally {
        setIsLoading(false);
      }
    },
    [onBatchProcessed, buildHeaders, providerConfig]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setSelectedFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setSelectedFiles(files);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300"
        style={{
          borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
          background: isDragging ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--surface)',
        }}
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: isDragging ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface-secondary)' }}>
          <svg className="h-7 w-7 transition-colors" style={{ color: isDragging ? 'var(--primary)' : 'var(--muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m3 0-3-3m3 3-3 3m-5.25-5.625A2.625 2.625 0 0 1 3 8.25V6.563m19.5 0V8.25A2.625 2.625 0 0 1 20.625 9H17.25" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--foreground)' }}>
          Drag & drop multiple files here, or{" "}
          <label className="cursor-pointer font-medium transition-colors hover:underline" style={{ color: 'var(--primary)' }}>
            browse
            <input
              type="file"
              multiple
              accept={ACCEPTED}
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </p>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          PDF, DOCX, TXT, MD · Max 20 files · 10MB each
        </p>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs transition-colors hover:underline"
              style={{ color: 'var(--muted)' }}
            >
              Clear all
            </button>
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl p-2" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors" style={{ color: 'var(--foreground)' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="flex items-center gap-2 truncate">
                  <svg className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <span className="truncate">{f.name}</span>
                </div>
                <button onClick={() => removeFile(i)} className="ml-2 transition-colors" style={{ color: 'var(--muted)' }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--muted)'}
                >✕</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => processFiles(selectedFiles)}
            disabled={isLoading}
            className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {isLoading ? progress : `Process ${selectedFiles.length} Files`}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)' }}>
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
