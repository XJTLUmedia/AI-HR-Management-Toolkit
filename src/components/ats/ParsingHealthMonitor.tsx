"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

type HealthTab = "drift" | "queue" | "patterns" | "corrections";

interface DriftDelta {
  metric: string;
  baselineValue: number;
  currentValue: number;
  delta: number;
  severity: "ok" | "warning" | "critical";
}

interface DriftReport {
  driftDetected: boolean;
  current: { sampleCount: number; meanOverallConfidence: number; medianOverallConfidence: number };
  baseline: { sampleCount: number; meanOverallConfidence: number; medianOverallConfidence: number };
  deltas: DriftDelta[];
  baselineTimestamp: number;
  recommendations: string[];
}

interface ReviewItem {
  parseId: string;
  timestamp: number;
  overallConfidence: number;
  anomalies: Array<{ type: string; severity: string; message: string }>;
  dispositionCounts: { accepted: number; review: number; rejected: number };
}

interface LearnedPattern {
  id: string;
  firstSeen: number;
  lastSeen: number;
  occurrenceCount: number;
  errorType: string;
  field: string;
  description: string;
  matchPattern?: string;
  suggestedFix?: string;
  confirmed: boolean;
  incorporated: boolean;
}

interface FeedbackStats {
  totalCorrections: number;
  correctionsByField: Record<string, number>;
  correctionsByErrorType: Record<string, number>;
  learnedPatternCount: number;
  confirmedPatternCount: number;
  incorporatedPatternCount: number;
  topErrorFields: Array<{ field: string; count: number; rate: number }>;
  topNewPatterns: LearnedPattern[];
}

interface CorrectionForm {
  parseId: string;
  field: string;
  parsedValue: string;
  correctedValue: string;
  rawContext: string;
  errorType: string;
  fileType: string;
}

const EMPTY_CORRECTION: CorrectionForm = {
  parseId: "", field: "", parsedValue: "", correctedValue: "",
  rawContext: "", errorType: "wrong_value", fileType: "",
};

const ERROR_TYPES = [
  { value: "wrong_value", label: "Wrong Value" },
  { value: "missing_value", label: "Missing Value" },
  { value: "extra_value", label: "Extra / Hallucinated Value" },
  { value: "wrong_type", label: "Wrong Entity Type" },
  { value: "format_error", label: "Format Error" },
  { value: "split_error", label: "Split / Merge Error" },
  { value: "encoding_artifact", label: "Encoding Artifact" },
];

function severityColor(severity: string): string {
  if (severity === "critical") return "var(--danger)";
  if (severity === "warning") return "var(--warning)";
  return "var(--success)";
}

function severityBg(severity: string): string {
  if (severity === "critical") return "color-mix(in srgb, var(--danger) 12%, transparent)";
  if (severity === "warning") return "color-mix(in srgb, var(--warning) 12%, transparent)";
  return "color-mix(in srgb, var(--success) 12%, transparent)";
}

