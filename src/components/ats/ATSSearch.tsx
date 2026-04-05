"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

type Scope = "candidates" | "jobs" | "interviews" | "offers";
const ALL_SCOPES: Scope[] = ["candidates", "jobs", "interviews", "offers"];

interface SearchResult {
  entityType: string;
  id: string;
  label: string;
  matchField: string;
  snippet: string;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function entityIcon(type: string) {
  switch (type) {
    case "candidate":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "job":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "interview":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      );
    case "offer":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" x2="12" y1="18" y2="12" />
          <line x1="9" x2="15" y1="15" y2="15" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ATSSearch() {
  const { state, setCurrentView, setSelectedCandidateId, setSelectedJobId } = useATS();
  const [query, setQuery] = useState("");
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(ALL_SCOPES));

  // --- Advanced filter state ---
  const [showFilters, setShowFilters] = useState(false);
  const [filterStage, setFilterStage] = useState("");
  const [filterJobId, setFilterJobId] = useState("");
  const [filterTags, setFilterTags] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");

  const jobs = useMemo(() => Object.values(state.jobs ?? {}), [state.jobs]);

  const toggleScope = useCallback((s: Scope) => {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { next.delete(s); } else { next.add(s); }
      return next.size === 0 ? new Set(ALL_SCOPES) : next;
    });
  }, []);

  // ── Search logic (same as ats_search MCP tool) ──
  const results: SearchResult[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    const limit = 50;

    if (scopes.has("candidates")) {
      for (const c of Object.values(state.candidates ?? {})) {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (fullName.includes(q)) {
          out.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "name", snippet: c.email });
        } else if (c.email.toLowerCase().includes(q)) {
          out.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "email", snippet: c.email });
        } else if (c.tags.some((t) => t.toLowerCase().includes(q))) {
          const matched = c.tags.filter((t) => t.toLowerCase().includes(q));
          out.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "tags", snippet: matched.join(", ") });
        } else if (c.notes?.some((n) => n.content.toLowerCase().includes(q))) {
          out.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "notes", snippet: "Note contains match" });
        }
        if (out.length >= limit) break;
      }
    }

    if (scopes.has("jobs") && out.length < limit) {
      for (const j of Object.values(state.jobs ?? {})) {
        if (j.title.toLowerCase().includes(q)) {
          out.push({ entityType: "job", id: j.id, label: j.title, matchField: "title", snippet: `${j.department} — ${j.status}` });
        } else if (j.description.toLowerCase().includes(q)) {
          const idx = j.description.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(j.description.length, idx + q.length + 40);
          out.push({ entityType: "job", id: j.id, label: j.title, matchField: "description", snippet: `…${j.description.slice(start, end)}…` });
        } else if (j.department.toLowerCase().includes(q)) {
          out.push({ entityType: "job", id: j.id, label: j.title, matchField: "department", snippet: j.department });
        }
        if (out.length >= limit) break;
      }
    }

    if (scopes.has("interviews") && out.length < limit) {
      for (const i of Object.values(state.interviews ?? {})) {
        if (i.interviewers?.some((name: string) => name.toLowerCase().includes(q))) {
          out.push({ entityType: "interview", id: i.id, label: `Interview (${i.type})`, matchField: "interviewer", snippet: i.interviewers.join(", ") });
        } else if (i.feedback?.notes?.toLowerCase().includes(q)) {
          out.push({ entityType: "interview", id: i.id, label: `Interview (${i.type})`, matchField: "feedback", snippet: "Feedback contains match" });
        }
        if (out.length >= limit) break;
      }
    }

    if (scopes.has("offers") && out.length < limit) {
      for (const o of Object.values(state.offers ?? {})) {
        if (o.status.toLowerCase().includes(q)) {
          out.push({ entityType: "offer", id: o.id, label: `Offer (${o.status})`, matchField: "status", snippet: `$${o.salary?.base ?? 0} ${o.salary?.currency ?? ""}` });
        }
        if (out.length >= limit) break;
      }
    }

    return out;
  }, [query, scopes, state]);

  // ── Structured candidate filter ──
  const filteredCandidates = useMemo(() => {
    if (!showFilters) return null;
    let list = Object.values(state.candidates ?? {});
    if (filterStage) list = list.filter((c) => c.currentStage === filterStage);
    if (filterJobId) list = list.filter((c) => c.jobId === filterJobId);
    if (filterTags) {
      const tags = filterTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tags.length) list = list.filter((c) => tags.some((rt) => c.tags.some((ct) => ct.toLowerCase().includes(rt))));
    }
    if (filterMinScore) {
      const min = parseFloat(filterMinScore);
      if (!isNaN(min)) list = list.filter((c) => (c.assessmentResult?.overallScore ?? 0) >= min);
    }
    return list;
  }, [showFilters, state.candidates, filterStage, filterJobId, filterTags, filterMinScore]);

  function navigateToResult(r: SearchResult) {
    switch (r.entityType) {
      case "candidate":
        setSelectedCandidateId(r.id);
        setCurrentView("candidates");
        break;
      case "job":
        setSelectedJobId(r.id);
        setCurrentView("jobs");
        break;
      case "interview":
        setCurrentView("interviews");
        break;
      case "offer":
        setCurrentView("offers");
        break;
    }
  }

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!groups[r.entityType]) groups[r.entityType] = [];
      groups[r.entityType].push(r);
    }
    return groups;
  }, [results]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header */}
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
            Global Search
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Search across candidates, jobs, interviews, and offers
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div variants={itemVariants} style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
        }}>
          <span style={{ color: "var(--muted)", flexShrink: 0 }}><SearchIcon /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--foreground)", fontSize: 15,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                background: "none", border: "none", color: "var(--muted)",
                cursor: "pointer", fontSize: 14, padding: "2px 6px",
              }}
            >
              Clear
            </button>
          )}
        </motion.div>

        {/* Scope toggles */}
        <motion.div variants={itemVariants} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {ALL_SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => toggleScope(s)}
              style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: "1px solid var(--border)", cursor: "pointer",
                background: scopes.has(s) ? "var(--primary)" : "var(--surface)",
                color: scopes.has(s) ? "#fff" : "var(--muted)",
                transition: "all 0.2s",
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button
            onClick={() => setShowFilters((p) => !p)}
            style={{
              padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "1px solid var(--border)", cursor: "pointer",
              background: showFilters ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface)",
              color: showFilters ? "var(--accent)" : "var(--muted)",
              transition: "all 0.2s",
            }}
          >
            Advanced Filters
          </button>
        </motion.div>

        {/* Advanced filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden", marginBottom: 16 }}
            >
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 16, display: "grid",
                gridTemplateColumns: "1fr 1fr", gap: 12,
              }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Stage</label>
                  <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}>
                    <option value="">All stages</option>
                    {["applied", "screening", "phone-screen", "interview", "final-round", "offer", "hired", "rejected"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Job</label>
                  <select value={filterJobId} onChange={(e) => setFilterJobId(e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}>
                    <option value="">All jobs</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Tags (comma-separated)</label>
                  <input type="text" value={filterTags} onChange={(e) => setFilterTags(e.target.value)}
                    placeholder="react, senior"
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Min Score</label>
                  <input type="number" value={filterMinScore} onChange={(e) => setFilterMinScore(e.target.value)}
                    placeholder="0-100" min={0} max={100} step={1}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filtered candidates (structured filter) */}
        {filteredCandidates !== null && (
          <motion.div variants={itemVariants} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
              Filtered Candidates ({filteredCandidates.length})
            </div>
            {filteredCandidates.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>No candidates match the filters</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredCandidates.slice(0, 30).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCandidateId(c.id); setCurrentView("candidates"); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      background: "var(--background)", border: "1px solid var(--border)",
                      borderRadius: 8, cursor: "pointer", textAlign: "left", width: "100%",
                    }}
                  >
                    <span style={{ color: "var(--primary)" }}>{entityIcon("candidate")}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                        {c.firstName} {c.lastName}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                        {c.currentStage} · {c.tags.slice(0, 3).join(", ")}
                      </span>
                    </span>
                    {c.assessmentResult?.overallScore != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                        background: c.assessmentResult.overallScore >= 70
                          ? "color-mix(in srgb, var(--success) 15%, transparent)"
                          : "color-mix(in srgb, var(--warning) 15%, transparent)",
                        color: c.assessmentResult.overallScore >= 70 ? "var(--success)" : "var(--warning)",
                      }}>
                        {c.assessmentResult.overallScore}
                      </span>
                    )}
                  </button>
                ))}
                {filteredCandidates.length > 30 && (
                  <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>
                    +{filteredCandidates.length - 30} more
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Search results (keyword search) */}
        {query.trim() && (
          <motion.div variants={itemVariants}>
            {results.length === 0 ? (
              <div style={{
                textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14,
              }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
                {Object.entries(groupedResults).map(([type, items]) => (
                  <div key={type} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--muted)", marginBottom: 8,
                    }}>
                      {type}s ({items.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {items.map((r) => (
                        <motion.button
                          key={`${r.entityType}-${r.id}`}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => navigateToResult(r)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                            background: "var(--surface)", border: "1px solid var(--border)",
                            borderRadius: 8, cursor: "pointer", textAlign: "left", width: "100%",
                            transition: "border-color 0.15s",
                          }}
                        >
                          <span style={{ color: "var(--primary)", flexShrink: 0 }}>{entityIcon(r.entityType)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                              {r.label}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                                color: "var(--primary)", marginRight: 6,
                              }}>
                                {r.matchField}
                              </span>
                              {r.snippet}
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted)", flexShrink: 0 }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Empty state */}
        {!query.trim() && !showFilters && (
          <motion.div variants={itemVariants} style={{
            textAlign: "center", padding: 60, color: "var(--muted)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <SearchIcon />
            </div>
            <p style={{ fontSize: 14 }}>Start typing to search across all ATS data</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>
              Or use Advanced Filters for structured candidate queries
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
