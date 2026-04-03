"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "resume-parser-provider-config";

interface ProviderMeta {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  placeholder: string;
}

const FALLBACK_PROVIDERS: ProviderMeta[] = [
  { id: "openai", name: "OpenAI", defaultModel: "gpt-5.4-mini", models: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.4-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "o4-mini"], placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", defaultModel: "claude-sonnet-4-6", models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"], placeholder: "sk-ant-..." },
  { id: "google", name: "Google", defaultModel: "gemini-2.5-flash", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"], placeholder: "AIza..." },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", models: ["deepseek-chat", "deepseek-reasoner"], placeholder: "sk-..." },
  { id: "glm", name: "GLM (Zhipu)", defaultModel: "glm-4-flash", models: ["glm-4-flash", "glm-4-plus", "glm-4"], placeholder: "API key" },
  { id: "qwen", name: "Qwen (Alibaba)", defaultModel: "qwen-turbo", models: ["qwen-turbo", "qwen-plus", "qwen-max"], placeholder: "sk-..." },
  { id: "openrouter", name: "OpenRouter", defaultModel: "openai/gpt-5.4-mini", models: ["openai/gpt-5.4-mini", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-flash"], placeholder: "sk-or-..." },
  { id: "opencodezen", name: "OpenCode Zen", defaultModel: "opencodezen", models: ["opencodezen"], placeholder: "API key" },
];

interface ProviderSelectorProps {
  onConfigChange: (config: ProviderConfig) => void;
}

export function ProviderSelector({ onConfigChange }: ProviderSelectorProps) {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const currentProvider = FALLBACK_PROVIDERS.find((p) => p.id === provider) || FALLBACK_PROVIDERS[0];

  // Fetch models from API when provider or API key changes
  const fetchModels = useCallback(async (provId: string, key: string) => {
    // Abort any in-flight request
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (!key) {
      setModels([]);
      setModel("");
      setModelsError("Enter API key to load live models.");
      return;
    }

    setLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch(`/api/models?provider=${encodeURIComponent(provId)}`, {
        headers: { "x-api-key": key },
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch models" }));
        throw new Error((err as { error?: string }).error || "Failed to fetch models");
      }
      const data = await res.json() as { models: string[]; defaultModel: string | null };
      if (!controller.signal.aborted) {
        const liveModels = data.models || [];
        setModels(liveModels);
        setModel((prev) => (liveModels.includes(prev) ? prev : (liveModels[0] || "")));
        if (liveModels.length === 0) {
          setModelsError("No compatible text models returned by this provider/API key.");
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setModels([]);
        setModel("");
        setModelsError(error instanceof Error ? error.message : "Failed to fetch models");
      }
    } finally {
      if (!controller.signal.aborted) setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ProviderConfig;
        setProvider(parsed.provider || "openai");
        setModel(parsed.model || "");
        setApiKey(parsed.apiKey || "");
        onConfigChange(parsed);
      } catch {
        // ignore
      }
    }
  }, [onConfigChange, fetchModels]);

  useEffect(() => {
    const normalizedApiKey = apiKey.trim();

    if (!normalizedApiKey) {
      setModels([]);
      setModel("");
      setModelsError("Enter API key to load live models.");
      setLoadingModels(false);
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchModels(provider, normalizedApiKey);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [provider, apiKey, fetchModels]);

  const handleProviderChange = useCallback(
    (newProvider: string) => {
      setProvider(newProvider);
      setModel("");
      setModels([]);
      setModelsError(null);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!apiKey) {
      setModelsError("API key is required.");
      return;
    }
    if (!model) {
      setModelsError("Select a model from live provider models before saving.");
      return;
    }
    const config: ProviderConfig = { provider, model, apiKey };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    onConfigChange(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [provider, model, apiKey, onConfigChange]);

  const handleClear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProvider("openai");
    setModel("");
    setApiKey("");
    setModels([]);
    setModelsError(null);
    onConfigChange({ provider: "openai", model: "", apiKey: "" });
  }, [onConfigChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Provider */}
      <select
        value={provider}
        onChange={(e) => handleProviderChange(e.target.value)}
        className="input-field py-1.5 text-xs"
      >
        {FALLBACK_PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Model */}
      <div className="relative">
        <select
          value={models.includes(model) ? model : ""}
          onChange={(e) => setModel(e.target.value)}
          disabled={loadingModels || !apiKey || models.length === 0}
          className="input-field py-1.5 pr-6 text-xs disabled:opacity-60"
        >
          <option value="" disabled>
            {apiKey ? (loadingModels ? "Loading models…" : "Select model") : "Enter API key first"}
          </option>
          {!models.includes(model) && model && (
            <option value="" disabled>
              {model} (unavailable)
            </option>
          )}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {loadingModels && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] animate-pulse" style={{ color: "var(--primary)" }}>
            ●●●
          </span>
        )}
      </div>

      {/* API Key */}
      <div className="relative flex-1 min-w-[180px]">
        <input
          type={isVisible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder={currentProvider.placeholder}
          className="input-field w-full py-1.5 pr-8 text-xs"
          style={{
            borderColor: apiKey ? "var(--border)" : "var(--warning)",
          }}
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: "var(--muted)" }}
        >
          {isVisible ? (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Buttons */}
      <button
        onClick={handleSave}
        className="btn-primary px-3 py-1.5 text-xs"
      >
        {saved ? "✓ Saved" : "Save"}
      </button>
      {apiKey && (
        <button
          onClick={handleClear}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Clear
        </button>
      )}
      {!apiKey && (
        <span className="text-[10px] font-semibold" style={{ color: "var(--warning)" }}>
          API key required
        </span>
      )}
      {modelsError && (
        <span className="text-[10px] font-medium" style={{ color: "var(--danger)" }}>
          {modelsError}
        </span>
      )}
    </div>
  );
}
