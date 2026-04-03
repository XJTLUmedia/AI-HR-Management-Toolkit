"use client";

import { useState, type JSX } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { Activity, Note } from "@/lib/ats/types";
import { generateId, nowISO } from "@/lib/ats/types";

// Helpers

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

function activityIcon(type: Activity["type"]): string {
  const icons: Record<string, string> = {
    "stage-change": "\u2197",
    "note-added": "\ud83d\udcdd",
    "interview-scheduled": "\ud83d\udcc5",
    "interview-completed": "\u2705",
    "offer-created": "\ud83d\udcbc",
    "offer-updated": "\u270f\ufe0f",
    "assessment-run": "\ud83d\udcca",
    "resume-parsed": "\ud83d\udcc4",
    "feedback-submitted": "\ud83d\udcac",
    "candidate-created": "\u2795",
  };
  return icons[type] ?? "\u2022";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
}

function decisionBadgeStyle(decision: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    pass: { bg: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" },
    review: { bg: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" },
    reject: { bg: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" },
  };
  return map[decision] ?? map.review;
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  width: "100%",
  fontFamily: "inherit",
};

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 80%, transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>{title}</h3>
        {actions}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

// Component

interface CandidateDetailProps { candidateId: string; }

export function CandidateDetail({ candidateId }: CandidateDetailProps): JSX.Element {
  const { state, dispatch, setSelectedCandidateId, setCurrentView } = useATS();
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "", location: "", source: "" });

  const candidate = state.candidates[candidateId];
  if (!candidate) {
    return <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Candidate not found.</div>;
  }

  const job = state.jobs[candidate.jobId];
  const currentStage = job?.pipeline.find((s) => s.id === candidate.currentStage);

  function startEditing() {
    setEditForm({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? "",
      location: candidate.location ?? "",
      source: candidate.source ?? "",
    });
    setEditing(true);
  }

  function handleSaveEdit() {
    if (!editForm.firstName.trim() || !editForm.email.trim()) return;
    dispatch({
      type: "UPDATE_CANDIDATE",
      candidate: {
        ...candidate,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        location: editForm.location.trim() || undefined,
        source: editForm.source.trim() || undefined,
        updatedAt: nowISO(),
      },
    });
    setEditing(false);
  }

  function handleAddTag() {
    const tag = tagInput.trim();
    if (!tag || candidate.tags.includes(tag)) return;
    dispatch({
      type: "UPDATE_CANDIDATE",
      candidate: { ...candidate, tags: [...candidate.tags, tag], updatedAt: nowISO() },
    });
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    dispatch({
      type: "UPDATE_CANDIDATE",
      candidate: { ...candidate, tags: candidate.tags.filter((t) => t !== tag), updatedAt: nowISO() },
    });
  }

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const note: Note = { id: generateId(), content: noteText.trim(), author: "Recruiter", createdAt: nowISO() };
    dispatch({ type: "ADD_NOTE", candidateId, note });
    setNoteText("");
  }

  function handleUpdateNote(noteId: string) {
    if (!editNoteText.trim()) return;
    dispatch({ type: "UPDATE_NOTE", candidateId, noteId, content: editNoteText.trim() });
    setEditingNoteId(null);
    setEditNoteText("");
  }

  function handleDeleteNote(noteId: string) {
    dispatch({ type: "DELETE_NOTE", candidateId, noteId });
  }

  function handleDelete() {
    dispatch({ type: "DELETE_CANDIDATE", id: candidateId });
    setSelectedCandidateId(null);
  }

  const structured = candidate.resumeData?.structured as
    | { contact?: Record<string, unknown>; skills?: unknown[]; experience?: unknown[]; education?: unknown[] }
    | undefined;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button onClick={() => setSelectedCandidateId(null)} style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>{"\u2190"} Back</button>

      {/* Header */}
      <div style={{ padding: 20, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)" }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Edit Candidate</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>First Name *</span>
                <input style={inputStyle} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Last Name</span>
                <input style={inputStyle} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Email *</span>
              <input type="email" style={inputStyle} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Phone</span>
                <input style={inputStyle} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Location</span>
                <input style={inputStyle} value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Source</span>
              <input style={inputStyle} placeholder="e.g. LinkedIn, Referral" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleSaveEdit} disabled={!editForm.firstName.trim() || !editForm.email.trim()} style={{ fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, border: "none", background: editForm.firstName.trim() && editForm.email.trim() ? "var(--primary)" : "var(--border)", color: editForm.firstName.trim() && editForm.email.trim() ? "#fff" : "var(--muted)", cursor: editForm.firstName.trim() && editForm.email.trim() ? "pointer" : "default" }}>Save Changes</button>
              <button onClick={() => setEditing(false)} style={{ fontSize: 13, fontWeight: 500, padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>{candidate.firstName} {candidate.lastName}</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  {candidate.email && <span>{"\u2709"} {candidate.email}</span>}
                  {candidate.phone && <span>{"\u260e"} {candidate.phone}</span>}
                  {candidate.location && <span>{"\ud83d\udccd"} {candidate.location}</span>}
                  {candidate.source && <span>{"\ud83d\udd17"} {candidate.source}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {currentStage && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999, border: `1px solid ${currentStage.color}`, color: currentStage.color, background: `color-mix(in srgb, ${currentStage.color} 10%, transparent)`, whiteSpace: "nowrap" }}>{currentStage.name}</span>
                )}
                <button onClick={startEditing} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer" }}>{"\u270f\ufe0f"} Edit</button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
              {candidate.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>{"\u00d7"}</button>
                </span>
              ))}
              <form onSubmit={(e) => { e.preventDefault(); handleAddTag(); }} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="+ tag" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", width: 70 }} />
              </form>
            </div>
          </>
        )}
      </div>

      {/* Resume Data */}
      {candidate.resumeData && structured && (
        <Section title="Resume Data">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
            {structured.contact && <StatCard label="Contact" value="Available" />}
            <StatCard label="Skills" value={structured.skills?.length ?? 0} />
            <StatCard label="Experience" value={structured.experience?.length ?? 0} />
            <StatCard label="Education" value={structured.education?.length ?? 0} />
          </div>
        </Section>
      )}

      {/* Assessment */}
      {candidate.assessmentResult && (
        <Section title="Assessment">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: scoreBarColor(candidate.assessmentResult.overallScore) }}>{candidate.assessmentResult.overallScore}</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>/ 100</span>
            {(() => { const s = decisionBadgeStyle(candidate.assessmentResult.decision); return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.color, textTransform: "uppercase" }}>{candidate.assessmentResult.decision}</span>; })()}
          </div>
          {candidate.assessmentResult.summary && <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>{candidate.assessmentResult.summary}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidate.assessmentResult.axes.filter((a) => a.enabled).map((axis) => (
              <div key={axis.axis}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{axis.axis}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: scoreBarColor(axis.score) }}>{axis.score}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${axis.score}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ height: "100%", borderRadius: 3, background: scoreBarColor(axis.score) }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Activity Timeline */}
      <Section title="Activity Timeline">
        {candidate.activities.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>No activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[...candidate.activities].reverse().map((act, idx) => (
              <div key={act.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: idx < candidate.activities.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: "center" }}>{activityIcon(act.type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>{act.description}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{relativeTime(act.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Notes (full CRUD) */}
      <Section title="Notes">
        {candidate.notes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {candidate.notes.map((note) => (
              <div key={note.id} style={{ padding: 10, borderRadius: 6, border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 70%, transparent)" }}>
                {editingNoteId === note.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleUpdateNote(note.id)} disabled={!editNoteText.trim()} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 4, border: "none", background: editNoteText.trim() ? "var(--primary)" : "var(--border)", color: editNoteText.trim() ? "#fff" : "var(--muted)", cursor: editNoteText.trim() ? "pointer" : "default" }}>Save</button>
                      <button onClick={() => { setEditingNoteId(null); setEditNoteText(""); }} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{note.content}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{note.author} {"\u00b7"} {relativeTime(note.createdAt)}</p>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); }} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDeleteNote(note.id)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          <button type="submit" disabled={!noteText.trim()} style={{ alignSelf: "flex-end", fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, border: "none", background: noteText.trim() ? "var(--primary)" : "var(--border)", color: noteText.trim() ? "#fff" : "var(--muted)", cursor: noteText.trim() ? "pointer" : "default" }}>Add Note</button>
        </form>
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Schedule Interview" bg="var(--primary)" onClick={() => setCurrentView("interviews")} />
          <ActionButton label="Create Offer" bg="var(--success)" onClick={() => setCurrentView("offers")} />
          {!confirmDelete ? (
            <ActionButton label="Delete Candidate" bg="var(--danger)" onClick={() => setConfirmDelete(true)} />
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>Confirm delete?</span>
              <ActionButton label="Yes, delete" bg="var(--danger)" onClick={handleDelete} />
              <ActionButton label="Cancel" bg="var(--border)" textColor="var(--foreground)" onClick={() => setConfirmDelete(false)} />
            </div>
          )}
        </div>
      </Section>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, border: "1px solid var(--border)", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{label}</p>
    </div>
  );
}

function ActionButton({ label, bg, textColor = "#fff", onClick }: { label: string; bg: string; textColor?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "none", background: bg, color: textColor, cursor: "pointer" }}>{label}</button>
  );
}
