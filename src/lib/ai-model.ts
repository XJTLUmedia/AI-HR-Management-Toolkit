import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AIProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "glm"
  | "qwen"
  | "openrouter"
  | "opencodezen";

export interface ModelConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
}

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  defaultModel: string;
  fallbackModels: string[];
  baseURL?: string;
  placeholder: string;
  modelsEndpoint: string;
}

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-5.4-mini",
    fallbackModels: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.4-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "o4-mini"],
    placeholder: "sk-...",
    modelsEndpoint: "https://api.openai.com/v1/models",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    defaultModel: "claude-sonnet-4-6",
    fallbackModels: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    placeholder: "sk-ant-...",
    modelsEndpoint: "https://api.anthropic.com/v1/models",
  },
  google: {
    id: "google",
    name: "Google",
    defaultModel: "gemini-2.5-flash",
    fallbackModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    placeholder: "AIza...",
    modelsEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    fallbackModels: ["deepseek-chat", "deepseek-reasoner"],
    baseURL: "https://api.deepseek.com/v1",
    placeholder: "sk-...",
    modelsEndpoint: "https://api.deepseek.com/v1/models",
  },
  glm: {
    id: "glm",
    name: "GLM (Zhipu)",
    defaultModel: "glm-4-flash",
    fallbackModels: ["glm-4-flash", "glm-4-plus", "glm-4"],
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    placeholder: "API key",
    modelsEndpoint: "https://open.bigmodel.cn/api/paas/v4/models",
  },
  qwen: {
    id: "qwen",
    name: "Qwen (Alibaba)",
    defaultModel: "qwen-turbo",
    fallbackModels: ["qwen-turbo", "qwen-plus", "qwen-max"],
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    placeholder: "sk-...",
    modelsEndpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-5.4-mini",
    fallbackModels: ["openai/gpt-5.4-mini", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-flash"],
    baseURL: "https://openrouter.ai/api/v1",
    placeholder: "sk-or-...",
    modelsEndpoint: "https://openrouter.ai/api/v1/models",
  },
  opencodezen: {
    id: "opencodezen",
    name: "OpenCode Zen",
    defaultModel: "opencodezen",
    fallbackModels: ["opencodezen"],
    baseURL: "https://api.opencodezen.com/v1",
    placeholder: "API key",
    modelsEndpoint: "https://api.opencodezen.com/v1/models",
  },
};

export function getModel(config: ModelConfig) {
  if (!config.provider) {
    throw new Error("AI provider is required. Please choose a provider in the UI.");
  }
  if (!config.apiKey) {
    throw new Error(
      `API key is required. Please configure your ${config.provider} API key in the UI.`
    );
  }
  if (!config.model) {
    throw new Error("Model is required. Please fetch and select a model in the UI.");
  }
  return getModelForProvider(config);
}

function getModelForProvider(config: ModelConfig) {
  const provider = config.provider;
  if (!provider) {
    throw new Error("AI provider is required.");
  }
  const info = PROVIDERS[provider];
  const modelId = config.model;
  if (!modelId) {
    throw new Error("Model is required.");
  }
  const apiKey = config.apiKey;

  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case "deepseek":
    case "glm":
    case "qwen":
    case "openrouter":
    case "opencodezen": {
      const compatible = createOpenAI({
        apiKey,
        baseURL: info.baseURL,
        name: provider,
      });
      return compatible.chat(modelId);
    }
    case "openai":
      {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/** Text-generation model ID filter patterns (exclude embeddings, tts, image, audio, moderation, etc.) */
const TEXT_MODEL_PATTERNS = [
  /^gpt-/,
  /^o[0-9]/,
  /^claude-/,
  /^gemini-/,
  /^deepseek-/,
  /^glm-/,
  /^qwen/,
];

const EXCLUDED_MODEL_PATTERNS = [
  /embed/i,
  /tts/i,
  /whisper/i,
  /dall-e/i,
  /image/i,
  /moderation/i,
  /realtime/i,
  /audio/i,
  /transcri/i,
  /search/i,
  /instruct$/i,
  /veo/i,
  /imagen/i,
  /lyria/i,
  /banana/i,
  /robotics/i,
  /live/i,
];

function isTextGenerationModel(id: string): boolean {
  if (EXCLUDED_MODEL_PATTERNS.some((p) => p.test(id))) return false;
  if (TEXT_MODEL_PATTERNS.some((p) => p.test(id))) return true;
  return false;
}

/**
 * Fetch available models dynamically from a provider's API.
 */
export async function fetchModelsForProvider(
  provider: AIProvider,
  apiKey: string
): Promise<string[]> {
  const info = PROVIDERS[provider];
  if (!apiKey) {
    throw new Error("API key is required to fetch models.");
  }

  if (provider === "google") {
    const res = await fetch(`${info.modelsEndpoint}?key=${encodeURIComponent(apiKey)}&pageSize=100`);
    if (!res.ok) {
      throw new Error(`Failed to fetch models from ${provider} (status ${res.status}).`);
    }
    const data = await res.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const models = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name || "").replace(/^models\//, ""))
      .filter((id) => id && !EXCLUDED_MODEL_PATTERNS.some((p) => p.test(id)));
    return models;
  }

  if (provider === "anthropic") {
    const res = await fetch(info.modelsEndpoint, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch models from ${provider} (status ${res.status}).`);
    }
    const data = await res.json() as { data?: Array<{ id?: string }> };
    const models = (data.data || [])
      .map((m) => m.id || "")
      .filter((id) => id && isTextGenerationModel(id));
    return models;
  }

  // OpenAI-compatible: openai, deepseek, glm, qwen, openrouter, opencodezen
  const res = await fetch(info.modelsEndpoint, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch models from ${provider} (status ${res.status}).`);
  }
  const data = await res.json() as { data?: Array<{ id?: string }> };
  const models = (data.data || [])
    .map((m) => m.id || "")
    .filter((id) => id && isTextGenerationModel(id));
  return models;
}

export function getProviderList(): Array<{ id: AIProvider; name: string; models: string[]; placeholder: string }> {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    models: p.fallbackModels,
    placeholder: p.placeholder,
  }));
}
