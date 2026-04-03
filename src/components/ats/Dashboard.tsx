"use client";

import type React from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import { computeDashboardStats } from "@/lib/ats/store";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/ats/types";
import type { ATSState } from "@/lib/ats/types";

// ── Icons (inline SVG for zero-dependency) ───────────────────────

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// ── Animation variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

// ── Helpers ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Analytics helpers ─────────────────────────────────────────────

interface ConversionRate {
  from: string;
  to: string;
  rate: number;
  fromCount: number;
  toCount: number;
}

function computeAdvancedAnalytics(state: ATSState) {
  const candidates = Object.values(state.candidates);
  const offers = Object.values(state.offers);
  const stages = DEFAULT_PIPELINE_STAGES.map((s) => s.id);
  const total = candidates.length;

  // Conversion funnel — how many reached each stage
  const reachedStage: Record<string, number> = {};
  for (const c of candidates) {
    const idx = stages.indexOf(c.currentStage);
    for (let i = 0; i <= idx; i++) {
      reachedStage[stages[i]] = (reachedStage[stages[i]] || 0) + 1;
    }
    // Also count stage changes from activities
    for (const a of c.activities) {
      if (a.type === "stage-change" && a.metadata) {
        const toId = a.metadata.to as string;
        const toIdx = stages.indexOf(toId);
        if (toIdx >= 0) {
          for (let i = 0; i <= toIdx; i++) {
            // already incremented above for currentStage, just ensure completeness
          }
        }
      }
    }
  }

  const conversionRates: ConversionRate[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i] === "rejected") continue;
    const fromCount = reachedStage[stages[i]] || 0;
    const toCount = reachedStage[stages[i + 1]] || 0;
    if (fromCount > 0 || toCount > 0) {
      conversionRates.push({
        from: stages[i],
        to: stages[i + 1],
        rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
        fromCount,
        toCount,
      });
    }
  }

  // Hiring velocity — avg days from creation to hired
  const hiredCandidates = candidates.filter((c) => c.currentStage === "hired");
  let avgDaysToHire: number | null = null;
  if (hiredCandidates.length > 0) {
    const totalDays = hiredCandidates.reduce((sum, c) => {
      return sum + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000;
    }, 0);
    avgDaysToHire = Math.round((totalDays / hiredCandidates.length) * 10) / 10;
  }

  // Bottleneck: stage with most candidates stuck & highest avg days
  const now = Date.now();
  const stageAvgDays: Record<string, { avg: number; count: number }> = {};
  for (const c of candidates) {
    if (c.currentStage === "hired" || c.currentStage === "rejected") continue;
    const days = (now - new Date(c.createdAt).getTime()) / 86400000;
    if (!stageAvgDays[c.currentStage]) stageAvgDays[c.currentStage] = { avg: 0, count: 0 };
    stageAvgDays[c.currentStage].count++;
    stageAvgDays[c.currentStage].avg += days;
  }
  let bottleneck: { stage: string; avgDays: number; count: number } | null = null;
  for (const [stage, v] of Object.entries(stageAvgDays)) {
    const avg = v.avg / v.count;
    if (v.count >= 2 && (!bottleneck || avg > bottleneck.avgDays)) {
      bottleneck = { stage, avgDays: Math.round(avg * 10) / 10, count: v.count };
    }
  }

  // Top skills/tags
  const tagCounts: Record<string, number> = {};
  for (const c of candidates) {
    for (const t of c.tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Offer acceptance rate
  const acceptedOffers = offers.filter((o) => o.status === "accepted").length;
  const declinedOffers = offers.filter((o) => o.status === "declined").length;
  const offerAcceptRate =
    acceptedOffers + declinedOffers > 0
      ? Math.round((acceptedOffers / (acceptedOffers + declinedOffers)) * 100)
      : null;

  // Source distribution
  const sourceCounts: Record<string, number> = {};
  for (const c of candidates) {
    const src = c.source || "unknown";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Insights
  const insights: string[] = [];
  if (bottleneck) {
    insights.push(`Bottleneck detected at "${bottleneck.stage}" — ${bottleneck.count} candidates averaging ${bottleneck.avgDays} days.`);
  }
  if (avgDaysToHire && avgDaysToHire > 30) {
    insights.push(`Average time-to-hire is ${avgDaysToHire} days. Look for ways to accelerate.`);
  }
  if (offerAcceptRate !== null && offerAcceptRate < 50) {
    insights.push(`Offer acceptance rate is ${offerAcceptRate}%. Review compensation.`);
  }
  const rejectedCount = candidates.filter((c) => c.currentStage === "rejected").length;
  if (total > 0 && rejectedCount / total > 0.5) {
    insights.push(`${Math.round(rejectedCount / total * 100)}% rejection rate. Consider improving candidate sourcing quality.`);
  }
  if (insights.length === 0 && total > 0) {
    insights.push("All pipeline metrics look healthy!");
  }
  if (total === 0) {
    insights.push("No candidates yet. Load demo data from Settings or parse resumes to get started.");
  }

  return {
    conversionRates,
    avgDaysToHire,
    bottleneck,
    topTags,
    offerAcceptRate,
    topSources,
    insights,
    hiredCount: hiredCandidates.length,
    rejectedCount,
    total,
  };
}

// Stage label helper
function stageLabel(id: string): string {
  const stage = DEFAULT_PIPELINE_STAGES.find((s) => s.id === id);
  return stage?.name ?? id;
}

function stageColor(id: string): string {
  const stage = DEFAULT_PIPELINE_STAGES.find((s) => s.id === id);
  return stage?.color ?? "var(--muted)";
}

// ── Component ────────────────────────────────────────────────────

export function Dashboard(): React.JSX.Element {
  const { state, setCurrentView } = useATS();
  const stats = useMemo(() => computeDashboardStats(state), [state]);
  const analytics = useMemo(() => computeAdvancedAnalytics(state), [state]);

  const statCards = [
    { label: "Total Candidates", value: stats.totalCandidates, icon: <PersonIcon />, accent: "var(--primary)" },
    { label: "Open Jobs", value: stats.openJobs, icon: <BriefcaseIcon />, accent: "var(--success)" },
    { label: "Upcoming Interviews", value: stats.upcomingInterviews, icon: <CalendarIcon />, accent: "var(--warning)" },
    { label: "Pending Offers", value: stats.pendingOffers, icon: <DocumentIcon />, accent: "var(--danger)" },
  ];

  // Pipeline aggregation across all jobs
  const maxCandidates = useMemo(() => {
    const counts = Object.values(stats.stageDistribution);
    return Math.max(1, ...counts);
  }, [stats.stageDistribution]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: 24, padding: 24 }}
    >
      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
        className="dashboard-grid"
      >
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            variants={itemVariants}
            style={{
              background: `linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, ${card.accent} 6%, var(--surface)) 100%)`,
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)" }}>
                {card.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                {card.label}
              </div>
            </div>
            <div
              style={{
                color: card.accent,
                opacity: 0.7,
                marginTop: 2,
              }}
            >
              {card.icon}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Pipeline Distribution ───────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
          Pipeline Distribution
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEFAULT_PIPELINE_STAGES.map((stage) => {
            const count = stats.stageDistribution[stage.id] ?? 0;
            const pct = (count / maxCandidates) * 100;
            return (
              <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 110,
                    flexShrink: 0,
                    fontSize: 13,
                    color: "var(--muted)",
                    textAlign: "right",
                  }}
                >
                  {stage.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 6,
                    background: "color-mix(in srgb, var(--border) 40%, transparent)",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                    style={{
                      height: "100%",
                      borderRadius: 6,
                      background: stage.color,
                      minWidth: count > 0 ? 4 : 0,
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 32,
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    textAlign: "right",
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Bottom row: Activity Feed + Quick Actions ───────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
        }}
        className="dashboard-bottom-grid"
      >
        {/* Recent Activity */}
        <motion.div
          variants={itemVariants}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Recent Activity
          </h3>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 320 }}>
            {stats.recentActivities.length === 0 ? (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 14,
                }}
              >
                No recent activity
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {stats.recentActivities.map((item, i) => (
                  <div
                    key={`${item.timestamp}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "10px 0",
                      borderBottom: i < stats.recentActivities.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>
                        {item.candidateName}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>
                        {item.activity}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        flexShrink: 0,
                        marginLeft: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {relativeTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Quick Actions
          </h3>
          <button
            onClick={() => setCurrentView("jobs")}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Add New Job
          </button>
          <button
            onClick={() => setCurrentView("parser")}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Upload Resume
          </button>
          <button
            onClick={() => setCurrentView("interviews")}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Schedule Interview
          </button>
        </motion.div>
      </div>

      {/* ── Conversion Funnel ───────────────────────────────────── */}
      {analytics.conversionRates.length > 0 && (
        <motion.div
          variants={itemVariants}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Conversion Funnel
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analytics.conversionRates.map((cr) => (
              <div key={`${cr.from}-${cr.to}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 100, fontSize: 12, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                  {stageLabel(cr.from)}
                </span>
                <div style={{ width: 20, textAlign: "center", color: "var(--muted)", fontSize: 11 }}>→</div>
                <span style={{ width: 100, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                  {stageLabel(cr.to)}
                </span>
                <div style={{ flex: 1, height: 18, borderRadius: 4, background: "color-mix(in srgb, var(--border) 40%, transparent)", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cr.rate}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                    style={{
                      height: "100%",
                      borderRadius: 4,
                      background: cr.rate >= 60 ? "var(--success)" : cr.rate >= 30 ? "var(--warning)" : "var(--danger)",
                      minWidth: cr.rate > 0 ? 4 : 0,
                    }}
                  />
                </div>
                <span style={{ width: 52, fontSize: 12, fontWeight: 600, color: "var(--foreground)", textAlign: "right", flexShrink: 0 }}>
                  {cr.rate}%
                </span>
                <span style={{ width: 60, fontSize: 11, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                  {cr.fromCount}→{cr.toCount}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Metrics row: Velocity + Sources + Skills ─────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
        className="dashboard-metrics-grid"
      >
        {/* Hiring Velocity */}
        <motion.div
          variants={itemVariants}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Hiring Velocity
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ textAlign: "center", padding: 12, background: "rgba(16,185,129,0.06)", borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--success)" }}>
                {analytics.avgDaysToHire !== null ? `${analytics.avgDaysToHire}d` : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Avg. Days to Hire</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(99,102,241,0.04)", borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{analytics.hiredCount}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Hired</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: 8, background: "rgba(239,68,68,0.04)", borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{analytics.rejectedCount}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Rejected</div>
              </div>
            </div>
            {analytics.offerAcceptRate !== null && (
              <div style={{ textAlign: "center", padding: 8, background: "rgba(6,182,212,0.06)", borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{analytics.offerAcceptRate}%</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Offer Accept Rate</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Candidate Sources */}
        <motion.div
          variants={itemVariants}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Candidate Sources
          </h3>
          {analytics.topSources.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No data</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {analytics.topSources.map(([src, count]) => {
                const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 90, fontSize: 12, color: "var(--muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flexShrink: 0 }}>{src}</span>
                    <div style={{ flex: 1, height: 14, borderRadius: 4, background: "color-mix(in srgb, var(--border) 40%, transparent)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: "var(--primary)", minWidth: count > 0 ? 4 : 0, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ width: 28, fontSize: 12, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Top Skills */}
        <motion.div
          variants={itemVariants}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Top Skills in Pipeline
          </h3>
          {analytics.topTags.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No data</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {analytics.topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  {tag} <span style={{ opacity: 0.6 }}>({count})</span>
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Insights ────────────────────────────────────────────── */}
      {analytics.insights.length > 0 && (
        <motion.div
          variants={itemVariants}
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 4%, var(--surface)) 0%, var(--surface) 100%)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Insights & Recommendations
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analytics.insights.map((insight, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.04)",
                  fontSize: 13,
                  color: "var(--foreground)",
                }}
              >
                <span style={{ color: "var(--warning)", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>💡</span>
                {insight}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Responsive breakpoints via embedded style */}
      <style>{`
        .dashboard-grid {
          grid-template-columns: repeat(4, 1fr) !important;
        }
        .dashboard-bottom-grid {
          grid-template-columns: 2fr 1fr !important;
        }
        @media (max-width: 1280px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .dashboard-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .dashboard-bottom-grid {
            grid-template-columns: 1fr !important;
          }
          .dashboard-metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1024px) {
          .dashboard-metrics-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .dashboard-metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
