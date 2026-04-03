/**
 * MCP Tool: ATS Schedule Interview
 * Full CRUD: create, update, delete, list, get. Validates and detects conflicts.
 */

interface InterviewInput {
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  type: "phone" | "video" | "onsite" | "technical" | "behavioral" | "panel";
  scheduledDate: string; // ISO date-time
  durationMinutes: number;
  interviewers: string[];
  location?: string;
  meetingLink?: string;
  notes?: string;
}

interface ExistingInterview {
  id: string;
  scheduledDate: string;
  durationMinutes: number;
  interviewers: string[];
  status: string;
  candidateId?: string;
  jobId?: string;
  type?: string;
  [key: string]: unknown;
}

type Action =
  | { type: "create"; interview: InterviewInput }
  | { type: "update"; interviewId: string; updates: Partial<InterviewInput> }
  | { type: "delete"; interviewId: string }
  | { type: "list"; filters?: { candidateId?: string; jobId?: string; status?: string } }
  | { type: "get"; interviewId: string };

function r(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export const mcpAtsScheduleInterviewTool = {
  name: "ats_schedule_interview",
  description:
    "Full CRUD for interviews. Actions: create (validate & schedule with conflict detection), update (reschedule/modify), delete (permanent removal), list (filter by candidateId/jobId/status), get (single interview by id). Pass existing interviews record for conflict checks.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object",
        description: `Action to perform:
- { type: "create", interview: { candidateId, candidateName, jobId, jobTitle, type, scheduledDate, durationMinutes, interviewers, location?, meetingLink?, notes? } }
- { type: "update", interviewId, updates: { partial interview fields } }
- { type: "delete", interviewId }
- { type: "list", filters?: { candidateId?, jobId?, status? } }
- { type: "get", interviewId }`,
      },
      existingInterviews: {
        type: "object",
        description: "Current interviews record: Record<id, interviewObject>. Pass {} for fresh start.",
      },
    },
    required: ["action"],
  },

  handler(args: { action: Action; existingInterviews?: Record<string, ExistingInterview> }) {
    const interviews = args.existingInterviews ? { ...args.existingInterviews } : {};
    const now = new Date().toISOString();

    function detectConflicts(scheduledDate: string, durationMinutes: number, interviewers: string[], excludeId?: string) {
      const start = new Date(scheduledDate).getTime();
      const end = start + durationMinutes * 60000;
      const conflicts: Array<{ interviewId: string; interviewer: string; overlapMinutes: number }> = [];
      for (const [id, existing] of Object.entries(interviews)) {
        if (id === excludeId || existing.status === "cancelled") continue;
        const existStart = new Date(existing.scheduledDate).getTime();
        const existEnd = existStart + existing.durationMinutes * 60000;
        if (start < existEnd && end > existStart) {
          const overlapInterviewers = interviewers.filter((i) =>
            existing.interviewers.some((e) => e.toLowerCase() === i.toLowerCase())
          );
          for (const interviewer of overlapInterviewers) {
            conflicts.push({
              interviewId: id,
              interviewer,
              overlapMinutes: Math.round((Math.min(end, existEnd) - Math.max(start, existStart)) / 60000),
            });
          }
        }
      }
      return conflicts;
    }

    function validateInterview(iv: InterviewInput): string[] {
      const errors: string[] = [];
      if (!iv.candidateId) errors.push("candidateId is required");
      if (!iv.jobId) errors.push("jobId is required");
      if (!iv.scheduledDate) errors.push("scheduledDate is required");
      if (!iv.durationMinutes || iv.durationMinutes < 5) errors.push("durationMinutes must be >= 5");
      if (!iv.interviewers?.length) errors.push("At least one interviewer is required");
      const scheduledStart = new Date(iv.scheduledDate).getTime();
      if (isNaN(scheduledStart)) errors.push("Invalid scheduledDate format");
      return errors;
    }

    const { action } = args;

    switch (action.type) {
      case "create": {
        const errors = validateInterview(action.interview);
        if (errors.length) return r({ ok: false, errors });

        const conflicts = detectConflicts(action.interview.scheduledDate, action.interview.durationMinutes, action.interview.interviewers);
        const id = `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const structured = {
          id,
          candidateId: action.interview.candidateId,
          candidateName: action.interview.candidateName,
          jobId: action.interview.jobId,
          jobTitle: action.interview.jobTitle,
          type: action.interview.type,
          scheduledDate: action.interview.scheduledDate,
          durationMinutes: action.interview.durationMinutes,
          interviewers: action.interview.interviewers,
          location: action.interview.location || "",
          meetingLink: action.interview.meetingLink || "",
          notes: action.interview.notes || "",
          status: "scheduled",
          feedback: null,
          createdAt: now,
          updatedAt: now,
        };
        interviews[id] = structured as unknown as ExistingInterview;
        return r({
          ok: true,
          action: "create",
          interview: structured,
          conflicts: conflicts.length > 0 ? conflicts : null,
          warning: conflicts.length > 0
            ? `${conflicts.length} conflict(s): ${conflicts.map((c) => `${c.interviewer} overlap ${c.overlapMinutes}min`).join("; ")}`
            : null,
          interviews,
        });
      }

      case "update": {
        const iv = interviews[action.interviewId];
        if (!iv) return r({ ok: false, error: `Interview ${action.interviewId} not found` });

        const updates = action.updates;
        const updated = { ...iv, ...updates, updatedAt: now };

        // Re-check conflicts if schedule changed
        let conflicts: ReturnType<typeof detectConflicts> | null = null;
        if (updates.scheduledDate || updates.durationMinutes || updates.interviewers) {
          conflicts = detectConflicts(
            updated.scheduledDate,
            updated.durationMinutes,
            updated.interviewers,
            action.interviewId
          );
        }

        interviews[action.interviewId] = updated;
        return r({
          ok: true,
          action: "update",
          interviewId: action.interviewId,
          interview: updated,
          conflicts: conflicts && conflicts.length > 0 ? conflicts : null,
          interviews,
        });
      }

      case "delete": {
        const iv = interviews[action.interviewId];
        if (!iv) return r({ ok: false, error: `Interview ${action.interviewId} not found` });
        delete interviews[action.interviewId];
        return r({
          ok: true,
          action: "delete",
          interviewId: action.interviewId,
          message: `Interview ${action.interviewId} deleted`,
          interviews,
        });
      }

      case "list": {
        let list = Object.values(interviews);
        const f = action.filters;
        if (f?.candidateId) list = list.filter((i) => i.candidateId === f.candidateId);
        if (f?.jobId) list = list.filter((i) => i.jobId === f.jobId);
        if (f?.status) list = list.filter((i) => i.status === f.status);
        list.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        return r({ ok: true, action: "list", total: list.length, interviews: list });
      }

      case "get": {
        const iv = interviews[action.interviewId];
        if (!iv) return r({ ok: false, error: `Interview ${action.interviewId} not found` });
        return r({ ok: true, action: "get", interview: iv });
      }

      default:
        return r({ ok: false, error: `Unknown action type: ${(action as Action).type}` });
    }
  },
};
