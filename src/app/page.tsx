"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import { generateDemoData } from "@/lib/ats/demo-data";
import { type PipelineStage, DEFAULT_PIPELINE_STAGES, generateId, nowISO } from "@/lib/ats/types";
import type { Candidate, Activity } from "@/lib/ats/types";

// ATS components
import Sidebar from "@/components/ats/Sidebar";
import { Dashboard } from "@/components/ats/Dashboard";
import { KanbanBoard } from "@/components/ats/KanbanBoard";
import { CandidateDetail } from "@/components/ats/CandidateDetail";
import { JobList } from "@/components/ats/JobList";
import { JobEditor } from "@/components/ats/JobEditor";
import { InterviewScheduler } from "@/components/ats/InterviewScheduler";
import { OfferManager } from "@/components/ats/OfferManager";
import CompliancePanel from "@/components/ats/CompliancePanel";
import TalentPoolManager from "@/components/ats/TalentPoolManager";
import ScorecardManager from "@/components/ats/ScorecardManager";
import OnboardingTracker from "@/components/ats/OnboardingTracker";
import CommunicationCenter from "@/components/ats/CommunicationCenter";
import SearchPanel from "@/components/ats/SearchPanel";
import AnalysisPanel from "@/components/ats/AnalysisPanel";
import ParsingHealthMonitor from "@/components/ats/ParsingHealthMonitor";

// Existing resume parser components
import { FileUpload } from "@/components/FileUpload";
import { ParseResult } from "@/components/ParseResult";
import { ChatInterface } from "@/components/ChatInterface";
import { ProviderSelector, type ProviderConfig } from "@/components/ProviderSelector";
import { PipelineVisualization } from "@/components/PipelineVisualization";
import { BatchUpload, type BatchData, type BatchResult } from "@/components/BatchUpload";
import { BatchResults } from "@/components/BatchResults";
import { ExportBar } from "@/components/ExportBar";
import { EmailConfig } from "@/components/EmailConfig";
import { CriteriaEditor, DEFAULT_CRITERIA } from "@/components/CriteriaEditor";
import { AssessmentResultDisplay } from "@/components/AssessmentResult";
import type { AssessmentResult as AssessmentResultType } from "@/lib/analysis/criteria-scorer";
import type { AssessmentCriteria } from "@/lib/schemas/criteria";

type ParserTab = "result" | "pipeline" | "chat" | "batch" | "assess";

const fadeSlide = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

/* ──────────────────────── Resume Parser Sub-view ──────────────────────── */

