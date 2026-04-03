"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type {
  Interview,
  InterviewType,
  InterviewStatus,
  InterviewFeedback,
} from "@/lib/ats/types";
import { generateId, nowISO } from "@/lib/ats/types";

/* ────────── helpers ────────── */

const TYPE_LABELS: Record<InterviewType, string> = {
  phone: "Phone",
  video: "Video",
  onsite: "On-site",
  technical: "Technical",
  behavioral: "Behavioral",
  panel: "Panel",
};

const STATUS_COLORS: Record<InterviewStatus, string> = {
  scheduled: "var(--primary)",
  completed: "var(--success)",
  cancelled: "var(--danger)",
  "no-show": "var(--warning)",
};

function relativeTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 3600000) return `${Math.round(abs / 60000)}m ${diff > 0 ? "from now" : "ago"}`;
  if (abs < 86400000) return `${Math.round(abs / 3600000)}h ${diff > 0 ? "from now" : "ago"}`;
  return d.toLocaleDateString();
}

function groupByDate(interviews: Interview[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const groups: { label: string; items: Interview[] }[] = [
    { label: "Today", items: [] },
    { label: "Upcoming", items: [] },
    { label: "Past", items: [] },
  ];

  for (const iv of interviews) {
    const d = new Date(iv.scheduledAt);
    if (d >= today && d < tomorrow) groups[0].items.push(iv);
    else if (d >= tomorrow) groups[1].items.push(iv);
    else groups[2].items.push(iv);
  }
  return groups.filter((g) => g.items.length > 0);
}

/* ────────── component ────────── */

export function InterviewScheduler() {
  const { state, dispatch, setCurrentView } = useATS();
  const [view, setView] = useState<"list" | "schedule" | "feedback">("list");
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* schedule form */
  const [form, setForm] = useState({
    candidateId: "",
    jobId: "",
    type: "video" as InterviewType,
    date: "",
    time: "10:00",
    duration: 60,
    location: "",
    meetingLink: "",
    interviewers: "",
    notes: "",
  });

  /* feedback form */
  const [fb, setFb] = useState({
    rating: 0,
    strengths: "",
    concerns: "",
    recommendation: "hire" as InterviewFeedback["recommendation"],
    notes: "",
  });

  const candidates = useMemo(() => Object.values(state.candidates), [state.candidates]);
  const jobs = useMemo(
    () => Object.values(state.jobs).filter((j) => j.status === "open"),
    [state.jobs]
  );

  const interviews = useMemo(() => {
    let list = Object.values(state.interviews).sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => {
        const c = state.candidates[i.candidateId];
        return c && `${c.firstName} ${c.lastName}`.toLowerCase().includes(q);
      });
    }
    return list;
  }, [state.interviews, state.candidates, statusFilter, search]);

  const grouped = useMemo(() => groupByDate(interviews), [interviews]);

  /* handlers */

  function handleSchedule() {
    if (!form.candidateId || !form.jobId || !form.date) return;
    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
    const interview: Interview = {
      id: generateId(),
      candidateId: form.candidateId,
      jobId: form.jobId,
      type: form.type,
      status: "scheduled",
      scheduledAt,
      duration: form.duration,
      interviewers: form.interviewers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      location: form.location || undefined,
      meetingLink: form.meetingLink || undefined,
      notes: form.notes || undefined,
      createdAt: nowISO(),
    };
    dispatch({ type: "ADD_INTERVIEW", interview });
    dispatch({
      type: "ADD_ACTIVITY",
      candidateId: form.candidateId,
      activity: {
        id: generateId(),
        type: "interview-scheduled",
        description: `${TYPE_LABELS[form.type]} interview scheduled`,
        timestamp: nowISO(),
      },
    });
    setForm({
      candidateId: "",
      jobId: "",
      type: "video",
      date: "",
      time: "10:00",
      duration: 60,
      location: "",
      meetingLink: "",
      interviewers: "",
      notes: "",
    });
    setView("list");
  }

  function handleFeedback() {
    if (!feedbackTarget || fb.rating === 0) return;
    const iv = state.interviews[feedbackTarget];
    if (!iv) return;
    const feedback: InterviewFeedback = {
      rating: fb.rating,
      strengths: fb.strengths
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      concerns: fb.concerns
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      recommendation: fb.recommendation,
      notes: fb.notes,
      submittedAt: nowISO(),
    };
    dispatch({
      type: "UPDATE_INTERVIEW",
      interview: { ...iv, status: "completed", feedback },
    });
    dispatch({
      type: "ADD_ACTIVITY",
      candidateId: iv.candidateId,
      activity: {
        id: generateId(),
        type: "feedback-submitted",
        description: `Feedback: ${fb.recommendation} (${fb.rating}/5)`,
        timestamp: nowISO(),
      },
    });
    setFb({ rating: 0, strengths: "", concerns: "", recommendation: "hire", notes: "" });
    setFeedbackTarget(null);
    setView("list");
  }

  function cancelInterview(id: string) {
    const iv = state.interviews[id];
    if (!iv) return;
    dispatch({ type: "UPDATE_INTERVIEW", interview: { ...iv, status: "cancelled" } });
  }

  function startEditInterview(id: string) {
    const iv = state.interviews[id];
    if (!iv) return;
    const d = new Date(iv.scheduledAt);
    setForm({
      candidateId: iv.candidateId,
      jobId: iv.jobId,
      type: iv.type,
      date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
      duration: iv.duration,
      location: iv.location ?? "",
      meetingLink: iv.meetingLink ?? "",
      interviewers: iv.interviewers.join(", "),
      notes: iv.notes ?? "",
    });
    setEditingInterviewId(id);
    setView("schedule");
  }

  function handleSaveEdit() {
    if (!editingInterviewId || !form.candidateId || !form.jobId || !form.date) return;
    const iv = state.interviews[editingInterviewId];
    if (!iv) return;
    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
    dispatch({
      type: "UPDATE_INTERVIEW",
      interview: {
        ...iv,
        candidateId: form.candidateId,
        jobId: form.jobId,
        type: form.type,
        scheduledAt,
        duration: form.duration,
        interviewers: form.interviewers.split(",").map((s) => s.trim()).filter(Boolean),
        location: form.location || undefined,
        meetingLink: form.meetingLink || undefined,
        notes: form.notes || undefined,
      },
    });
    setEditingInterviewId(null);
    setForm({ candidateId: "", jobId: "", type: "video", date: "", time: "10:00", duration: 60, location: "", meetingLink: "", interviewers: "", notes: "" });
    setView("list");
  }

  function handleDeleteInterview(id: string) {
    dispatch({ type: "DELETE_INTERVIEW", id });
    setConfirmDeleteId(null);
  }

  /* ────── styles ────── */
  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  };
  const input: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    padding: 8,
    borderRadius: 8,
    width: "100%",
    fontSize: 14,
  };
  const badge = (color: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 99,
    background: color,
    color: "#fff",
    marginRight: 6,
  });
  const btnPrimary: React.CSSProperties = {
    background: "var(--primary)",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  };
  const btnSecondary: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  };

  /* ────── render ────── */

  if (view === "schedule") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: "0 auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button style={btnSecondary} onClick={() => { setView("list"); setEditingInterviewId(null); }}>
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editingInterviewId ? "Edit Interview" : "Schedule Interview"}</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Candidate *
            </span>
            <select
              style={input}
              value={form.candidateId}
              onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
            >
              <option value="">Select candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Job *
            </span>
            <select
              style={input}
              value={form.jobId}
              onChange={(e) => setForm({ ...form, jobId: e.target.value })}
            >
              <option value="">Select job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                Type
              </span>
              <select
                style={input}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as InterviewType })}
              >
                {(Object.keys(TYPE_LABELS) as InterviewType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                Duration (min)
              </span>
              <input
                type="number"
                style={input}
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                Date *
              </span>
              <input
                type="date"
                style={input}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                Time
              </span>
              <input
                type="time"
                style={input}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Location
            </span>
            <input
              style={input}
              value={form.location}
              placeholder="Room 301 / Office"
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Meeting Link
            </span>
            <input
              style={input}
              value={form.meetingLink}
              placeholder="https://meet.google.com/..."
              onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
            />
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Interviewers (comma-separated)
            </span>
            <input
              style={input}
              value={form.interviewers}
              placeholder="Alice, Bob, Carol"
              onChange={(e) => setForm({ ...form, interviewers: e.target.value })}
            />
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Notes
            </span>
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={btnPrimary} onClick={editingInterviewId ? handleSaveEdit : handleSchedule}>
              {editingInterviewId ? "Save Changes" : "Schedule"}
            </button>
            <button style={btnSecondary} onClick={() => { setView("list"); setEditingInterviewId(null); }}>
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── feedback view ── */
  if (view === "feedback" && feedbackTarget) {
    const iv = state.interviews[feedbackTarget];
    const cand = iv ? state.candidates[iv.candidateId] : null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: "0 auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            style={btnSecondary}
            onClick={() => {
              setView("list");
              setFeedbackTarget(null);
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            Feedback — {cand ? `${cand.firstName} ${cand.lastName}` : ""}
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Rating *
            </span>
            <div style={{ display: "flex", gap: 4, fontSize: 28, cursor: "pointer" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  onClick={() => setFb({ ...fb, rating: n })}
                  style={{ color: n <= fb.rating ? "var(--warning)" : "var(--border)" }}
                >
                  {n <= fb.rating ? "★" : "☆"}
                </span>
              ))}
            </div>
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Strengths (comma-separated)
            </span>
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical" }}
              value={fb.strengths}
              onChange={(e) => setFb({ ...fb, strengths: e.target.value })}
            />
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Concerns (comma-separated)
            </span>
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical" }}
              value={fb.concerns}
              onChange={(e) => setFb({ ...fb, concerns: e.target.value })}
            />
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Recommendation
            </span>
            <select
              style={input}
              value={fb.recommendation}
              onChange={(e) =>
                setFb({
                  ...fb,
                  recommendation: e.target.value as InterviewFeedback["recommendation"],
                })
              }
            >
              <option value="strong-hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="no-hire">No Hire</option>
              <option value="strong-no-hire">Strong No Hire</option>
            </select>
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, display: "block" }}>
              Notes
            </span>
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical" }}
              value={fb.notes}
              onChange={(e) => setFb({ ...fb, notes: e.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={btnPrimary} onClick={handleFeedback}>
              Submit Feedback
            </button>
            <button
              style={btnSecondary}
              onClick={() => {
                setView("list");
                setFeedbackTarget(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── list view ── */
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Interviews</h2>
        <button style={btnPrimary} onClick={() => setView("schedule")}>
          + Schedule Interview
        </button>
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          style={{ ...input, maxWidth: 240 }}
          placeholder="Search by candidate name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "scheduled", "completed", "cancelled", "no-show"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              ...btnSecondary,
              background: statusFilter === s ? "var(--primary)" : "var(--surface)",
              color: statusFilter === s ? "#fff" : "var(--foreground)",
              fontSize: 12,
              padding: "6px 12px",
            }}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* grouped list */}
      <AnimatePresence mode="popLayout">
        {grouped.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>No Interviews Scheduled</p>
            <p style={{ fontSize: 13, maxWidth: 360, margin: "4px auto 16px" }}>
              Interviews will appear here when candidates advance through the pipeline. Load demo data from Settings to see sample interviews.
            </p>
            <button
              onClick={() => setCurrentView("settings")}
              style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              Load Demo Data
            </button>
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.label} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
              {group.label}
            </h3>
            {group.items.map((iv) => {
              const cand = state.candidates[iv.candidateId];
              const job = state.jobs[iv.jobId];
              return (
                <motion.div
                  key={iv.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={card}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {cand ? `${cand.firstName} ${cand.lastName}` : "Unknown Candidate"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>
                        {job ? job.title : "Unknown Job"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={badge(STATUS_COLORS[iv.status])}>{iv.status}</span>
                      <span style={{ ...badge("var(--muted)"), background: "var(--border)", color: "var(--foreground)" }}>
                        {TYPE_LABELS[iv.type]}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>📅 {new Date(iv.scheduledAt).toLocaleString()}</span>
                    <span>⏱ {iv.duration}min</span>
                    {iv.interviewers.length > 0 && <span>👥 {iv.interviewers.join(", ")}</span>}
                    {iv.location && <span>📍 {iv.location}</span>}
                  </div>

                  {iv.feedback && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        background: "rgba(16,185,129,0.06)",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Feedback: </span>
                      {"★".repeat(iv.feedback.rating)}
                      {"☆".repeat(5 - iv.feedback.rating)} — {iv.feedback.recommendation}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {iv.status === "scheduled" && (
                      <>
                        <button
                          style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }}
                          onClick={() => {
                            setFeedbackTarget(iv.id);
                            setView("feedback");
                          }}
                        >
                          Complete & Add Feedback
                        </button>
                        <button
                          style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }}
                          onClick={() => startEditInterview(iv.id)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px", color: "var(--danger)" }}
                          onClick={() => cancelInterview(iv.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {iv.status === "completed" && !iv.feedback && (
                      <button
                        style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }}
                        onClick={() => {
                          setFeedbackTarget(iv.id);
                          setView("feedback");
                        }}
                      >
                        Add Feedback
                      </button>
                    )}
                    {confirmDeleteId === iv.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>Delete?</span>
                        <button style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px", color: "var(--danger)" }} onClick={() => handleDeleteInterview(iv.id)}>Yes</button>
                        <button style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }} onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px", color: "var(--danger)" }}
                        onClick={() => setConfirmDeleteId(iv.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
