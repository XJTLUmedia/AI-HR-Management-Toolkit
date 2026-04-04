"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useATS } from "@/lib/ats/context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

const SCORE_COLORS = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-blue-400", "text-emerald-400"];
const REC_LABELS: Record<string, { label: string; color: string }> = {
  strong_yes: { label: "Strong Yes", color: "text-emerald-400" },
  yes: { label: "Yes", color: "text-blue-400" },
  neutral: { label: "Neutral", color: "text-yellow-400" },
  no: { label: "No", color: "text-orange-400" },
  strong_no: { label: "Strong No", color: "text-red-400" },
};

export default function ScorecardManager() {
  const { state, dispatch } = useATS();
  const [activeTab, setActiveTab] = useState<"templates" | "entries">("templates");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCriteria, setNewCriteria] = useState<{ name: string; weight: string }[]>([
    { name: "", weight: "0.25" },
  ]);

  const templates = useMemo(() => Object.values(state.scorecardTemplates ?? {}), [state.scorecardTemplates]);
  const entries = useMemo(() => Object.values(state.scorecardEntries ?? {}), [state.scorecardEntries]);
  const candidates = useMemo(() => state.candidates ?? {}, [state.candidates]);

  function addCriterion() {
    setNewCriteria([...newCriteria, { name: "", weight: "0.25" }]);
  }

  function removeCriterion(idx: number) {
    setNewCriteria(newCriteria.filter((_, i) => i !== idx));
  }

  function handleCreateTemplate() {
    if (!newName.trim() || newCriteria.length === 0) return;
    const totalWeight = newCriteria.reduce((s, c) => s + Number(c.weight), 0);
    if (Math.abs(totalWeight - 1) > 0.05) {
      alert(`Criteria weights must sum to 1.0 (currently ${totalWeight.toFixed(2)})`);
      return;
    }
    const id = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    dispatch({
      type: "ADD_SCORECARD_TEMPLATE",
      template: {
        id,
        name: newName.trim(),
        criteria: newCriteria.map((c) => ({
          id: `crit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: c.name,
          description: "",
          weight: Number(c.weight),
        })),
        createdAt: new Date().toISOString(),
      },
    });
    setNewName("");
    setNewCriteria([{ name: "", weight: "0.25" }]);
    setShowCreateTemplate(false);
  }

  // Compute scores for entries
  const scoredEntries = useMemo(() => {
    return entries.map((e) => {
      const tmpl = (state.scorecardTemplates ?? {})[e.templateId];
      let weightedScore = 0;
      if (tmpl) {
        for (const r of e.ratings) {
          const crit = tmpl.criteria.find((c) => c.id === r.criterionId);
          if (crit) weightedScore += r.score * crit.weight;
        }
      }
      const cand = candidates[e.candidateId];
      return {
        ...e,
        weightedScore: Math.round(weightedScore * 100) / 100,
        candidateName: cand ? `${cand.firstName} ${cand.lastName}` : e.candidateId,
        templateName: tmpl?.name ?? e.templateId,
      };
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [entries, state.scorecardTemplates, candidates]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><ClipboardIcon /></div>
          <div>
            <h2 className="text-xl font-semibold text-white">Structured Scorecards</h2>
            <p className="text-sm text-zinc-400">{templates.length} templates · {entries.length} evaluations</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateTemplate(!showCreateTemplate)}
          className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
        >
          + New Template
        </button>
      </motion.div>

      {showCreateTemplate && (
        <motion.div variants={itemVariants} className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-3">
          <input
            placeholder="Template name (e.g. Technical Screen)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <div className="space-y-2">
            {newCriteria.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  placeholder="Criterion name"
                  value={c.name}
                  onChange={(e) => {
                    const updated = [...newCriteria];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setNewCriteria(updated);
                  }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                <input
                  placeholder="Weight"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={c.weight}
                  onChange={(e) => {
                    const updated = [...newCriteria];
                    updated[idx] = { ...updated[idx], weight: e.target.value };
                    setNewCriteria(updated);
                  }}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
                {newCriteria.length > 1 && (
                  <button onClick={() => removeCriterion(idx)} className="text-xs text-red-400 hover:text-red-300 px-2">✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={addCriterion} className="text-xs text-amber-400 hover:text-amber-300">+ Add Criterion</button>
            <span className="text-xs text-zinc-500">
              Total weight: {newCriteria.reduce((s, c) => s + Number(c.weight), 0).toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateTemplate} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500">Create</button>
            <button onClick={() => setShowCreateTemplate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="flex gap-2 border-b border-zinc-800">
        {(["templates", "entries"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
              activeTab === tab ? "border-amber-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab === "templates" ? "Templates" : "Evaluations"}
          </button>
        ))}
      </motion.div>

      {activeTab === "templates" && (
        <motion.div variants={itemVariants} className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No scorecard templates. Create one to standardize interview evaluations.</p>
          ) : (
            templates.map((tmpl) => (
              <div key={tmpl.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">{tmpl.name}</span>
                    {tmpl.jobId && <span className="text-xs text-zinc-500 ml-2">Job: {tmpl.jobId}</span>}
                    {tmpl.interviewType && <span className="text-xs text-zinc-500 ml-2">Type: {tmpl.interviewType}</span>}
                  </div>
                  <button
                    onClick={() => dispatch({ type: "DELETE_SCORECARD_TEMPLATE", id: tmpl.id })}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tmpl.criteria.map((c) => (
                    <span key={c.id} className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded">
                      {c.name} <span className="text-zinc-500">({(c.weight * 100).toFixed(0)}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {activeTab === "entries" && (
        <motion.div variants={itemVariants} className="space-y-3">
          {scoredEntries.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No evaluations yet. Use the MCP tool to fill scorecards.</p>
          ) : (
            scoredEntries.map((entry) => (
              <div key={entry.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">{entry.candidateName}</span>
                    <span className="text-xs text-zinc-500 ml-2">{entry.templateName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-amber-400">{entry.weightedScore.toFixed(2)}/5</span>
                    <span className={`text-xs font-medium ${REC_LABELS[entry.overallRecommendation]?.color ?? "text-zinc-400"}`}>
                      {REC_LABELS[entry.overallRecommendation]?.label ?? entry.overallRecommendation}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.ratings.map((r) => {
                    const tmpl = (state.scorecardTemplates ?? {})[entry.templateId];
                    const critName = tmpl?.criteria.find((c) => c.id === r.criterionId)?.name ?? r.criterionId;
                    return (
                      <span key={r.criterionId} className="px-2 py-1 text-xs bg-zinc-800 rounded">
                        <span className="text-zinc-400">{critName}:</span>{" "}
                        <span className={SCORE_COLORS[r.score] ?? "text-zinc-300"}>{r.score}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                  <span>By: {entry.evaluator}</span>
                  <span>{new Date(entry.submittedAt).toLocaleDateString()}</span>
                </div>
                {entry.notes && <p className="text-xs text-zinc-400 mt-1 italic">{entry.notes}</p>}
              </div>
            ))
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