function ResumeParserView() {
  const { state, dispatch, setCurrentView, setSelectedCandidateId } = useATS();
  const [parseData, setParseData] = useState<{
    rawText: string;
    structured: Record<string, unknown>;
    pageCount: number | null;
    algorithmicAnalysis?: Record<string, unknown>;
    pipeline?: Record<string, unknown>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<ParserTab>("result");
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "openai",
    model: "",
    apiKey: "",
  });
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [criteria, setCriteria] = useState<AssessmentCriteria>(DEFAULT_CRITERIA as AssessmentCriteria);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultType | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJobForAdd, setSelectedJobForAdd] = useState<string>("");

  const handleConfigChange = useCallback((config: ProviderConfig) => setProviderConfig(config), []);
  const handleSelectResume = useCallback((result: BatchResult) => {
    if (result.structured) {
      setParseData({ rawText: result.rawText ?? "", structured: result.structured, pageCount: null, pipeline: result.pipeline });
      setActiveTab("result");
    }
  }, []);
  const handleRunAssessment = useCallback(async () => {
    if (!parseData?.structured) return;
    setAssessing(true);
    setAssessError(null);
    try {
      const { assessCandidate } = await import("@/lib/analysis/criteria-scorer");
      const resume = parseData.structured as Parameters<typeof assessCandidate>[0];
      setAssessmentResult(assessCandidate(resume, criteria));
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setAssessing(false);
    }
  }, [parseData, criteria]);

  const handleAddToPipeline = useCallback(() => {
    if (!parseData?.structured || !selectedJobForAdd) return;
    const contact = (parseData.structured as Record<string, Record<string, string>>).contact || {};
    const skills = (parseData.structured as Record<string, Array<{ name: string }>>).skills || [];
    const candidateId = generateId();
    const candidate: Candidate = {
      id: candidateId,
      firstName: (contact.name || "Parsed").split(" ")[0] || "Candidate",
      lastName: (contact.name || "Resume").split(" ").slice(1).join(" ") || "Import",
      email: contact.email || `parsed-${Date.now()}@import.local`,
      phone: contact.phone,
      location: contact.location,
      currentStage: "applied",
      jobId: selectedJobForAdd,
      source: "upload",
      tags: skills.map((s: { name: string }) => s.name).slice(0, 6),
      resumeData: { rawText: parseData.rawText, structured: parseData.structured, pipeline: parseData.pipeline },
      assessmentResult: assessmentResult as Candidate["assessmentResult"],
      notes: [],
      activities: [
        { id: generateId(), type: "candidate-created", description: "Added from Resume Parser", timestamp: nowISO() } as Activity,
        { id: generateId(), type: "resume-parsed", description: "Resume parsed and analyzed", timestamp: nowISO() } as Activity,
      ],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    dispatch({ type: "ADD_CANDIDATE", candidate });
    // Also add candidate ID to the job
    const job = state.jobs[selectedJobForAdd];
    if (job) {
      dispatch({ type: "UPDATE_JOB", job: { ...job, candidateIds: [...job.candidateIds, candidateId], updatedAt: nowISO() } });
    }
    setShowAddModal(false);
    setSelectedJobForAdd("");
    setSelectedCandidateId(candidateId);
  }, [parseData, selectedJobForAdd, assessmentResult, dispatch, state.jobs, setSelectedCandidateId]);

  const jobs = Object.values(state.jobs).filter((j) => j.status === "open" || j.status === "draft");

  const tabs: { id: ParserTab; label: string }[] = [
    { id: "result", label: "Parsed Resume" },
    { id: "pipeline", label: "Pipeline" },
    { id: "chat", label: "AI Chat" },
    { id: "assess", label: "Assessment" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Provider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
          Provider
        </label>
        <div style={{ flex: 1 }}>
          <ProviderSelector onConfigChange={handleConfigChange} />
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setActiveTab("result")}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            border: activeTab !== "batch" ? "none" : "1px solid var(--border)",
            background: activeTab !== "batch" ? "var(--primary)" : "var(--surface)",
            color: activeTab !== "batch" ? "#fff" : "var(--muted)",
            cursor: "pointer",
          }}
        >
          Single Resume
        </button>
        <button
          onClick={() => setActiveTab("batch")}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            border: activeTab === "batch" ? "none" : "1px solid var(--border)",
            background: activeTab === "batch" ? "var(--primary)" : "var(--surface)",
            color: activeTab === "batch" ? "#fff" : "var(--muted)",
            cursor: "pointer",
          }}
        >
          Batch Processing
        </button>
        {parseData && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid var(--success)",
              background: "var(--surface)",
              color: "var(--success)",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            + Add to Pipeline
          </button>
        )}
      </div>

      {/* Add to Pipeline Modal */}
      {showAddModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 420, maxWidth: "90vw" }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Add to ATS Pipeline</h3>
            {jobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>No open jobs found. Create a job first.</p>
                <button
                  onClick={() => { setShowAddModal(false); setCurrentView("jobs"); }}
                  style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                >
                  Create Job
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>Select Job</label>
                  <select
                    value={selectedJobForAdd}
                    onChange={(e) => setSelectedJobForAdd(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                      background: "var(--background)", color: "var(--foreground)", fontSize: 14,
                    }}
                  >
                    <option value="">Choose a job...</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
                    ))}
                  </select>
                </div>
                {parseData?.structured && (
                  <div style={{ padding: 12, background: "rgba(99,102,241,0.04)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                    <strong>{((parseData.structured as Record<string, Record<string, string>>).contact?.name) || "Parsed Resume"}</strong>
                    <div style={{ color: "var(--muted)", marginTop: 4 }}>
                      {((parseData.structured as Record<string, Record<string, string>>).contact?.email) || "No email found"}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer", fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToPipeline}
                    disabled={!selectedJobForAdd}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--success)", color: "#fff",
                      cursor: selectedJobForAdd ? "pointer" : "not-allowed", fontWeight: 600, opacity: selectedJobForAdd ? 1 : 0.5,
                    }}
                  >
                    Add Candidate
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === "batch" ? (
          <motion.div key="batch" initial="hidden" animate="visible" exit="exit" variants={fadeSlide} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <BatchUpload onBatchProcessed={setBatchData} providerConfig={providerConfig} />
            {batchData && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Results</span>
                    <span style={{ fontSize: 12, color: "var(--success)" }}>{batchData.successful} passed</span>
                    {batchData.failed > 0 && <span style={{ fontSize: 12, color: "var(--danger)" }}>{batchData.failed} failed</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <ExportBar results={batchData.results} />
                    <EmailConfig results={batchData.results} />
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  <BatchResults results={batchData.results} onSelectResume={handleSelectResume} />
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="single" initial="hidden" animate="visible" exit="exit" variants={fadeSlide} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FileUpload onFileProcessed={setParseData} providerConfig={providerConfig} />
            {parseData && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, padding: "8px 8px 0", borderBottom: "1px solid var(--border)" }}>
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: activeTab === t.id ? 600 : 500,
                        color: activeTab === t.id ? "var(--primary)" : "var(--muted)",
                        background: "transparent",
                        border: "none",
                        borderBottom: activeTab === t.id ? "2px solid var(--primary)" : "2px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div style={{ padding: 20 }}>
                  {activeTab === "result" && <ParseResult data={parseData as Parameters<typeof ParseResult>[0]["data"]} />}
                  {activeTab === "pipeline" && (parseData.pipeline
                    ? <PipelineVisualization pipeline={parseData.pipeline as unknown as Parameters<typeof PipelineVisualization>[0]["pipeline"]} />
                    : <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Pipeline data not available. Re-parse the resume.</p>
                  )}
                  {activeTab === "assess" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <CriteriaEditor initialCriteria={criteria} onCriteriaChange={(c) => setCriteria(c as AssessmentCriteria)} />
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          onClick={handleRunAssessment}
                          disabled={assessing}
                          style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: assessing ? 0.5 : 1 }}
                        >
                          {assessing ? "Assessing…" : "Run Assessment"}
                        </button>
                        {assessError && <span style={{ color: "var(--danger)", fontSize: 13 }}>{assessError}</span>}
                      </div>
                      {assessmentResult && <AssessmentResultDisplay result={assessmentResult} criteriaName={criteria.name} />}
                    </div>
                  )}
                  {activeTab === "chat" && (
                    <div style={{ height: 500 }}>
                      <ChatInterface resumeText={parseData.rawText} providerConfig={providerConfig} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────── Settings view ──────────────────────── */

function SettingsView() {
  const { state, dispatch } = useATS();
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(
    state.settings.defaultPipeline || DEFAULT_PIPELINE_STAGES
  );
  const [newStageName, setNewStageName] = useState("");

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ats-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        dispatch({ type: "IMPORT_STATE", state: data });
      } catch {
        alert("Invalid JSON file");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }

  function handleLoadDemoData() {
    const demoState = generateDemoData();
    dispatch({ type: "IMPORT_STATE", state: demoState });
  }

  function handleClearAll() {
    dispatch({
      type: "IMPORT_STATE",
      state: {
        candidates: {},
        jobs: {},
        interviews: {},
        offers: {},
        talentPools: {},
        scorecardTemplates: {},
        scorecardEntries: {},
        onboardingChecklists: {},
        emailTemplates: {},
        communicationLog: [],
        auditLog: [],
        eeoRecords: {},
        complianceSettings: {
          gdprEnabled: false,
          eeoTrackingEnabled: false,
          retentionPolicies: [
            { entityType: "candidate", retentionDays: 730, autoDelete: false },
            { entityType: "application", retentionDays: 365, autoDelete: false },
          ],
          anonymizeRejectedAfterDays: 180,
        },
        settings: { defaultPipeline: DEFAULT_PIPELINE_STAGES },
      },
    });
    setConfirmClear(false);
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;
    const id = newStageName.trim().toLowerCase().replace(/\s+/g, "-");
    const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];
    setPipelineStages((prev) => [
      ...prev,
      { id, name: newStageName.trim(), order: prev.length, color: colors[prev.length % colors.length] },
    ]);
    setNewStageName("");
  }

  function handleRemoveStage(id: string) {
    setPipelineStages((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  }

  function handleSavePipeline() {
    dispatch({
      type: "IMPORT_STATE",
      state: {
        ...state,
        settings: { ...state.settings, defaultPipeline: pipelineStages },
      },
    });
    setEditingPipeline(false);
  }

  const stats = [
    { label: "Candidates", count: Object.keys(state.candidates).length },
    { label: "Jobs", count: Object.keys(state.jobs).length },
    { label: "Interviews", count: Object.keys(state.interviews).length },
    { label: "Offers", count: Object.keys(state.offers).length },
  ];

  const hasData = stats.some((s) => s.count > 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Settings</h2>

      {/* Demo Data */}
      <div style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--surface)) 0%, var(--surface) 100%)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Quick Start</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          {hasData
            ? "Your ATS has data. You can reload demo data (replaces current data) or export a backup first."
            : "Load realistic sample data to explore all features — 5 jobs, 21 candidates, interviews, and offers."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleLoadDemoData}
            style={{
              background: "var(--primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8,
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            {hasData ? "Reload Demo Data" : "Load Demo Data"}
          </button>
        </div>
      </div>

      {/* Data Overview */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Data Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center", padding: 12, background: "rgba(99,102,241,0.04)", borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>{s.count}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Editor */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Pipeline Stages</h3>
          <button
            onClick={() => setEditingPipeline(!editingPipeline)}
            style={{
              fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", cursor: "pointer",
            }}
          >
            {editingPipeline ? "Cancel" : "Edit"}
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: editingPipeline ? 12 : 0 }}>
          {pipelineStages.map((stage) => (
            <div
              key={stage.id}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 99,
                background: `color-mix(in srgb, ${stage.color} 15%, transparent)`,
                fontSize: 12, fontWeight: 600, color: stage.color,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 4, background: stage.color, flexShrink: 0 }} />
              {stage.name}
              {editingPipeline && !["applied", "hired", "rejected"].includes(stage.id) && (
                <button
                  onClick={() => handleRemoveStage(stage.id)}
                  style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {editingPipeline && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="New stage name..."
              onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--background)", color: "var(--foreground)", fontSize: 13,
              }}
            />
            <button
              onClick={handleAddStage}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Add
            </button>
            <button
              onClick={handleSavePipeline}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--success)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Data Management */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Data Management</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleExport}
            style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Export Data
          </button>
          <label style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            {importing ? "Importing…" : "Import Data"}
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          All data is stored in your browser&apos;s localStorage. Export regularly to avoid data loss.
        </p>
      </div>

      {/* Danger Zone */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--danger)" }}>Danger Zone</h3>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={!hasData}
            style={{
              background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)",
              padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14,
              cursor: hasData ? "pointer" : "not-allowed", opacity: hasData ? 1 : 0.4,
            }}
          >
            Clear All Data
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--danger)" }}>This will permanently delete all data.</span>
            <button
              onClick={handleClearAll}
              style={{ background: "var(--danger)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* About */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>About</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          Resume Parser & ATS — a fully frontend-only applicant tracking system.
          All data is stored locally in your browser. No backend server required.
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          <span>Version 3.0.0</span>
          <span>MCP-compatible</span>
          <span>localStorage-backed</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────── Candidates List view ──────────────────────── */

function CandidatesView() {
  const { state, setSelectedCandidateId, setSelectedJobId, setCurrentView } = useATS();
  const [search, setSearch] = useState("");

  const candidates = Object.values(state.candidates).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q);
  });

  if (candidates.length === 0 && !search) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Candidates Yet</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
          Create a job and add candidates, or parse resumes to populate your pipeline.
        </p>
        <button
          onClick={() => { setCurrentView("jobs"); setSelectedJobId("new"); }}
          style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
        >
          Create First Job
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>All Candidates</h2>
        <input
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)", padding: 8, borderRadius: 8, fontSize: 14, width: 240 }}
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {candidates.map((c) => {
          const job = state.jobs[c.jobId];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedCandidateId(c.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 14,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.firstName} {c.lastName}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {c.email} {job ? `· ${job.title}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "var(--primary)",
                  color: "#fff",
                }}>
                  {c.currentStage}
                </span>
                {c.tags.slice(0, 3).map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--border)", color: "var(--foreground)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ──────────────────────── Main ATS Shell ──────────────────────── */

export default function Home() {
  const { currentView, selectedJobId, selectedCandidateId } = useATS();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track mobile breakpoint to remove margin when bottom bar is used
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function renderContent() {
    switch (currentView) {
      case "dashboard":
        // Show candidate detail overlay from dashboard
        if (selectedCandidateId) return <CandidateDetail candidateId={selectedCandidateId} />;
        return <Dashboard />;
      case "candidates":
        if (selectedCandidateId) return <CandidateDetail candidateId={selectedCandidateId} />;
        return <CandidatesView />;
      case "jobs":
        if (selectedCandidateId) return <CandidateDetail candidateId={selectedCandidateId} />;
        if (selectedJobId && selectedJobId !== "new") {
          return <KanbanBoard jobId={selectedJobId} />;
        }
        if (selectedJobId === "new") {
          return <JobEditor jobId="new" />;
        }
        return <JobList />;
      case "interviews":
        return <InterviewScheduler />;
      case "offers":
        return <OfferManager />;
      case "talent-pool":
        return <TalentPoolManager />;
      case "scorecards":
        return <ScorecardManager />;
      case "onboarding":
        return <OnboardingTracker />;
      case "compliance":
        return <CompliancePanel />;
      case "communications":
        return <CommunicationCenter />;
      case "search":
        return <SearchPanel />;
      case "analysis":
        return <AnalysisPanel />;
      case "parsing-health":
        return <ParsingHealthMonitor />;
      case "parser":
        return <ResumeParserView />;
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: 24,
          paddingBottom: isMobile ? 80 : 24,
          marginLeft: isMobile ? 0 : sidebarCollapsed ? 64 : 240,
          width: isMobile ? "100%" : `calc(100vw - ${sidebarCollapsed ? 64 : 240}px)`,
          maxWidth: "100vw",
          transition: "margin-left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          background: "var(--background)",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentView}-${selectedJobId}-${selectedCandidateId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
