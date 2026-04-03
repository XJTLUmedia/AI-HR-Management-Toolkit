/**
 * MCP Tool: ats_search
 *
 * Global search across all ATS entities: candidates, jobs, interviews, offers.
 */

interface CandidateSlice {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: string;
  jobId: string;
  tags: string[];
  notes?: Array<{ content: string; author: string }>;
  [key: string]: unknown;
}

interface JobSlice {
  id: string;
  title: string;
  department: string;
  description: string;
  status: string;
  requirements?: string[];
  [key: string]: unknown;
}

interface InterviewSlice {
  id: string;
  candidateId: string;
  jobId: string;
  type: string;
  status: string;
  interviewers: string[];
  scheduledAt?: string;
  feedback?: { recommendation?: string; notes?: string } | null;
  [key: string]: unknown;
}

interface OfferSlice {
  id: string;
  candidateId: string;
  jobId: string;
  status: string;
  salary?: { base?: number; currency?: string };
  [key: string]: unknown;
}

type Action =
  | { type: "search"; query: string; scope?: Array<"candidates" | "jobs" | "interviews" | "offers">; limit?: number }
  | { type: "filter_candidates"; filters: { stage?: string; jobId?: string; tags?: string[]; minScore?: number } }
  | { type: "get_entity"; entityType: "candidate" | "job" | "interview" | "offer"; entityId: string };

export const mcpAtsSearchTool = {
  name: "ats_search",
  description:
    "Global search across the ATS. Actions: search (keyword search across candidates, jobs, interviews, offers — scoped optionally), filter_candidates (structured filter by stage/job/tags/score), get_entity (retrieve a single entity by type+id). Pass the full ATS state.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: {
        type: "object",
        description:
          "Full ATS state: { candidates: Record<id, obj>, jobs: Record<id, obj>, interviews: Record<id, obj>, offers: Record<id, obj> }",
      },
      action: {
        type: "object",
        description:
          'Action: "search" (query, scope?, limit?), "filter_candidates" (filters: {stage?, jobId?, tags?, minScore?}), "get_entity" (entityType, entityId).',
      },
    },
    required: ["state", "action"],
  },
  handler(args: {
    state: {
      candidates: Record<string, CandidateSlice>;
      jobs: Record<string, JobSlice>;
      interviews: Record<string, InterviewSlice>;
      offers: Record<string, OfferSlice>;
    };
    action: Action;
  }): { content: Array<{ type: "text"; text: string }> } {
    const { state, action } = args;
    const { candidates = {}, jobs = {}, interviews = {}, offers = {} } = state;

    switch (action.type) {
      case "search": {
        const q = action.query.toLowerCase();
        const limit = action.limit || 20;
        const scope = action.scope || ["candidates", "jobs", "interviews", "offers"];
        const results: Array<{
          entityType: string;
          id: string;
          label: string;
          matchField: string;
          snippet: string;
        }> = [];

        if (scope.includes("candidates")) {
          for (const c of Object.values(candidates)) {
            const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
            if (fullName.includes(q)) {
              results.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "name", snippet: c.email });
            } else if (c.email.toLowerCase().includes(q)) {
              results.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "email", snippet: c.email });
            } else if (c.tags.some((t) => t.toLowerCase().includes(q))) {
              const matched = c.tags.filter((t) => t.toLowerCase().includes(q));
              results.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "tags", snippet: matched.join(", ") });
            } else if (c.notes?.some((n) => n.content.toLowerCase().includes(q))) {
              results.push({ entityType: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}`, matchField: "notes", snippet: "Note contains match" });
            }
          }
        }

        if (scope.includes("jobs")) {
          for (const j of Object.values(jobs)) {
            if (j.title.toLowerCase().includes(q)) {
              results.push({ entityType: "job", id: j.id, label: j.title, matchField: "title", snippet: `${j.department} — ${j.status}` });
            } else if (j.description.toLowerCase().includes(q)) {
              const idx = j.description.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 40);
              const end = Math.min(j.description.length, idx + q.length + 40);
              results.push({ entityType: "job", id: j.id, label: j.title, matchField: "description", snippet: `...${j.description.slice(start, end)}...` });
            } else if (j.department.toLowerCase().includes(q)) {
              results.push({ entityType: "job", id: j.id, label: j.title, matchField: "department", snippet: j.department });
            }
          }
        }

        if (scope.includes("interviews")) {
          for (const i of Object.values(interviews)) {
            if (i.interviewers.some((name) => name.toLowerCase().includes(q))) {
              results.push({ entityType: "interview", id: i.id, label: `Interview (${i.type})`, matchField: "interviewer", snippet: i.interviewers.join(", ") });
            } else if (i.feedback?.notes?.toLowerCase().includes(q)) {
              results.push({ entityType: "interview", id: i.id, label: `Interview (${i.type})`, matchField: "feedback", snippet: "Feedback contains match" });
            }
          }
        }

        if (scope.includes("offers")) {
          for (const o of Object.values(offers)) {
            if (o.status.toLowerCase().includes(q)) {
              results.push({ entityType: "offer", id: o.id, label: `Offer (${o.status})`, matchField: "status", snippet: `$${o.salary?.base || 0} ${o.salary?.currency || ""}` });
            }
          }
        }

        return r({
          ok: true,
          query: action.query,
          total: results.length,
          results: results.slice(0, limit),
          truncated: results.length > limit,
        });
      }

      case "filter_candidates": {
        const { filters } = action;
        let list = Object.values(candidates);

        if (filters.stage) {
          list = list.filter((c) => c.currentStage === filters.stage);
        }
        if (filters.jobId) {
          list = list.filter((c) => c.jobId === filters.jobId);
        }
        if (filters.tags && filters.tags.length > 0) {
          const requiredTags = filters.tags.map((t) => t.toLowerCase());
          list = list.filter((c) =>
            requiredTags.some((rt) =>
              c.tags.some((ct) => ct.toLowerCase().includes(rt))
            )
          );
        }
        if (filters.minScore !== undefined) {
          list = list.filter((c) => {
            const score = (c as Record<string, unknown> & { assessmentResult?: { overallScore?: number } }).assessmentResult?.overallScore;
            return score !== undefined && score >= filters.minScore!;
          });
        }

        return r({
          ok: true,
          filters,
          total: list.length,
          candidates: list.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
            email: c.email,
            stage: c.currentStage,
            jobId: c.jobId,
            tags: c.tags,
          })),
        });
      }

      case "get_entity": {
        const { entityType, entityId } = action;
        let entity: unknown;
        switch (entityType) {
          case "candidate":
            entity = candidates[entityId];
            break;
          case "job":
            entity = jobs[entityId];
            break;
          case "interview":
            entity = interviews[entityId];
            break;
          case "offer":
            entity = offers[entityId];
            break;
        }
        if (!entity) {
          return r({ ok: false, error: `${entityType} ${entityId} not found` });
        }
        return r({ ok: true, entityType, entity });
      }

      default:
        return r({ ok: false, error: `Unknown action type: ${(action as Action).type}` });
    }
  },
};

function r(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
