/**
 * MCP Tool: ats_onboarding
 *
 * Post-hire onboarding checklist management.
 * Create checklists from templates, assign tasks, track progress, manage completion.
 */

type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
type TaskCategory = "paperwork" | "it_setup" | "training" | "orientation" | "compliance" | "other";

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  status: TaskStatus;
  completedAt?: string;
  category: TaskCategory;
}

interface OnboardingChecklist {
  id: string;
  candidateId: string;
  jobId: string;
  tasks: OnboardingTask[];
  startDate: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type Action =
  | {
      type: "create";
      candidateId: string;
      jobId: string;
      startDate: string;
      tasks: { title: string; description?: string; assignee?: string; dueDate?: string; category?: TaskCategory }[];
    }
  | { type: "list"; candidateId?: string; status?: "active" | "completed" | "all" }
  | { type: "get"; checklistId: string }
  | { type: "update_task"; checklistId: string; taskId: string; status?: TaskStatus; assignee?: string; dueDate?: string }
  | { type: "add_task"; checklistId: string; title: string; description?: string; assignee?: string; dueDate?: string; category?: TaskCategory }
  | { type: "remove_task"; checklistId: string; taskId: string }
  | { type: "progress"; checklistId?: string; candidateId?: string }
  | { type: "delete"; checklistId: string }
  | { type: "overdue"; as_of?: string };

interface StateSlice {
  onboardingChecklists: Record<string, OnboardingChecklist>;
  candidates: Record<string, { id: string; firstName: string; lastName: string; [k: string]: unknown }>;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
function nowISO() { return new Date().toISOString(); }

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function handleAction(input: { action: Action; state: StateSlice }) {
  const { action, state } = input;
  const checklists = state.onboardingChecklists ?? {};
  const candidates = state.candidates ?? {};

  switch (action.type) {
    case "create": {
      const id = genId("onb");
      const checklist: OnboardingChecklist = {
        id,
        candidateId: action.candidateId,
        jobId: action.jobId,
        startDate: action.startDate,
        tasks: action.tasks.map((t) => ({
          id: genId("task"),
          title: t.title,
          description: t.description ?? "",
          assignee: t.assignee,
          dueDate: t.dueDate,
          status: "pending" as TaskStatus,
          category: t.category ?? "other",
        })),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      return ok({ created: true, checklist, _storeOp: "upsert_onboarding_checklist", _entity: checklist });
    }

    case "list": {
      let list = Object.values(checklists);
      if (action.candidateId) list = list.filter((c) => c.candidateId === action.candidateId);
      if (action.status === "active") list = list.filter((c) => !c.completedAt);
      else if (action.status === "completed") list = list.filter((c) => !!c.completedAt);

      const summaries = list.map((cl) => {
        const total = cl.tasks.length;
        const done = cl.tasks.filter((t) => t.status === "completed").length;
        const cand = candidates[cl.candidateId];
        return {
          id: cl.id,
          candidateName: cand ? `${cand.firstName} ${cand.lastName}` : cl.candidateId,
          jobId: cl.jobId,
          startDate: cl.startDate,
          progress: `${done}/${total}`,
          progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
          isComplete: !!cl.completedAt,
        };
      });
      return ok({ checklists: summaries, total: summaries.length });
    }

    case "get": {
      const cl = checklists[action.checklistId];
      if (!cl) return err("Checklist not found");
      return ok({ checklist: cl });
    }

    case "update_task": {
      const cl = checklists[action.checklistId];
      if (!cl) return err("Checklist not found");
      const taskIdx = cl.tasks.findIndex((t) => t.id === action.taskId);
      if (taskIdx === -1) return err("Task not found");

      const task = { ...cl.tasks[taskIdx] };
      if (action.status) {
        task.status = action.status;
        if (action.status === "completed") task.completedAt = nowISO();
        else task.completedAt = undefined;
      }
      if (action.assignee !== undefined) task.assignee = action.assignee;
      if (action.dueDate !== undefined) task.dueDate = action.dueDate;

      const tasks = [...cl.tasks];
      tasks[taskIdx] = task;

      const allDone = tasks.every((t) => t.status === "completed" || t.status === "skipped");
      const updated: OnboardingChecklist = {
        ...cl,
        tasks,
        completedAt: allDone ? nowISO() : undefined,
        updatedAt: nowISO(),
      };
      return ok({ updated: true, task, checklistComplete: allDone, _storeOp: "upsert_onboarding_checklist", _entity: updated });
    }

    case "add_task": {
      const cl = checklists[action.checklistId];
      if (!cl) return err("Checklist not found");
      const newTask: OnboardingTask = {
        id: genId("task"),
        title: action.title,
        description: action.description ?? "",
        assignee: action.assignee,
        dueDate: action.dueDate,
        status: "pending",
        category: action.category ?? "other",
      };
      const updated: OnboardingChecklist = {
        ...cl,
        tasks: [...cl.tasks, newTask],
        completedAt: undefined, // adding a task un-completes if it was done
        updatedAt: nowISO(),
      };
      return ok({ added: true, task: newTask, _storeOp: "upsert_onboarding_checklist", _entity: updated });
    }

    case "remove_task": {
      const cl = checklists[action.checklistId];
      if (!cl) return err("Checklist not found");
      const updated: OnboardingChecklist = {
        ...cl,
        tasks: cl.tasks.filter((t) => t.id !== action.taskId),
        updatedAt: nowISO(),
      };
      return ok({ removed: true, _storeOp: "upsert_onboarding_checklist", _entity: updated });
    }

    case "progress": {
      let targets: OnboardingChecklist[];
      if (action.checklistId) {
        const cl = checklists[action.checklistId];
        if (!cl) return err("Checklist not found");
        targets = [cl];
      } else if (action.candidateId) {
        targets = Object.values(checklists).filter((c) => c.candidateId === action.candidateId);
      } else {
        targets = Object.values(checklists);
      }

      const progress = targets.map((cl) => {
        const byCategory: Record<string, { total: number; done: number }> = {};
        const byStatus: Record<string, number> = {};
        for (const t of cl.tasks) {
          const cat = byCategory[t.category] ?? { total: 0, done: 0 };
          cat.total++;
          if (t.status === "completed") cat.done++;
          byCategory[t.category] = cat;
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        }
        const total = cl.tasks.length;
        const done = cl.tasks.filter((t) => t.status === "completed").length;
        return {
          checklistId: cl.id,
          candidateId: cl.candidateId,
          totalTasks: total,
          completedTasks: done,
          progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
          byCategory,
          byStatus,
          isComplete: !!cl.completedAt,
        };
      });
      return ok({ progress, total: progress.length });
    }

    case "delete": {
      if (!checklists[action.checklistId]) return err("Checklist not found");
      return ok({
        deleted: true,
        checklistId: action.checklistId,
        _storeOp: "delete_onboarding_checklist",
        _entity: { id: action.checklistId },
      });
    }

    case "overdue": {
      const asOf = action.as_of ? new Date(action.as_of) : new Date();
      const overdueTasks: { checklistId: string; candidateId: string; task: OnboardingTask }[] = [];
      for (const cl of Object.values(checklists)) {
        if (cl.completedAt) continue;
        for (const t of cl.tasks) {
          if (
            t.status !== "completed" &&
            t.status !== "skipped" &&
            t.dueDate &&
            new Date(t.dueDate) < asOf
          ) {
            overdueTasks.push({ checklistId: cl.id, candidateId: cl.candidateId, task: t });
          }
        }
      }
      return ok({ overdueTasks, total: overdueTasks.length, asOf: asOf.toISOString() });
    }

    default:
      return err(`Unknown action: ${(action as { type: string }).type}`);
  }
}

export const mcpAtsOnboardingTool = {
  name: "ats_onboarding",
  description:
    "Post-hire onboarding checklist management. Create checklists with categorized tasks " +
    "(paperwork, IT setup, training, orientation, compliance), track per-task progress, " +
    "find overdue items, manage assignees. Actions: create, list, get, update_task, " +
    "add_task, remove_task, progress, delete, overdue.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object" as const,
        description:
          'Action to perform. Set "type" to one of: create, list, get, update_task, ' +
          "add_task, remove_task, progress, delete, overdue.",
      },
      state: {
        type: "object" as const,
        description: "Current ATS state containing onboardingChecklists and candidates.",
      },
    },
    required: ["action", "state"],
  },
  handler: (args: { action: Action; state: StateSlice }) => handleAction(args),
};
