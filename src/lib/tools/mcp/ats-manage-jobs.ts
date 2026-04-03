/**
 * MCP Tool: ats_manage_jobs
 *
 * Full CRUD + search for job postings in the ATS.
 * Actions: create, update, delete, list, search, close, reopen
 */

const JOB_TYPES = ["full-time", "part-time", "contract", "internship"] as const;
const JOB_STATUSES = ["draft", "open", "paused", "closed"] as const;

interface JobInput {
  title: string;
  department?: string;
  location?: string;
  type?: (typeof JOB_TYPES)[number];
  description: string;
  requirements?: string[];
  status?: (typeof JOB_STATUSES)[number];
}

interface ExistingJob {
  id: string;
  title: string;
  department: string;
  location?: string;
  type?: string;
  description: string;
  requirements: string[];
  status: string;
  candidateIds: string[];
  createdAt: string;
  updatedAt: string;
  pipeline?: Array<{ id: string; name: string; order: number; color: string }>;
}

type Action =
  | { type: "create"; job: JobInput }
  | { type: "update"; jobId: string; fields: Partial<JobInput> }
  | { type: "delete"; jobId: string }
  | { type: "list"; status?: string; department?: string }
  | { type: "search"; query: string }
  | { type: "close"; jobId: string }
  | { type: "reopen"; jobId: string };

const DEFAULT_PIPELINE = [
  { id: "applied", name: "Applied", order: 0, color: "#6366f1" },
  { id: "screening", name: "Screening", order: 1, color: "#8b5cf6" },
  { id: "phone-screen", name: "Phone Screen", order: 2, color: "#a855f7" },
  { id: "interview", name: "Interview", order: 3, color: "#06b6d4" },
  { id: "final-round", name: "Final Round", order: 4, color: "#0ea5e9" },
  { id: "offer", name: "Offer", order: 5, color: "#10b981" },
  { id: "hired", name: "Hired", order: 6, color: "#22c55e" },
  { id: "rejected", name: "Rejected", order: 7, color: "#ef4444" },
];