export default function ParsingHealthMonitor() {
  const [activeTab, setActiveTab] = useState<HealthTab>("drift");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[] | null>(null);
  const [patterns, setPatterns] = useState<LearnedPattern[] | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>(EMPTY_CORRECTION);
  const [correctionResult, setCorrectionResult] = useState<string | null>(null);

  // Call the parsing_health MCP tool via the /api/mcp endpoint
  const callHealthTool = useCallback(async (action: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      // Call MCP tool via JSON-RPC over /api/mcp
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: "parsing_health",
            arguments: { action, ...extra },
          },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rpc = await response.json();
      if (rpc.error) throw new Error(rpc.error.message || "MCP error");
      const text = rpc.result?.content?.[0]?.text;
      if (!text) throw new Error("Empty response");
      return JSON.parse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrift = useCallback(async () => {
    const data = await callHealthTool("check_drift");
    if (data?.success) setDriftReport(data);
  }, [callHealthTool]);

  const loadReviewQueue = useCallback(async () => {
    const data = await callHealthTool("review_queue", { limit: 30 });
    if (data?.success) setReviewQueue(data.items ?? []);
  }, [callHealthTool]);

  const loadPatterns = useCallback(async () => {
    const data = await callHealthTool("learned_patterns", { patternFilter: "all" });
    if (data?.success) setPatterns(data.patterns ?? []);
  }, [callHealthTool]);

  const loadFeedbackStats = useCallback(async () => {
    const data = await callHealthTool("feedback_stats");
    if (data?.success) setFeedbackStats(data);
  }, [callHealthTool]);

  const calibrate = useCallback(async () => {
    const data = await callHealthTool("calibrate_baseline");
    if (data?.success) {
      setError(null);
      await loadDrift();
    }
  }, [callHealthTool, loadDrift]);

  const submitCorrection = useCallback(async () => {
    if (!correctionForm.parseId || !correctionForm.field || !correctionForm.correctedValue) {
      setError("parseId, field, and correctedValue are required");
      return;
    }
    const data = await callHealthTool("submit_correction", { correction: correctionForm });
    if (data) {
      setCorrectionResult(data.message ?? "Correction submitted");
      setCorrectionForm(EMPTY_CORRECTION);
    }
  }, [correctionForm, callHealthTool]);

  // Auto-load when switching tabs
  const switchTab = useCallback((tab: HealthTab) => {
    setActiveTab(tab);
    setError(null);
    if (tab === "drift" && !driftReport) loadDrift();
    if (tab === "queue" && !reviewQueue) loadReviewQueue();
    if (tab === "patterns" && !patterns) loadPatterns();
    if (tab === "corrections" && !feedbackStats) loadFeedbackStats();
  }, [driftReport, reviewQueue, patterns, feedbackStats, loadDrift, loadReviewQueue, loadPatterns, loadFeedbackStats]);

  const tabs: Array<{ id: HealthTab; label: string }> = [
    { id: "drift", label: "Drift Detection" },
    { id: "queue", label: "Review Queue" },
    { id: "patterns", label: "Learned Patterns" },
    { id: "corrections", label: "Corrections" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header */}
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
            Parsing Health Monitor
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Detect quality drift, review low-confidence parses, and submit corrections to improve accuracy
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants} style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: "1px solid var(--border)", cursor: "pointer",
                background: activeTab === t.id ? "var(--primary)" : "var(--surface)",
                color: activeTab === t.id ? "#fff" : "var(--muted)",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                border: "1px solid var(--danger)", borderRadius: 8,
                padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--danger)",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <motion.div variants={itemVariants} style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
            Loading…
          </motion.div>
        )}

        {/* ── Drift Detection Tab ── */}
        {activeTab === "drift" && !loading && (
          <motion.div variants={itemVariants}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={loadDrift} style={{
                padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
              }}>
                Check Drift
              </button>
              <button onClick={calibrate} style={{
                padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer",
              }}>
                Calibrate Baseline
              </button>
            </div>

            {driftReport && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Drift status card */}
                <div style={{
                  padding: 16, borderRadius: 10,
                  background: driftReport.driftDetected
                    ? "color-mix(in srgb, var(--danger) 8%, transparent)"
                    : "color-mix(in srgb, var(--success) 8%, transparent)",
                  border: `1px solid ${driftReport.driftDetected ? "var(--danger)" : "var(--success)"}`,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: driftReport.driftDetected ? "var(--danger)" : "var(--success)" }}>
                    {driftReport.driftDetected ? "Drift Detected" : "No Drift Detected"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Baseline: {driftReport.baseline.sampleCount} samples · Current: {driftReport.current.sampleCount} samples
                  </div>
                </div>

                {/* Deltas table */}
                {driftReport.deltas.length > 0 && (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "var(--background)" }}>
                          <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Metric</th>
                          <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Baseline</th>
                          <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Current</th>
                          <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Delta</th>
                          <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driftReport.deltas.map((d) => (
                          <tr key={d.metric} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 12px", color: "var(--foreground)" }}>{d.metric}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--muted)" }}>{(d.baselineValue * 100).toFixed(1)}%</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--foreground)" }}>{(d.currentValue * 100).toFixed(1)}%</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: severityColor(d.severity), fontWeight: 600 }}>
                              {d.delta > 0 ? "+" : ""}{(d.delta * 100).toFixed(1)}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                                background: severityBg(d.severity), color: severityColor(d.severity),
                              }}>
                                {d.severity.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recommendations */}
                {driftReport.recommendations.length > 0 && (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Recommendations</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--foreground)" }}>
                      {driftReport.recommendations.map((r, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!driftReport && !loading && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                Click &ldquo;Check Drift&rdquo; to analyze parsing quality
              </div>
            )}
          </motion.div>
        )}

        {/* ── Review Queue Tab ── */}
        {activeTab === "queue" && !loading && (
          <motion.div variants={itemVariants}>
            <button onClick={loadReviewQueue} style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, marginBottom: 16,
              background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
            }}>
              Refresh Queue
            </button>

            {reviewQueue && reviewQueue.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                No items in review queue — parsing quality is healthy
              </div>
            )}

            {reviewQueue && reviewQueue.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviewQueue.map((item) => (
                  <div key={item.parseId} style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <code style={{ fontSize: 12, color: "var(--primary)" }}>{item.parseId}</code>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                        background: item.overallConfidence >= 0.8
                          ? severityBg("ok")
                          : item.overallConfidence >= 0.6
                            ? severityBg("warning")
                            : severityBg("critical"),
                        color: item.overallConfidence >= 0.8
                          ? severityColor("ok")
                          : item.overallConfidence >= 0.6
                            ? severityColor("warning")
                            : severityColor("critical"),
                      }}>
                        {(item.overallConfidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      <span>Accepted: {item.dispositionCounts.accepted}</span>
                      <span>Review: {item.dispositionCounts.review}</span>
                      <span>Rejected: {item.dispositionCounts.rejected}</span>
                    </div>
                    {item.anomalies.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {item.anomalies.map((a, i) => (
                          <span key={i} style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 9999,
                            background: severityBg(a.severity), color: severityColor(a.severity),
                          }}>
                            {a.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!reviewQueue && !loading && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                Click &ldquo;Refresh Queue&rdquo; to load review items
              </div>
            )}
          </motion.div>
        )}

        {/* ── Learned Patterns Tab ── */}
        {activeTab === "patterns" && !loading && (
          <motion.div variants={itemVariants}>
            <button onClick={loadPatterns} style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, marginBottom: 16,
              background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
            }}>
              Refresh Patterns
            </button>

            {patterns && patterns.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                No learned patterns yet — submit corrections to start building the pattern library
              </div>
            )}

            {patterns && patterns.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {patterns.map((p) => (
                  <div key={p.id} style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: 14,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{p.description}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {p.confirmed && (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: severityBg("ok"), color: severityColor("ok") }}>
                            Confirmed
                          </span>
                        )}
                        {p.incorporated && (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                            Incorporated
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
                      <span>Field: {p.field}</span>
                      <span>Error: {p.errorType}</span>
                      <span>Occurrences: {p.occurrenceCount}</span>
                    </div>
                    {p.matchPattern && (
                      <code style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--accent)", background: "var(--background)", padding: "4px 8px", borderRadius: 4 }}>
                        {p.matchPattern}
                      </code>
                    )}
                    {p.suggestedFix && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--success)" }}>
                        Fix: {p.suggestedFix}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!patterns && !loading && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                Click &ldquo;Refresh Patterns&rdquo; to load learned patterns
              </div>
            )}
          </motion.div>
        )}

        {/* ── Corrections Tab ── */}
        {activeTab === "corrections" && !loading && (
          <motion.div variants={itemVariants}>
            {/* Feedback stats */}
            {feedbackStats && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Total Corrections", value: feedbackStats.totalCorrections },
                    { label: "Learned Patterns", value: feedbackStats.learnedPatternCount },
                    { label: "Confirmed", value: feedbackStats.confirmedPatternCount },
                    { label: "Incorporated", value: feedbackStats.incorporatedPatternCount },
                  ].map((s) => (
                    <div key={s.label} style={{
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: 14, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {feedbackStats.topErrorFields.length > 0 && (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Top Error Fields</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {feedbackStats.topErrorFields.map((f) => (
                        <span key={f.field} style={{
                          fontSize: 12, padding: "4px 10px", borderRadius: 6,
                          background: "var(--background)", border: "1px solid var(--border)",
                          color: "var(--foreground)",
                        }}>
                          {f.field}: {f.count} ({(f.rate * 100).toFixed(0)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={loadFeedbackStats} style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer",
                }}>
                  Refresh Stats
                </button>
              </div>
            )}

            {/* Submit correction form */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 14 }}>
                Submit Correction
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Parse ID *</label>
                  <input type="text" value={correctionForm.parseId}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, parseId: e.target.value }))}
                    style={inputStyle} placeholder="e.g. parse_abc123" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Field *</label>
                  <input type="text" value={correctionForm.field}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, field: e.target.value }))}
                    style={inputStyle} placeholder="e.g. email, SKILL, DATE" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Parsed Value</label>
                  <input type="text" value={correctionForm.parsedValue}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, parsedValue: e.target.value }))}
                    style={inputStyle} placeholder="What the parser extracted" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Corrected Value *</label>
                  <input type="text" value={correctionForm.correctedValue}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, correctedValue: e.target.value }))}
                    style={inputStyle} placeholder="The correct value" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Raw Context</label>
                  <textarea value={correctionForm.rawContext}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, rawContext: e.target.value }))}
                    rows={3} style={{ ...inputStyle, resize: "vertical" }}
                    placeholder="Paste the raw text around the field for pattern learning" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Error Type</label>
                  <select value={correctionForm.errorType}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, errorType: e.target.value }))}
                    style={inputStyle}>
                    {ERROR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>File Type</label>
                  <select value={correctionForm.fileType}
                    onChange={(e) => setCorrectionForm((f) => ({ ...f, fileType: e.target.value }))}
                    style={inputStyle}>
                    <option value="">Unknown</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                    <option value="txt">TXT</option>
                    <option value="md">Markdown</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={submitCorrection} style={{
                  padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
                }}>
                  Submit Correction
                </button>
                {correctionResult && (
                  <span style={{ fontSize: 12, color: "var(--success)" }}>{correctionResult}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--background)",
  color: "var(--foreground)", fontSize: 13,
};
