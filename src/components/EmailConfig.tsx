"use client";

import { useState, useEffect, useCallback } from "react";
import type { BatchResult } from "./BatchUpload";

interface EmailConfigProps {
  results: BatchResult[];
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

const STORAGE_KEY = "resume-parser-smtp";

export function EmailConfig({ results }: EmailConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [to, setTo] = useState("");
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SmtpConfig;
        setSmtp(parsed);
      }
    } catch {}
  }, []);

  const saveSmtp = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(smtp));
  }, [smtp]);

  const handleSend = async () => {
    const successResults = results.filter((r) => r.success);
    if (!successResults.length) return;
    if (!to.trim()) { setMessage({ type: "error", text: "Enter a recipient email" }); return; }
    if (!smtp.host || !smtp.user || !smtp.pass) { setMessage({ type: "error", text: "Complete SMTP configuration" }); return; }

    setSending(true);
    setMessage(null);
    saveSmtp();

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          smtp,
          results: successResults.map((r) => ({
            fileName: r.fileName,
            structured: r.structured,
          })),
          format: "json",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setMessage({ type: "success", text: data.message || "Email sent!" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;
  if (!successCount) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium"
        style={{ color: 'var(--accent)' }}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        Email Results
      </button>

      {isOpen && (
        <div className="card-elevated absolute right-0 top-full z-50 mt-2 w-80 p-5" style={{ boxShadow: 'var(--shadow-xl)' }}>
          <h4 className="mb-4 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Email Configuration</h4>

          <div className="space-y-3">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipient email"
              className="input-field w-full text-xs"
            />

            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>SMTP Settings</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={smtp.host}
                  onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                  placeholder="SMTP host"
                  className="input-field text-xs"
                  style={{ padding: '6px 10px' }}
                />
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp((s) => ({ ...s, port: Number(e.target.value) }))}
                  placeholder="Port"
                  className="input-field text-xs"
                  style={{ padding: '6px 10px' }}
                />
              </div>
              <input
                value={smtp.user}
                onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                placeholder="SMTP username / email"
                className="input-field mt-2 w-full text-xs"
                style={{ padding: '6px 10px' }}
              />
              <input
                type="password"
                value={smtp.pass}
                onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                placeholder="SMTP password"
                className="input-field mt-2 w-full text-xs"
                style={{ padding: '6px 10px' }}
              />
              <label className="mt-2.5 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={(e) => setSmtp((s) => ({ ...s, secure: e.target.checked }))}
                  style={{ accentColor: 'var(--primary)' }}
                />
                Use TLS/SSL
              </label>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary mt-4 w-full px-3 py-2.5 text-xs disabled:opacity-50"
          >
            {sending ? "Sending..." : `Send ${successCount} Result${successCount > 1 ? "s" : ""}`}
          </button>

          {message && (
            <p className={`mt-2.5 text-xs font-medium`} style={{ color: message.type === "success" ? 'var(--success)' : 'var(--danger)' }}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
