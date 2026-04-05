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

function ChecklistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-700 text-zinc-300",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  skipped: "bg-zinc-600/20 text-zinc-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  paperwork: "📄 Paperwork",
  "it-setup": "💻 IT Setup",
  training: "📚 Training",
  introduction: "🏢 Introduction",
  compliance: "🛡️ Compliance",
  other: "📋 Other",
};

export default function OnboardingTracker() {
  const { state, dispatch } = useATS();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newCandidateId, setNewCandidateId] = useState("");
  const [newJobId, setNewJobId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newTasks, setNewTasks] = useState<{ title: string; category: string; assignee: string; dueDate: string }[]>([
    { title: "", category: "other", assignee: "", dueDate: "" },
  ]);
  const [editingTask, setEditingTask] = useState<{ checklistId: string; taskId: string } | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCategory, setEditCategory] = useState("other");

  const checklists = useMemo(() => Object.values(state.onboardingChecklists ?? {}), [state.onboardingChecklists]);
  const candidates = useMemo(() => state.candidates ?? {}, [state.candidates]);

  const filtered = useMemo(() => {
    let list = checklists;
    if (filter === "active") list = list.filter((c) => !c.completedAt);
    else if (filter === "completed") list = list.filter((c) => !!c.completedAt);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [checklists, filter]);

  const selected = useMemo(
    () => (selectedId ? (state.onboardingChecklists ?? {})[selectedId] : null),
    [selectedId, state.onboardingChecklists]
  );

  function getProgress(cl: { tasks: { status: string }[] }) {
    const total = cl.tasks.length;
    const done = cl.tasks.filter((t) => t.status === "completed").length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  function handleTaskStatus(checklistId: string, taskId: string, status: string) {
    const cl = (state.onboardingChecklists ?? {})[checklistId];
    if (!cl) return;
    const tasks = cl.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: (status === "in_progress" ? "in-progress" : status) as "pending" | "in-progress" | "completed" | "skipped", completedAt: status === "completed" ? new Date().toISOString() : undefined }
        : t
    );
    const allDone = tasks.every((t) => t.status === "completed" || t.status === "skipped");
    dispatch({
      type: "UPDATE_ONBOARDING_CHECKLIST",
      checklist: { ...cl, tasks, completedAt: allDone ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() },
    });
  }

  function handleCreateChecklist() {
    if (!newCandidateId || !newJobId || !newStartDate) return;
    const validTasks = newTasks.filter((t) => t.title.trim());
    if (validTasks.length === 0) return;
    const id = `onb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    dispatch({
      type: "ADD_ONBOARDING_CHECKLIST",
      checklist: {
        id,
        candidateId: newCandidateId,
        jobId: newJobId,
        startDate: newStartDate,
        tasks: validTasks.map((t) => ({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: t.title.trim(),
          description: "",
          assignee: t.assignee || undefined,
          dueDate: t.dueDate || undefined,
          status: "pending" as const,
          category: t.category as "paperwork" | "it-setup" | "training" | "introduction" | "compliance" | "other",
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setNewCandidateId("");
    setNewJobId("");
    setNewStartDate("");
    setNewTasks([{ title: "", category: "other", assignee: "", dueDate: "" }]);
    setShowCreate(false);
  }

  function handleDeleteChecklist(id: string) {
    dispatch({ type: "DELETE_ONBOARDING_CHECKLIST", id });
    if (selectedId === id) setSelectedId(null);
  }

  function startEditTask(checklistId: string, task: { id: string; title: string; assignee?: string; dueDate?: string; category: string }) {
    setEditingTask({ checklistId, taskId: task.id });
    setEditTitle(task.title);
    setEditAssignee(task.assignee ?? "");
    setEditDueDate(task.dueDate ?? "");
    setEditCategory(task.category);
  }

  function handleSaveTaskEdit() {
    if (!editingTask) return;
    const cl = (state.onboardingChecklists ?? {})[editingTask.checklistId];
    if (!cl) return;
    const tasks = cl.tasks.map((t) =>
      t.id === editingTask.taskId
        ? { ...t, title: editTitle.trim() || t.title, assignee: editAssignee || undefined, dueDate: editDueDate || undefined, category: editCategory as "paperwork" | "it-setup" | "training" | "introduction" | "compliance" | "other" }
        : t
    );
    dispatch({
      type: "UPDATE_ONBOARDING_CHECKLIST",
      checklist: { ...cl, tasks, updatedAt: new Date().toISOString() },
    });
    setEditingTask(null);
  }

  function handleRemoveTask(checklistId: string, taskId: string) {
    const cl = (state.onboardingChecklists ?? {})[checklistId];
    if (!cl) return;
    dispatch({
      type: "UPDATE_ONBOARDING_CHECKLIST",
      checklist: { ...cl, tasks: cl.tasks.filter((t) => t.id !== taskId), updatedAt: new Date().toISOString() },
    });
  }

  function handleAddTask(checklistId: string) {
    const cl = (state.onboardingChecklists ?? {})[checklistId];
    if (!cl) return;
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: "New Task",
      description: "",
      status: "pending" as const,
      category: "other" as const,
    };
    dispatch({
      type: "UPDATE_ONBOARDING_CHECKLIST",
      checklist: { ...cl, tasks: [...cl.tasks, newTask], completedAt: undefined, updatedAt: new Date().toISOString() },
    });
    startEditTask(checklistId, newTask);
  }

  // Overdue tasks
  const overdueCount = useMemo(() => {
    const now = new Date();
    let count = 0;
    for (const cl of checklists) {
      if (cl.completedAt) continue;
      for (const t of cl.tasks) {
        if (t.status !== "completed" && t.status !== "skipped" && t.dueDate && new Date(t.dueDate) < now) count++;
      }
    }
    return count;
  }, [checklists]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400"><ChecklistIcon /></div>
          <div>
            <h2 className="text-xl font-semibold text-white">Onboarding Tracker</h2>
            <p className="text-sm text-zinc-400">
              {checklists.filter((c) => !c.completedAt).length} active · {overdueCount > 0 && (
                <span className="text-red-400">{overdueCount} overdue</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            + New Checklist
          </button>
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {(["active", "all", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === f ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {showCreate && (
        <motion.div variants={itemVariants} className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={newCandidateId}
              onChange={(e) => setNewCandidateId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select Candidate</option>
              {Object.values(candidates).map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
            <select
              value={newJobId}
              onChange={(e) => setNewJobId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select Job</option>
              {Object.values(state.jobs ?? {}).map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 font-medium">Tasks</p>
            {newTasks.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  placeholder="Task title"
                  value={t.title}
                  onChange={(e) => { const u = [...newTasks]; u[idx] = { ...u[idx], title: e.target.value }; setNewTasks(u); }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                <select
                  value={t.category}
                  onChange={(e) => { const u = [...newTasks]; u[idx] = { ...u[idx], category: e.target.value }; setNewTasks(u); }}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                >
                  {Object.keys(CATEGORY_LABELS).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  placeholder="Assignee"
                  value={t.assignee}
                  onChange={(e) => { const u = [...newTasks]; u[idx] = { ...u[idx], assignee: e.target.value }; setNewTasks(u); }}
                  className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                <input
                  type="date"
                  value={t.dueDate}
                  onChange={(e) => { const u = [...newTasks]; u[idx] = { ...u[idx], dueDate: e.target.value }; setNewTasks(u); }}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
                />
                {newTasks.length > 1 && (
                  <button onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-300 px-2">✕</button>
                )}
              </div>
            ))}
            <button
              onClick={() => setNewTasks([...newTasks, { title: "", category: "other", assignee: "", dueDate: "" }])}
              className="text-xs text-teal-400 hover:text-teal-300"
            >
              + Add Task
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateChecklist} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-500">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">
              No {filter === "all" ? "" : filter} checklists. Click &quot;+ New Checklist&quot; to create one.
            </p>
          ) : (
            filtered.map((cl) => {
              const prog = getProgress(cl);
              const cand = candidates[cl.candidateId];
              return (
                <div
                  key={cl.id}
                  onClick={() => setSelectedId(cl.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedId === cl.id
                      ? "bg-teal-500/10 border-teal-500/50 ring-1 ring-teal-500/30"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {cand ? `${cand.firstName} ${cand.lastName}` : cl.candidateId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">{prog.pct}%</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(cl.id); }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${prog.pct === 100 ? "bg-emerald-400" : "bg-teal-500"}`}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {prog.done}/{prog.total} tasks · Start: {new Date(cl.startDate).toLocaleDateString()}
                  </p>
                </div>
              );
            })
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">
                    {(() => { const c = candidates[selected.candidateId]; return c ? `${c.firstName} ${c.lastName}` : selected.candidateId })()}
                  </h3>
                  {selected.completedAt && (
                    <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded">Completed</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Start: {new Date(selected.startDate).toLocaleDateString()} · Job: {selected.jobId}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-3">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgress(selected).pct === 100 ? "bg-emerald-400" : "bg-teal-500"}`}
                    style={{ width: `${getProgress(selected).pct}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1 text-right">{getProgress(selected).pct}% complete</p>
              </div>

              {/* Group tasks by category */}
              {Object.entries(
                selected.tasks.reduce<Record<string, typeof selected.tasks>>((acc, t) => {
                  (acc[t.category] ??= []).push(t);
                  return acc;
                }, {})
              ).map(([category, tasks]) => (
                <div key={category} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">{CATEGORY_LABELS[category] ?? category}</h4>
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const isOverdue = task.status !== "completed" && task.status !== "skipped" && task.dueDate && new Date(task.dueDate) < new Date();
                      const isEditing = editingTask?.checklistId === selected.id && editingTask?.taskId === task.id;
                      if (isEditing) {
                        return (
                          <div key={task.id} className="p-2.5 rounded-lg bg-teal-500/5 border border-teal-500/20 space-y-2">
                            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Task title" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500" />
                            <div className="flex gap-2">
                              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                                {Object.keys(CATEGORY_LABELS).map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                              </select>
                              <input value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} placeholder="Assignee" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none" />
                              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveTaskEdit} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-500">Save</button>
                              <button onClick={() => setEditingTask(null)} className="px-3 py-1 text-xs text-zinc-400 hover:text-white">Cancel</button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={task.id} className={`flex items-center justify-between p-2.5 rounded-lg ${isOverdue ? "bg-red-500/5 border border-red-500/20" : "bg-zinc-800/50"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${task.status === "completed" ? "text-zinc-500 line-through" : "text-white"}`}>
                                {task.title}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] rounded ${STATUS_COLORS[task.status]}`}>
                                {task.status.replace("_", " ")}
                              </span>
                              {isOverdue && <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400">Overdue</span>}
                            </div>
                            {task.description && <p className="text-xs text-zinc-500 mt-0.5">{task.description}</p>}
                            <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                              {task.assignee && <span>Assignee: {task.assignee}</span>}
                              {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-3">
                            <button
                              onClick={() => startEditTask(selected.id, task)}
                              className="px-2 py-1 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded"
                            >
                              Edit
                            </button>
                            {task.status !== "completed" && (
                              <button
                                onClick={() => handleTaskStatus(selected.id, task.id, "completed")}
                                className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded"
                              >
                                ✓ Done
                              </button>
                            )}
                            {task.status === "pending" && (
                              <button
                                onClick={() => handleTaskStatus(selected.id, task.id, "in_progress")}
                                className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded"
                              >
                                Start
                              </button>
                            )}
                            {task.status !== "skipped" && task.status !== "completed" && (
                              <button
                                onClick={() => handleTaskStatus(selected.id, task.id, "skipped")}
                                className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded"
                              >
                                Skip
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveTask(selected.id, task.id)}
                              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handleAddTask(selected.id)}
                    className="mt-2 text-xs text-teal-400 hover:text-teal-300"
                  >
                    + Add Task
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-zinc-900 rounded-lg border border-zinc-800">
              <p className="text-sm text-zinc-500">Select a checklist to view tasks</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
