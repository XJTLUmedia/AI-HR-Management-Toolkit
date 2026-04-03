"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, useMemo } from "react";
import type { ProviderConfig } from "./ProviderSelector";

interface ChatInterfaceProps {
  resumeText: string | null;
  providerConfig?: ProviderConfig;
}

export function ChatInterface({ resumeText, providerConfig }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const hasCompleteProviderConfig = Boolean(
    providerConfig?.apiKey && providerConfig?.provider && providerConfig?.model
  );

  const transport = useMemo(() => {
    const headers: Record<string, string> = {};
    if (providerConfig?.apiKey) headers["x-api-key"] = providerConfig.apiKey;
    if (providerConfig?.provider) headers["x-ai-provider"] = providerConfig.provider;
    if (providerConfig?.model) headers["x-ai-model"] = providerConfig.model;

    return new DefaultChatTransport({
      api: "/api/chat",
      body: { resumeText },
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }, [resumeText, providerConfig]);

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !resumeText || isLoading || !hasCompleteProviderConfig) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto p-5"
      >
        {messages.length === 0 && !resumeText && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--surface-secondary)' }}>
                <svg className="h-6 w-6" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Upload a resume to start chatting
              </p>
            </div>
          </div>
        )}
        {messages.length === 0 && resumeText && !hasCompleteProviderConfig && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' }}>
              Configure provider, API key, and select a live model before chatting.
            </div>
          </div>
        )}
        {messages.length === 0 && resumeText && hasCompleteProviderConfig && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{ background: 'var(--surface-secondary)', color: 'var(--foreground)' }}>
              Resume loaded! I can help you analyze it. Ask me anything — summarize it, extract skills, suggest improvements, or match against a job description.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white' }
                  : { background: 'var(--surface-secondary)', color: 'var(--foreground)' }
              }
            >
              <div className="whitespace-pre-wrap">
                {msg.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("") || ""}
              </div>
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--surface-secondary)' }}>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--primary-light)', animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--primary-light)', animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--primary-light)', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              !hasCompleteProviderConfig
                ? "Configure provider + model first..."
                : resumeText
                ? "Ask about this resume..."
                : "Upload a resume first..."
            }
            disabled={!resumeText || !hasCompleteProviderConfig}
            className="input-field flex-1 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!resumeText || !input.trim() || isLoading || !hasCompleteProviderConfig}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
