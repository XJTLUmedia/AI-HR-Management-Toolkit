"use client";

import { useState, useCallback } from "react";
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

type SearchScope = "candidates" | "jobs" | "interviews" | "offers";
const ALL_SCOPES: SearchScope[] = ["candidates", "jobs", "interviews", "offers"];

interface SearchResult {
  entityType: string;
  id: string;
  label: string;
  matchField: string;
  snippet: string;
}

interface FilteredCandidate {
  id: string;
  name: string;
  email: string;
  stage: string;
  jobId: string;
  tags: string[];
}

export default function SearchPanel() {
  const { state, setSelectedCandidateId, setSelectedJobId, setCurrentView } = useATS();

  const [query, setQuery] = useState("");
  const [scopes, setScopes] = useState<SearchScope[]>([...ALL_SCOPES]);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  // Structured filter state
  const [filterMode, setFilterMode] = useState(false);
  const [filterStage, setFilterStage] = useState("");
  const [filterJobId, setFilterJobId] = useState("");
  const [filterTags, setFilterTags] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filteredCandidates, setFilteredCandidates] = useState<FilteredCandidate[] | null>(null);

  const toggleScope = (scope: SearchScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  // Run local search (same algorithm as ats_search MCP tool)
  const runSearch = useCallback(() => {
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const found: SearchResult[] = [];
    const { candidates, jobs, interviews, offers } = state;

    if (scopes.includes("candidates")) {
      for (const c of Object.values(candidates)) {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (fullName.includes(q)) {
          found.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "name", snippet: c.email });
        } else if (c.email.toLowerCase().includes(q)) {
          found.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "email", snippet: c.email });
        } else if (c.tags.some((t) => t.toLowerCase().includes(q))) {
          const matched = c.tags.filter((t) => t.toLowerCase().includes(q));
          found.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "tags", snippet: matched.join(", ") });
        }
      }
    }

    if (scopes.includes("jobs")) {
      for (const j of Object.values(jobs)) {
        if (j.title.toLowerCase().includes(q)) {
          found.push({ entityType: "job", id: j.id, label: j.title, matchField: "title", snippet: `${j.department} — ${j.status}` });
        } else if (j.description.toLowerCase().includes(q)) {
          const idx = j.description.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(j.description.length, idx + q.length + 40);
          found.push({ entityType: "job", id: j.id, label: j.title, matchField: "description", snippet: `...${j.description.slice(start, end)}...` });
        } else if (j.department.toLowerCase().includes(q)) {
          found.push({ entityType: "job", id: j.id, label: j.title, matchField: "department", snippet: j.department });
        }
      }
    }

    if (scopes.includes("interviews")) {
      for (const i of Object.values(interviews)) {
        if (i.interviewers.some((name) => name.toLowerCase().includes(q))) {
          found.push({ entityType: "interview", id: i.id, label: `Interview (${i.type})`, matchField: "interviewer", snippet: i.interviewers.join(", ") });
        }
      }
    }

    if (scopes.includes("offers")) {
      for (const o of Object.values(offers)) {
        if (o.status.toLowerCase().includes(q)) {
          found.push({ entityType: "offer", id: o.id, label: `Offer (${o.status})`, matchField: "status", snippet: `$${o.salary?.base || 0} ${o.salary?.currency || ""}` });
        }
      }
    }

    setResults(found);
    setFilteredCandidates(null);
  }, [query, scopes, state]);

  const runFilter = useCallback(() => {
    let list = Object.values(state.candidates);

    if (filterStage) {
      list = list.filter((c) => c.currentStage === filterStage);
    }
    if (filterJobId) {
      list = list.filter((c) => c.jobId === filterJobId);
    }
    if (filterTags.trim()) {
      const required = filterTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      list = list.filter((c) =>
        required.some((rt) => c.tags.some((ct) => ct.toLowerCase().includes(rt)))
      );
    }
    if (filterMinScore) {
      const min = parseFloat(filterMinScore);
      if (!isNaN(min)) {
        list = list.filter((c) => {
          const score = c.assessmentResult?.overallScore;
          return score !== undefined && score >= min;
        });
      }
    }

    setFilteredCandidates(
      list.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        stage: c.currentStage,
        jobId: c.jobId,
        tags: c.tags,
      }))
    );
    setResults(null);
  }, [state, filterStage, filterJobId, filterTags, filterMinScore]);

  const navigateToResult = (r: SearchResult) => {
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
  };

  const entityIcon = (type: string) => {
    switch (type) {
      case "candidate": return "👤";
      case "job": return "💼";
      case "interview": return "📅";
      case "offer": return "📄";
      default: return "🔍";
    }
  };

  const stages = ["applied", "screening", "phone-screen", "interview", "final-round", "offer", "hired", "rejected"];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header */}
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
            Global Search
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Search across candidates, jobs, interviews, and offers — or use structured filters
          </p>
        </motion.div>

        {/* Mode toggle */}
        <motion.div variants={itemVariants} style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          <button
            onClick={() => setFilterMode(false)}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: "1px solid var(--border)", cursor: "pointer",
              background: !filterMode ? "var(--primary)" : "var(--surface)",
              color: !filterMode ? "#fff" : "var(--muted)",
              transition: "all 0.2s",
            }}
          >
            Keyword Search
          </button>
          <button
            onClick={() => setFilterMode(true)}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: "1px solid var(--border)", cursor: "pointer",
              background: filterMode ? "var(--primary)" : "var(--surface)",
              color: filterMode ? "#fff" : "var(--muted)",
              transition: "all 0.2s",
            }}
          >
            Structured Filter
          </button>
        </motion.div>

        {/* ── Keyword Search ── */}
        {!filterMode && (
          <motion.div variants={itemVariants}>
            {/* Scope selection */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {ALL_SCOPES.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  style={{
                    fontSize: 12, padding: "4px 12px", borderRadius: 6,
                    border: "1px solid var(--border)", cursor: "pointer",
                    background: scopes.includes(scope) ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface)",
                    color: scopes.includes(scope) ? "var(--primary)" : "var(--muted)",
                    fontWeight: scopes.includes(scope) ? 600 : 400,
                  }}
                >
                  {scope}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search by name, email, tag, title, department..."
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--foreground)", fontSize: 14,
                }}
              />
              <button
                onClick={runSearch}
                style={{
                  padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Search
              </button>
            </div>

            {/* Results */}
            <AnimatePresence>
              {results !== null && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                    {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
                  </div>
                  {results.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                      No matches found
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {results.map((r) => (
                      <motion.div
                        key={`${r.entityType}-${r.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigateToResult(r)}
                        style={{
                          background: "var(--surface)", border: "1px solid var(--border)",
                          borderRadius: 10, padding: 14, cursor: "pointer",
                          display: "flex", gap: 12, alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{entityIcon(r.entityType)}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{r.label}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {r.snippet}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                            color: "var(--primary)",
                          }}>
                            {r.entityType}
                          </span>
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 99,
                            background: "var(--border)", color: "var(--foreground)",
                          }}>
                            {r.matchField}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Structured Filter ── */}
        {filterMode && (
          <motion.div variants={itemVariants}>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Pipeline Stage</label>
                  <select
                    value={filterStage}
                    onChange={(e) => setFilterStage(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All stages</option>
                    {stages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Job</label>
                  <select
                    value={filterJobId}
                    onChange={(e) => setFilterJobId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All jobs</option>
                    {Object.values(state.jobs).map((j) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={filterTags}
                    onChange={(e) => setFilterTags(e.target.value)}
                    placeholder="e.g. react, senior"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Min Score</label>
                  <input
                    type="number"
                    value={filterMinScore}
                    onChange={(e) => setFilterMinScore(e.target.value)}
                    placeholder="0-100"
                    min={0} max={100}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={runFilter}
                style={{
                  marginTop: 14, padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                Apply Filters
              </button>
            </div>

            <AnimatePresence>
              {filteredCandidates !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                    {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? "s" : ""} match
                  </div>
                  {filteredCandidates.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                      No candidates match the filters
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredCandidates.map((c) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => { setSelectedCandidateId(c.id); setCurrentView("candidates"); }}
                        style={{
                          background: "var(--surface)", border: "1px solid var(--border)",
                          borderRadius: 10, padding: 14, cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.email}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                            background: "var(--primary)", color: "#fff",
                          }}>
                            {c.stage}
                          </span>
                          {c.tags.slice(0, 3).map((t) => (
                            <span key={t} style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 99,
                              background: "var(--border)", color: "var(--foreground)",
                            }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
