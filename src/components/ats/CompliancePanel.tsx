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

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function CompliancePanel() {
  const { state } = useATS();
  const [activeTab, setActiveTab] = useState<"audit" | "eeo" | "gdpr" | "settings">("audit");

  const auditLog = useMemo(() => (state.auditLog ?? []).slice().reverse().slice(0, 100), [state.auditLog]);
  const eeoRecords = useMemo(() => state.eeoRecords ?? {}, [state.eeoRecords]);
  const settings = useMemo(() => state.complianceSettings, [state.complianceSettings]);

  const eeoStats = useMemo(() => {
    const records = Object.values(eeoRecords);
    const genderDist: Record<string, number> = {};
    const ethnicityDist: Record<string, number> = {};
    for (const r of records) {
      if (r.gender) genderDist[r.gender] = (genderDist[r.gender] || 0) + 1;
      if (r.ethnicity) ethnicityDist[r.ethnicity] = (ethnicityDist[r.ethnicity] || 0) + 1;
    }
    return { total: records.length, genderDist, ethnicityDist };
  }, [eeoRecords]);

  const tabs = [
    { id: "audit" as const, label: "Audit Trail" },
    { id: "eeo" as const, label: "EEO Reports" },
    { id: "gdpr" as const, label: "GDPR" },
    { id: "settings" as const, label: "Settings" },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-400"><ShieldIcon /></div>
        <div>
          <h2 className="text-xl font-semibold text-white">Compliance & Audit</h2>
          <p className="text-sm text-zinc-400">EEO/EEOC reporting, GDPR, audit trail, data retention</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex gap-2 border-b border-zinc-800 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.id
                ? "border-red-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {activeTab === "audit" && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Recent Audit Events</h3>
            <span className="text-xs text-zinc-500">{auditLog.length} entries</span>
          </div>
          {auditLog.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No audit events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400">{entry.action}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">{entry.description}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-zinc-500">Entity: {entry.entityType}/{entry.entityId}</span>
                    <span className="text-xs text-zinc-500">Actor: {entry.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "eeo" && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Records</p>
              <p className="text-2xl font-bold text-white mt-1">{eeoStats.total}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Gender Distribution</p>
              <div className="mt-2 space-y-1">
                {Object.entries(eeoStats.genderDist).map(([g, count]) => (
                  <div key={g} className="flex justify-between text-sm">
                    <span className="text-zinc-300 capitalize">{g}</span>
                    <span className="text-zinc-400">{count} ({Math.round((count / eeoStats.total) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Ethnicity Distribution</p>
              <div className="mt-2 space-y-1">
                {Object.entries(eeoStats.ethnicityDist).map(([e, count]) => (
                  <div key={e} className="flex justify-between text-sm">
                    <span className="text-zinc-300 capitalize">{e.replace(/_/g, " ")}</span>
                    <span className="text-zinc-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {eeoStats.total === 0 && (
            <p className="text-sm text-zinc-500 text-center py-4">No EEO records. Enable EEO tracking in Settings and collect voluntary self-identification data.</p>
          )}
        </motion.div>
      )}

      {activeTab === "gdpr" && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-medium text-white">GDPR Data Management</h3>
            <p className="text-sm text-zinc-400">
              Use the MCP tools (<code className="text-emerald-400">ats_compliance</code>) to perform GDPR operations:
            </p>
            <ul className="text-sm text-zinc-400 space-y-2 list-disc list-inside">
              <li><strong className="text-zinc-200">Data Export</strong> — <code className="text-emerald-400">gdpr_export</code> generates a full personal data report per GDPR Article 15</li>
              <li><strong className="text-zinc-200">Data Erasure</strong> — <code className="text-emerald-400">gdpr_erase</code> removes all personal data with confirmation required</li>
              <li><strong className="text-zinc-200">Retention Check</strong> — <code className="text-emerald-400">retention_check</code> flags data exceeding retention policies</li>
            </ul>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${settings?.gdprEnabled ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-sm text-zinc-300">GDPR Processing: {settings?.gdprEnabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "settings" && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-medium text-white">Compliance Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-300">GDPR Enabled</span>
                <span className={`text-sm font-medium ${settings?.gdprEnabled ? "text-emerald-400" : "text-red-400"}`}>
                  {settings?.gdprEnabled ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-300">EEO Tracking</span>
                <span className={`text-sm font-medium ${settings?.eeoTrackingEnabled ? "text-emerald-400" : "text-red-400"}`}>
                  {settings?.eeoTrackingEnabled ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-300">Auto-Anonymize Rejected</span>
                <span className="text-sm text-zinc-400">{settings?.anonymizeRejectedAfterDays ?? "N/A"} days</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm text-zinc-300">Retention Policies</span>
                <span className="text-sm text-zinc-400">{settings?.retentionPolicies?.length ?? 0} configured</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Use the <code className="text-emerald-400">ats_compliance</code> MCP tool with action <code className="text-emerald-400">update_settings</code> to modify these settings.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
