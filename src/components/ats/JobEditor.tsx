"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { Job, JobStatus } from "@/lib/ats/types";
import { generateId, nowISO, DEFAULT_PIPELINE_STAGES } from "@/lib/ats/types";

// ── Icons ────────────────────────────────────────────────────────

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="10" rx="1" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────

interface JobEditorProps {
  jobId: string;
}

type JobType = "full-time" | "part-time" | "contract" | "internship" | "remote";

const JOB_TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "remote", label: "Remote" },
];

const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

// ── Shared styles ─────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
  padding: 8,
  borderRadius: 8,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
};

// ── Animation variants ───────────────────────────────────────────

const formVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ── Component ────────────────────────────────────────────────────

export function JobEditor({ jobId }: JobEditorProps): React.JSX.Element {
  const { state, dispatch, setSelectedJobId, setCurrentView } = useATS();
  const isNew = jobId === "new";
  const existingJob = isNew ? null : state.jobs[jobId] ?? null;

  // Form state
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<JobType>("full-time");
  const [status, setStatus] = useState<JobStatus>("draft");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  // Pre-populate form when editing an existing job
  useEffect(() => {
    if (existingJob) {
      setTitle(existingJob.title);
      setDepartment(existingJob.department);
      setLocation(existingJob.location ?? "");
      setType((existingJob.type as JobType) ?? "full-time");
      setStatus(existingJob.status);
      setDescription(existingJob.description);
      setRequirements(existingJob.requirements.join("\n"));
      // salary is not in the Job type but we support it in UI as metadata
      setSalaryMin("");
      setSalaryMax("");
    }
  }, [existingJob]);

  const candidateCount = useMemo(() => {
    if (isNew) return 0;
    return Object.values(state.candidates).filter((c) => c.jobId === jobId).length;
  }, [state.candidates, jobId, isNew]);

  function handleSave() {
    if (!title.trim()) return;

    const now = nowISO();
    const reqArray = requirements
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    const job: Job = {
      id: isNew ? generateId() : jobId,
      title: title.trim(),
      department: department.trim(),
      location: location.trim() || undefined,
      type: type as Job["type"],
      description: description.trim(),
      requirements: reqArray,
      status,
      pipeline: existingJob?.pipeline ?? [...DEFAULT_PIPELINE_STAGES],
      criteria: existingJob?.criteria,
      candidateIds: existingJob?.candidateIds ?? [],
      createdAt: existingJob?.createdAt ?? now,
      updatedAt: now,
    };

    dispatch({ type: isNew ? "ADD_JOB" : "UPDATE_JOB", job });
    setSelectedJobId(null);
  }

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this job? This cannot be undone.")) return;
    dispatch({ type: "DELETE_JOB", id: jobId });
    setSelectedJobId(null);
  }

  function handleViewPipeline() {
    setSelectedJobId(jobId);
    setCurrentView("candidates");
  }

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: 24, maxWidth: 720 }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setSelectedJobId(null)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--foreground)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <ArrowLeftIcon /> Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>
          {isNew ? "New Job" : "Edit Job"}
        </h2>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Title <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            style={inputStyle}
          />
        </div>

        {/* Department + Location row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={labelStyle}>Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Type + Status row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as JobType)}
              style={inputStyle}
            >
              {JOB_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              style={inputStyle}
            >
              {JOB_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Job description…"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* Requirements */}
        <div>
          <label style={labelStyle}>Requirements</label>
          <textarea
            rows={4}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="One requirement per line…"
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "block" }}>
            Enter one requirement per line
          </span>
        </div>

        {/* Salary Range */}
        <div>
          <label style={labelStyle}>Salary Range (optional)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min"
              style={inputStyle}
            />
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Linked candidates section (existing jobs only) */}
        {!isNew && (
          <div
            style={{
              padding: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  Linked Candidates
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  {candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={handleViewPipeline}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <KanbanIcon /> View Pipeline
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            flexWrap: "wrap",
            paddingTop: 8,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                background: title.trim() ? "var(--primary)" : "var(--border)",
                color: title.trim() ? "#fff" : "var(--muted)",
                border: "none",
                borderRadius: 8,
                cursor: title.trim() ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <SaveIcon /> {isNew ? "Create Job" : "Save Changes"}
            </button>
            <button
              onClick={() => setSelectedJobId(null)}
              style={{
                padding: "8px 20px",
                background: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>

          {!isNew && (
            <button
              onClick={handleDelete}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "transparent",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              <TrashIcon /> Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
