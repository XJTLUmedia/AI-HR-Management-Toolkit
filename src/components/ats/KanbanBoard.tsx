"use client";

import { useState, useMemo, type JSX } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { Candidate, PipelineStage } from "@/lib/ats/types";
import { generateId, nowISO } from "@/lib/ats/types";

// ──────────────────────────── Types ──────────────────────────────

interface KanbanBoardProps {
  jobId: string;
}

interface NewCandidateForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: NewCandidateForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

// ──────────────────────────── Helpers ─────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ──────────────────────────── Card ───────────────────────────────

function CandidateCard({
  candidate,
  stages,
  onMove,
  onClick,
  onDelete,
}: {
  candidate: Candidate;
  stages: PipelineStage[];
  onMove: (candidateId: string, stageId: string) => void;
  onClick: (candidateId: string) => void;
  onDelete: (candidateId: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <motion.div
      layout
      layoutId={candidate.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 12,
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      onClick={() => onClick(candidate.id)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", margin: 0 }}>
            {candidate.firstName} {candidate.lastName}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {candidate.email}
          </p>
        </div>

        {candidate.assessmentResult && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background:
                candidate.assessmentResult.overallScore >= 70
                  ? "color-mix(in srgb, var(--success) 14%, transparent)"
                  : candidate.assessmentResult.overallScore >= 50
                    ? "color-mix(in srgb, var(--warning) 14%, transparent)"
                    : "color-mix(in srgb, var(--danger) 14%, transparent)",
              color:
                candidate.assessmentResult.overallScore >= 70
                  ? "var(--success)"
                  : candidate.assessmentResult.overallScore >= 50
                    ? "var(--warning)"
                    : "var(--danger)",
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            {candidate.assessmentResult.overallScore}
          </span>
        )}
      </div>

      {/* Tags */}
      {candidate.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {candidate.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "var(--primary)",
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
          {candidate.tags.length > 3 && (
            <span style={{ fontSize: 10, color: "var(--muted)" }}>
              +{candidate.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: date + move dropdown + delete */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {relativeTime(candidate.createdAt)}
        </span>

        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* Move dropdown */}
          <select
            value={candidate.currentStage}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onMove(candidate.id, e.target.value);
            }}
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              cursor: "pointer",
              maxWidth: 110,
            }}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Delete */}
          {confirmDel ? (
            <div style={{ display: "flex", gap: 2, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
              <button onClick={(e) => { e.stopPropagation(); onDelete(candidate.id); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer" }}>Yes</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer" }}>No</button>
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }} title="Delete candidate" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" }}>×</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────── Column ─────────────────────────────

function KanbanColumn({
  stage,
  candidates,
  allStages,
  onMove,
  onClick,
  onDelete,
}: {
  stage: PipelineStage;
  candidates: Candidate[];
  allStages: PipelineStage[];
  onMove: (candidateId: string, stageId: string) => void;
  onClick: (candidateId: string) => void;
  onDelete: (candidateId: string) => void;
}) {
  return (
    <div
      style={{
        minWidth: 260,
        maxWidth: 300,
        flex: "1 0 260px",
        display: "flex",
        flexDirection: "column",
        borderRadius: 8,
        border: "1px solid var(--border)",
        borderTop: `3px solid ${stage.color}`,
        background: "color-mix(in srgb, var(--surface) 60%, transparent)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          {stage.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "1px 8px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--muted) 15%, transparent)",
            color: "var(--muted)",
          }}
        >
          {candidates.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
          flex: 1,
          minHeight: 80,
        }}
      >
        <AnimatePresence mode="popLayout">
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              stages={allStages}
              onMove={onMove}
              onClick={onClick}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
        {candidates.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 16 }}>
            No candidates
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────── Board ──────────────────────────────

export function KanbanBoard({ jobId }: KanbanBoardProps): JSX.Element {
  const { state, dispatch, setSelectedCandidateId } = useATS();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCandidateForm>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");

  const job = state.jobs[jobId];
  const stages = job?.pipeline ?? [];

  // Candidates for this job, grouped by stage
  const grouped = useMemo(() => {
    const map: Record<string, Candidate[]> = {};
    for (const s of stages) {
      map[s.id] = [];
    }
    const q = searchQuery.toLowerCase();
    for (const c of Object.values(state.candidates)) {
      if (c.jobId !== jobId) continue;
      if (q && !`${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)) continue;
      if (map[c.currentStage]) {
        map[c.currentStage].push(c);
      }
    }
    // Sort each column by updatedAt descending
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return map;
  }, [state.candidates, jobId, stages, searchQuery]);

  function handleMove(candidateId: string, stageId: string) {
    dispatch({ type: "MOVE_CANDIDATE", id: candidateId, stageId });
  }

  function handleClick(candidateId: string) {
    setSelectedCandidateId(candidateId);
  }

  function handleDeleteCandidate(candidateId: string) {
    dispatch({ type: "DELETE_CANDIDATE", id: candidateId });
    if (job) {
      dispatch({
        type: "UPDATE_JOB",
        job: { ...job, candidateIds: job.candidateIds.filter((cid) => cid !== candidateId), updatedAt: nowISO() },
      });
    }
  }

  function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.email.trim()) return;

    const now = nowISO();
    const id = generateId();
    const candidate: Candidate = {
      id,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      currentStage: stages[0]?.id ?? "applied",
      jobId,
      tags: [],
      notes: [],
      activities: [
        {
          id: generateId(),
          type: "candidate-created",
          description: "Candidate added to pipeline",
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: "ADD_CANDIDATE", candidate });

    // Also add candidateId to job
    if (job) {
      dispatch({
        type: "UPDATE_JOB",
        job: {
          ...job,
          candidateIds: [...job.candidateIds, id],
          updatedAt: now,
        },
      });
    }

    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  if (!job) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
        <p>Job not found.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>
          {job.title} — Pipeline
        </h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidates..."
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", width: 200 }}
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {showForm ? "Cancel" : "+ Add Candidate"}
          </button>
        </div>
      </div>

      {/* Inline add form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleAddCandidate}
            style={{
              overflow: "hidden",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "flex-end",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            {(
              [
                ["firstName", "First Name *"],
                ["lastName", "Last Name"],
                ["email", "Email *"],
                ["phone", "Phone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 160px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                  {label}
                </span>
                <input
                  type={key === "email" ? "email" : "text"}
                  required={key === "firstName" || key === "email"}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{
                    fontSize: 13,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                  }}
                />
              </label>
            ))}
            <button
              type="submit"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              Add
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Kanban columns — horizontal scroll */}
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          flex: 1,
          paddingBottom: 8,
        }}
      >
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            candidates={grouped[stage.id] ?? []}
            allStages={stages}
            onMove={handleMove}
            onClick={handleClick}
            onDelete={handleDeleteCandidate}
          />
        ))}
      </div>
    </div>
  );
}
