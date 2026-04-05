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

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  "application-received": "bg-blue-500/20 text-blue-400",
  "interview-invite": "bg-violet-500/20 text-violet-400",
  rejection: "bg-red-500/20 text-red-400",
  offer: "bg-emerald-500/20 text-emerald-400",
  "follow-up": "bg-yellow-500/20 text-yellow-400",
  onboarding: "bg-teal-500/20 text-teal-400",
  custom: "bg-zinc-600/20 text-zinc-400",
};

const CHANNEL_ICONS: Record<string, string> = {
  email: "📧",
  sms: "💬",
  phone: "📞",
  "in-app": "🔔",
};

export default function CommunicationCenter() {
  const { state, dispatch } = useATS();
  const [activeTab, setActiveTab] = useState<"templates" | "history">("history");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSubject, setNewTemplateSubject] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("custom");
  const [searchQuery, setSearchQuery] = useState("");
  // Edit template state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState("custom");

  const templates = useMemo(() => Object.values(state.emailTemplates ?? {}), [state.emailTemplates]);
  const commLog = useMemo(
    () => (state.communicationLog ?? []).slice().sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    [state.communicationLog]
  );
  const candidates = useMemo(() => state.candidates ?? {}, [state.candidates]);

  const filteredLog = useMemo(() => {
    if (!searchQuery) return commLog.slice(0, 100);
    const q = searchQuery.toLowerCase();
    return commLog
      .filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          (() => { const c = candidates[e.candidateId]; return c ? `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) : false; })()
      )
      .slice(0, 100);
  }, [commLog, searchQuery, candidates]);

  // Stats
  const stats = useMemo(() => {
    const byChannel: Record<string, number> = {};
    const byDirection: Record<string, number> = {};
    for (const e of commLog) {
      byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
      byDirection[e.direction] = (byDirection[e.direction] || 0) + 1;
    }
    return { total: commLog.length, byChannel, byDirection };
  }, [commLog]);

  function handleCreateTemplate() {
    if (!newTemplateName.trim() || !newTemplateSubject.trim()) return;
    const id = `etmpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    dispatch({
      type: "ADD_EMAIL_TEMPLATE",
      template: {
        id,
        name: newTemplateName.trim(),
        subject: newTemplateSubject.trim(),
        body: newTemplateBody.trim(),
        category: newTemplateCategory as "custom",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setNewTemplateName("");
    setNewTemplateSubject("");
    setNewTemplateBody("");
    setNewTemplateCategory("custom");
    setShowCreateTemplate(false);
  }

  function startEditTemplate(tmpl: (typeof templates)[0]) {
    setEditingTemplateId(tmpl.id);
    setEditName(tmpl.name);
    setEditSubject(tmpl.subject);
    setEditBody(tmpl.body);
    setEditCategory(tmpl.category);
  }

  function handleSaveTemplate() {
    if (!editingTemplateId || !editName.trim() || !editSubject.trim()) return;
    const existing = (state.emailTemplates ?? {})[editingTemplateId];
    dispatch({
      type: "ADD_EMAIL_TEMPLATE",
      template: {
        ...existing,
        name: editName.trim(),
        subject: editSubject.trim(),
        body: editBody.trim(),
        category: editCategory as "custom",
        updatedAt: new Date().toISOString(),
      },
    });
    setEditingTemplateId(null);
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400"><MailIcon /></div>
          <div>
            <h2 className="text-xl font-semibold text-white">Communication Center</h2>
            <p className="text-sm text-zinc-400">{templates.length} templates · {stats.total} messages</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateTemplate(!showCreateTemplate)}
          className="px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors"
        >
          + New Template
        </button>
      </motion.div>

      {/* Stats bar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <p className="text-xs text-zinc-400">Total Messages</p>
          <p className="text-lg font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <p className="text-xs text-zinc-400">Outbound</p>
          <p className="text-lg font-bold text-white">{stats.byDirection.outbound ?? 0}</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <p className="text-xs text-zinc-400">Inbound</p>
          <p className="text-lg font-bold text-white">{stats.byDirection.inbound ?? 0}</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <p className="text-xs text-zinc-400">Channels</p>
          <div className="flex gap-1 mt-1">
            {Object.entries(stats.byChannel).map(([ch, count]) => (
              <span key={ch} className="text-xs text-zinc-400" title={`${ch}: ${count}`}>
                {CHANNEL_ICONS[ch] ?? ch} {count}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {showCreateTemplate && (
        <motion.div variants={itemVariants} className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-3">
          <div className="flex gap-3">
            <input
              placeholder="Template name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <select
              value={newTemplateCategory}
              onChange={(e) => setNewTemplateCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {Object.keys(CATEGORY_COLORS).map((cat) => (
                <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="Subject (supports {{firstName}}, {{fullName}}, etc.)"
            value={newTemplateSubject}
            onChange={(e) => setNewTemplateSubject(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <textarea
            placeholder="Body (supports {{firstName}}, {{fullName}}, {{email}}, custom variables...)"
            value={newTemplateBody}
            onChange={(e) => setNewTemplateBody(e.target.value)}
            rows={5}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateTemplate} className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-500">Create</button>
            <button onClick={() => setShowCreateTemplate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="flex gap-2 border-b border-zinc-800">
        {(["history", "templates"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
              activeTab === tab ? "border-sky-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab === "history" ? "History" : "Templates"}
          </button>
        ))}
      </motion.div>

      {activeTab === "history" && (
        <motion.div variants={itemVariants} className="space-y-3">
          <input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {filteredLog.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">
              No communication history. Use the <code className="text-emerald-400">ats_communication</code> MCP tool to send messages.
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredLog.map((entry) => {
                const cand = candidates[entry.candidateId];
                return (
                  <div key={entry.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CHANNEL_ICONS[entry.channel] ?? "📝"}</span>
                        <span className="text-sm font-medium text-white">
                          {cand ? `${cand.firstName} ${cand.lastName}` : entry.candidateId}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          entry.direction === "outbound" ? "bg-sky-500/20 text-sky-400" : "bg-zinc-600/20 text-zinc-400"
                        }`}>
                          {entry.direction}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          entry.status === "sent" || entry.status === "delivered" ? "bg-emerald-500/20 text-emerald-400" :
                          entry.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-zinc-600/20 text-zinc-400"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500">{new Date(entry.sentAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-zinc-200 mt-2 font-medium">{entry.subject}</p>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{entry.body}</p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "templates" && (
        <motion.div variants={itemVariants} className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No email templates yet. Create one to standardize candidate communication.</p>
          ) : (
            templates.map((tmpl) => (
              <div key={tmpl.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                {editingTemplateId === tmpl.id ? (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      >
                        {Object.keys(CATEGORY_COLORS).map((cat) => (
                          <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={5}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveTemplate} className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-500">Save</button>
                      <button onClick={() => setEditingTemplateId(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{tmpl.name}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${CATEGORY_COLORS[tmpl.category] ?? CATEGORY_COLORS.general}`}>
                          {tmpl.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditTemplate(tmpl)}
                          className="text-xs text-sky-400 hover:text-sky-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => dispatch({ type: "DELETE_EMAIL_TEMPLATE", id: tmpl.id })}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300 mt-2">Subject: {tmpl.subject}</p>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-3 whitespace-pre-wrap">{tmpl.body}</p>
                    <p className="text-xs text-zinc-600 mt-2">Updated: {new Date(tmpl.updatedAt).toLocaleDateString()}</p>
                  </>
                )}
              </div>
            ))
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