function randomId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export const mcpAtsManageJobsTool = {
  name: "ats_manage_jobs",
  description:
    "Manage job postings in the ATS. Actions: create (new job posting), update (edit fields), delete, list (with optional status/department filter), search (by keyword in title/description), close, reopen. Pass current jobs record and an action.",
  inputSchema: {
    type: "object" as const,
    properties: {
      jobs: {
        type: "object",
        description:
          "Current jobs record: Record<id, jobObject>. Pass {} for empty.",
      },
      action: {
        type: "object",
        description:
          'Action to perform. Must include "type" field: "create" | "update" | "delete" | "list" | "search" | "close" | "reopen". See tool description for per-action fields.',
      },
    },
    required: ["jobs", "action"],
  },
  handler(args: {
    jobs: Record<string, ExistingJob>;
    action: Action;
  }): { content: Array<{ type: "text"; text: string }> } {
    const { jobs, action } = args;

    switch (action.type) {
      case "create": {
        const { job } = action;
        if (!job.title?.trim()) {
          return r({ ok: false, error: "Job title is required" });
        }
        if (!job.description?.trim()) {
          return r({ ok: false, error: "Job description is required" });
        }
        const id = randomId();
        const now = nowISO();
        const newJob: ExistingJob = {
          id,
          title: job.title.trim(),
          department: job.department?.trim() || "General",
          location: job.location?.trim(),
          type: job.type || "full-time",
          description: job.description.trim(),
          requirements: job.requirements || [],
          status: job.status || "draft",
          candidateIds: [],
          pipeline: DEFAULT_PIPELINE,
          createdAt: now,
          updatedAt: now,
        };
        const updated = { ...jobs, [id]: newJob };
        return r({
          ok: true,
          jobId: id,
          job: newJob,
          jobs: updated,
          message: `Job "${newJob.title}" created with status "${newJob.status}"`,
        });
      }

      case "update": {
        const { jobId, fields } = action;
        const existing = jobs[jobId];
        if (!existing) {
          return r({ ok: false, error: `Job ${jobId} not found` });
        }
        const updated = {
          ...existing,
          ...(fields.title !== undefined && { title: fields.title.trim() }),
          ...(fields.department !== undefined && { department: fields.department.trim() }),
          ...(fields.location !== undefined && { location: fields.location.trim() }),
          ...(fields.type !== undefined && { type: fields.type }),
          ...(fields.description !== undefined && { description: fields.description.trim() }),
          ...(fields.requirements !== undefined && { requirements: fields.requirements }),
          ...(fields.status !== undefined && { status: fields.status }),
          updatedAt: nowISO(),
        };
        return r({
          ok: true,
          job: updated,
          jobs: { ...jobs, [jobId]: updated },
          message: `Job "${updated.title}" updated`,
        });
      }

      case "delete": {
        const { jobId } = action;
        if (!jobs[jobId]) {
          return r({ ok: false, error: `Job ${jobId} not found` });
        }
        const title = jobs[jobId].title;
        const candidateCount = jobs[jobId].candidateIds.length;
        const { [jobId]: _, ...rest } = jobs;
        return r({
          ok: true,
          jobs: rest,
          message: `Job "${title}" deleted (had ${candidateCount} linked candidates)`,
          warning: candidateCount > 0
            ? `${candidateCount} candidates were linked to this job. They still exist but are now orphaned.`
            : undefined,
        });
      }

      case "list": {
        let list = Object.values(jobs);
        if (action.status) {
          list = list.filter((j) => j.status === action.status);
        }
        if (action.department) {
          const dept = action.department.toLowerCase();
          list = list.filter((j) => j.department.toLowerCase().includes(dept));
        }
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return r({
          ok: true,
          total: list.length,
          jobs: list.map((j) => ({
            id: j.id,
            title: j.title,
            department: j.department,
            location: j.location,
            type: j.type,
            status: j.status,
            candidateCount: j.candidateIds.length,
            createdAt: j.createdAt,
          })),
        });
      }

      case "search": {
        const q = action.query.toLowerCase();
        const results = Object.values(jobs).filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q) ||
            j.department.toLowerCase().includes(q) ||
            j.requirements.some((r) => r.toLowerCase().includes(q))
        );
        return r({
          ok: true,
          query: action.query,
          total: results.length,
          jobs: results.map((j) => ({
            id: j.id,
            title: j.title,
            department: j.department,
            status: j.status,
            candidateCount: j.candidateIds.length,
          })),
        });
      }

      case "close": {
        const { jobId } = action;
        const existing = jobs[jobId];
        if (!existing) {
          return r({ ok: false, error: `Job ${jobId} not found` });
        }
        if (existing.status === "closed") {
          return r({ ok: false, error: `Job "${existing.title}" is already closed` });
        }
        const closed = { ...existing, status: "closed", updatedAt: nowISO() };
        return r({
          ok: true,
          job: closed,
          jobs: { ...jobs, [jobId]: closed },
          message: `Job "${closed.title}" closed`,
        });
      }

      case "reopen": {
        const { jobId } = action;
        const existing = jobs[jobId];
        if (!existing) {
          return r({ ok: false, error: `Job ${jobId} not found` });
        }
        if (existing.status !== "closed" && existing.status !== "paused") {
          return r({ ok: false, error: `Job "${existing.title}" is "${existing.status}", not closed/paused` });
        }
        const reopened = { ...existing, status: "open", updatedAt: nowISO() };
        return r({
          ok: true,
          job: reopened,
          jobs: { ...jobs, [jobId]: reopened },
          message: `Job "${reopened.title}" reopened`,
        });
      }

      default:
        return r({ ok: false, error: `Unknown action type: ${(action as Action).type}` });
    }
  },
};

function r(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
