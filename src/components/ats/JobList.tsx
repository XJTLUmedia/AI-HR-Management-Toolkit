"use client";

import type React from "react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { Job, JobStatus } from "@/lib/ats/types";

// ── Icons ────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

// ── Status badge colors ──────────────────────────────────────────

const STATUS_STYLES: Record<JobStatus, { bg: string; color: string; label: string }> = {
  open: { bg: "var(--success)", color: "#fff", label: "Open" },
  closed: { bg: "var(--muted)", color: "var(--foreground)", label: "Closed" },
  draft: { bg: "var(--warning)", color: "#000", label: "Draft" },
  paused: { bg: "var(--border)", color: "var(--foreground)", label: "Paused" },
};

// ── Animation variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ── Filter options ───────────────────────────────────────────────

const STATUS_OPTIONS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

// ── Component ────────────────────────────────────────────────────

export function JobList(): React.JSX.Element {
  const { state, setSelectedJobId, setCurrentView } = useATS();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

  const jobs = useMemo(() => Object.values(state.jobs), [state.jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (search && !job.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const candidateCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of Object.values(state.candidates)) {
      counts[c.jobId] = (counts[c.jobId] || 0) + 1;
    }
    return counts;
  }, [state.candidates]);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
          Jobs
        </h2>
        <button
          onClick={() => setSelectedJobId("new")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <PlusIcon /> Add New Job
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            flex: "1 1 200px",
            maxWidth: 340,
          }}
        >
          <span style={{ color: "var(--muted)", display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--foreground)",
              fontSize: 14,
              width: "100%",
            }}
          />
        </div>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: statusFilter === opt.value ? "var(--primary)" : "var(--surface)",
                color: statusFilter === opt.value ? "#fff" : "var(--foreground)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: "center",
            padding: 48,
            color: "var(--muted)",
            fontSize: 15,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>💼</div>
          <p style={{ marginTop: 8, fontSize: 15, fontWeight: 600 }}>
            {jobs.length === 0 ? "No Jobs Yet" : "No Matching Jobs"}
          </p>
          <p style={{ marginTop: 4, fontSize: 13, maxWidth: 340, margin: "4px auto 16px" }}>
            {jobs.length === 0
              ? "Create job postings to start building your hiring pipeline, or load demo data from Settings."
              : "No jobs match your current filters. Try adjusting them."}
          </p>
          {jobs.length === 0 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setSelectedJobId("new")}
                style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
              >
                Create First Job
              </button>
              <button
                onClick={() => setCurrentView("settings")}
                style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
              >
                Load Demo Data
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <motion.table
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{
              width: "100%",
              minWidth: 700,
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 14,
            }}
            className="ats-job-table-desktop"
          >
            <thead>
              <tr>
                {["Title", "Department", "Location", "Type", "Status", "# Candidates", "Created"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted)",
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const badge = STATUS_STYLES[job.status];
                return (
                  <motion.tr
                    key={job.id}
                    variants={itemVariants}
                    onClick={() => setSelectedJobId(job.id)}
                    style={{
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--foreground)" }}>
                      {job.title}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                      {job.department || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                      {job.location || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", textTransform: "capitalize" }}>
                      {job.type || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--foreground)" }}>
                      {candidateCountMap[job.id] ?? 0}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                      {formatDate(job.createdAt)}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </motion.table>
          </div>

          {/* Mobile card view */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="ats-job-cards-mobile"
            style={{ display: "none", flexDirection: "column", gap: 12 }}
          >
            {filtered.map((job) => {
              const badge = STATUS_STYLES[job.status];
              const count = candidateCountMap[job.id] ?? 0;
              return (
                <motion.div
                  key={job.id}
                  variants={itemVariants}
                  onClick={() => setSelectedJobId(job.id)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "var(--foreground)" }}>
                      {job.title}
                    </span>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "var(--muted)" }}>
                    {job.department && <span>{job.department}</span>}
                    {job.location && <span>📍 {job.location}</span>}
                    {job.type && <span style={{ textTransform: "capitalize" }}>{job.type}</span>}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 10,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span>{count} candidate{count !== 1 ? "s" : ""}</span>
                    <span>{formatDate(job.createdAt)}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 900px) {
          .ats-job-table-desktop { display: none !important; }
          .ats-job-cards-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
