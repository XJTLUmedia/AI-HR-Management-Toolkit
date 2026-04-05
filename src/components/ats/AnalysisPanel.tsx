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

type Aspect = "keywords" | "patterns" | "similarity" | "entities" | "skills" | "experience" | "all";
const ASPECTS: Aspect[] = ["all", "keywords", "skills", "entities", "experience", "patterns", "similarity"];
const ASPECT_LABELS: Record<Aspect, string> = {
  all: "Full Analysis",
  keywords: "Keywords (TF-IDF)",
  skills: "Skills (Categorized)",
  entities: "Named Entities",
  experience: "Work History",
  patterns: "Patterns & Metrics",
  similarity: "Job Similarity",
};

export default function AnalysisPanel() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [selectedAspects, setSelectedAspects] = useState<Aspect[]>(["all"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const toggleAspect = (a: Aspect) => {
    if (a === "all") {
      setSelectedAspects(["all"]);
      return;
    }
    setSelectedAspects((prev) => {
      const without = prev.filter((p) => p !== "all" && p !== a);
      if (prev.includes(a)) return without.length ? without : ["all"];
      return [...without, a];
    });
  };

  const runAnalysis = useCallback(async () => {
    if (!resumeText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args: Record<string, any> = {
        resumeText,
        aspects: selectedAspects,
      };
      if (selectedAspects.includes("similarity") || selectedAspects.includes("all")) {
        if (jobDescription.trim()) args.jobDescription = jobDescription;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || "Analysis failed");
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [resumeText, jobDescription, selectedAspects]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header */}
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>
            Resume Analysis
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Algorithmic resume analysis — keywords, skills, entities, experience, patterns, and job similarity. No AI keys required.
          </p>
        </motion.div>

        {/* Aspect picker */}
        <motion.div variants={itemVariants} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {ASPECTS.map((a) => (
            <button
              key={a}
              onClick={() => toggleAspect(a)}
              style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 6,
                border: "1px solid var(--border)", cursor: "pointer",
                background: selectedAspects.includes(a) ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface)",
                color: selectedAspects.includes(a) ? "var(--primary)" : "var(--muted)",
                fontWeight: selectedAspects.includes(a) ? 600 : 400,
              }}
            >
              {ASPECT_LABELS[a]}
            </button>
          ))}
        </motion.div>

        {/* Input areas */}
        <motion.div variants={itemVariants} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Resume Text *
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume content here..."
            rows={8}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--foreground)", fontSize: 13, resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </motion.div>

        {(selectedAspects.includes("similarity") || selectedAspects.includes("all")) && (
          <motion.div variants={itemVariants} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Job Description {selectedAspects.includes("similarity") ? "*" : "(optional, for similarity)"}
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job description for similarity scoring..."
              rows={5}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--foreground)", fontSize: 13, resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <button
            onClick={runAnalysis}
            disabled={loading || !resumeText.trim()}
            style={{
              padding: "10px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: loading ? "var(--border)" : "var(--primary)",
              color: "#fff", border: "none", cursor: loading ? "default" : "pointer",
              opacity: loading || !resumeText.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div variants={itemVariants} style={{
            background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: 12, marginBottom: 16, fontSize: 13, color: "#991b1b",
          }}>
            {error}
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Keywords */}
              {result.keywords && <ResultSection title="Keywords" icon="🔑">
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                  {result.keywords.keywords?.length ?? 0} terms extracted (total corpus: {result.keywords.totalTerms})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {result.keywords.keywords?.slice(0, 25).map((kw: { term: string; score: number; skillCategory?: string | null }, i: number) => (
                    <span key={i} style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 6,
                      background: kw.skillCategory ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "var(--border)",
                      color: kw.skillCategory ? "var(--primary)" : "var(--foreground)",
                      fontWeight: 500,
                    }}>
                      {kw.term} <span style={{ opacity: 0.5 }}>({kw.score})</span>
                    </span>
                  ))}
                </div>
                {result.keywords.byCategory && Object.keys(result.keywords.byCategory).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>By Category</div>
                    {Object.entries(result.keywords.byCategory).map(([cat, terms]) => (
                      <div key={cat} style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)" }}>{cat.replace(/_/g, " ")}: </span>
                        <span style={{ fontSize: 12, color: "var(--foreground)" }}>{(terms as string[]).join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ResultSection>}

              {/* Skills */}
              {result.skills && <ResultSection title="Skills" icon="🛠️">
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                  {result.skills.totalSkills} skills found
                </div>
                {result.skills.proficiencyDistribution && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    {Object.entries(result.skills.proficiencyDistribution as Record<string, number>).map(([level, count]) => (
                      <div key={level} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{count}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "capitalize" }}>{level}</div>
                      </div>
                    ))}
                  </div>
                )}
                {result.skills.topSkillsByTfidf && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.skills.topSkillsByTfidf.map((s: { name: string; category: string; proficiency: string }, i: number) => (
                      <span key={i} style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 6,
                        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        color: "var(--primary)", fontWeight: 500,
                      }}>
                        {s.name} <span style={{ opacity: 0.5, fontSize: 10 }}>{s.proficiency}</span>
                      </span>
                    ))}
                  </div>
                )}
              </ResultSection>}

              {/* Entities */}
              {result.entities && <ResultSection title="Named Entities" icon="🏷️">
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                  {result.entities.totalEntities} entities — avg confidence {result.entities.averageConfidence}
                </div>
                {result.entities.byType && Object.entries(result.entities.byType).map(([type, entities]) => (
                  <div key={type} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>{type}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(entities as Array<{ text: string; confidence: number }>).slice(0, 10).map((e, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 4,
                          background: "var(--border)", color: "var(--foreground)",
                        }}>
                          {e.text} <span style={{ opacity: 0.5 }}>({e.confidence})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </ResultSection>}

              {/* Experience */}
              {result.experience && <ResultSection title="Work History" icon="💼">
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                  ~{result.experience.estimatedYearsOfExperience} years — {result.experience.entries?.length ?? 0} positions
                  {result.experience.careerProgression?.trend && ` — trend: ${result.experience.careerProgression.trend}`}
                </div>
                {result.experience.entries?.map((entry: {
                  title: string | null; organization: string | null;
                  dateRange: { raw: string } | null; durationEstimate: string | null;
                  technologies: string[]; achievements: string[];
                }, i: number) => (
                  <div key={i} style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: 12, marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {entry.title || "Unknown Title"}{entry.organization ? ` @ ${entry.organization}` : ""}
                    </div>
                    {entry.dateRange && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {entry.dateRange.raw}{entry.durationEstimate ? ` (${entry.durationEstimate})` : ""}
                      </div>
                    )}
                    {entry.technologies?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {entry.technologies.map((t, j) => (
                          <span key={j} style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 4,
                            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                            color: "var(--primary)",
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.achievements?.length > 0 && (
                      <ul style={{ margin: "6px 0 0 16px", padding: 0, fontSize: 12, color: "var(--foreground)" }}>
                        {entry.achievements.slice(0, 3).map((a, j) => <li key={j}>{a}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </ResultSection>}

              {/* Patterns */}
              {result.patterns && <ResultSection title="Patterns & Metrics" icon="📊">
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                  ~{result.patterns.estimatedYearsOfExperience} years — {result.patterns.dateRanges?.length ?? 0} date ranges — {result.patterns.sections?.length ?? 0} sections
                </div>
                {result.patterns.metrics && (
                  <div style={{ marginBottom: 8 }}>
                    {result.patterns.metrics.percentages?.length > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>Percentages: </span>
                        {result.patterns.metrics.percentages.join(", ")}
                      </div>
                    )}
                    {result.patterns.metrics.dollarAmounts?.length > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>Dollar Amounts: </span>
                        {result.patterns.metrics.dollarAmounts.join(", ")}
                      </div>
                    )}
                    {result.patterns.metrics.teamSizes?.length > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>Team Sizes: </span>
                        {result.patterns.metrics.teamSizes.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </ResultSection>}

              {/* Similarity */}
              {result.similarity && <ResultSection title="Job Similarity" icon="🎯">
                <div style={{
                  display: "flex", alignItems: "center", gap: 16, marginBottom: 12,
                  padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 700, color: "#fff",
                    background: result.similarity.scores?.weighted >= 70 ? "#22c55e" :
                      result.similarity.scores?.weighted >= 50 ? "#eab308" :
                      result.similarity.scores?.weighted >= 30 ? "#f97316" : "#ef4444",
                  }}>
                    {result.similarity.scores?.weighted}%
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", textTransform: "capitalize" }}>
                      {result.similarity.fitTier?.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{result.similarity.fitDescription}</div>
                  </div>
                </div>
                {result.similarity.skillAnalysis?.missing?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", marginBottom: 4 }}>Missing Skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.similarity.skillAnalysis.missing.slice(0, 15).map((s: { skill: string }, i: number) => (
                        <span key={i} style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 4,
                          background: "#fef2f2", color: "#ef4444",
                        }}>
                          {s.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.similarity.recommendations?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Recommendations</div>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "var(--foreground)" }}>
                      {result.similarity.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </ResultSection>}

              {/* Pipeline metadata */}
              {result.pipeline && <ResultSection title="Pipeline Info" icon="⚙️">
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  <div>Input: {result.pipeline.inputLength} chars → Cleaned: {result.pipeline.cleanedLength} chars</div>
                  {result.pipeline.parsingMethod && <div>Parsing: {result.pipeline.parsingMethod}</div>}
                </div>
              </ResultSection>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ResultSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--background)", border: "1px solid var(--border)",
        borderRadius: 10, padding: 16, marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>
        {icon} {title}
      </div>
      {children}
    </motion.div>
  );
}
