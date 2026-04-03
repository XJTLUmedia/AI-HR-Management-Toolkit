/**
 * MCP Tool: ATS Manage Candidates
 * Stateless CRUD + pipeline operations on candidate data.
 * Accepts current state slice, returns updated state slice.
 */

interface CandidateInput {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobId: string;
  currentStage?: string;
  tags?: string[];
  source?: string;
}

interface MoveInput {
  candidateId: string;
  newStage: string;
}

type Action =
  | { type: "add"; candidate: CandidateInput }
  | { type: "update"; candidateId: string; fields: Partial<CandidateInput> }
  | { type: "delete"; candidateId: string }
  | { type: "move"; move: MoveInput }
  | { type: "bulk_move"; moves: MoveInput[] }
  | { type: "list"; jobId?: string; stage?: string };

export const mcpAtsManageCandidatesTool = {
  name: "ats_manage_candidates",
  description:
    "Manage candidates in the ATS pipeline. Supports add, update, delete, move between stages, bulk move, and list/filter operations. Pass the current candidates record and an action to perform. Returns the updated candidates and a summary.",
  inputSchema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "object",
        description: "Current candidates record (id → candidate object). Pass {} for a fresh start.",
      },
      action: {
        type: "object",
        description: `Action to perform. Types:
- { type: "add", candidate: { firstName, lastName, email, phone?, jobId, currentStage?, tags?, source? } }
- { type: "update", candidateId: string, fields: { partial candidate fields } }
- { type: "delete", candidateId: string }
- { type: "move", move: { candidateId, newStage } }
- { type: "bulk_move", moves: [{ candidateId, newStage }, ...] }
- { type: "list", jobId?: string, stage?: string }`,
      },
    },
    required: ["candidates", "action"],
  },

  handler(args: {
    candidates: Record<string, Record<string, unknown>>;
    action: Action;
  }) {
    const candidates = { ...args.candidates };
    const now = new Date().toISOString();

    function genId() {
      return `cand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    const { action } = args;

    switch (action.type) {
      case "add": {
        const id = action.candidate.id || genId();
        candidates[id] = {
          id,
          firstName: action.candidate.firstName,
          lastName: action.candidate.lastName,
          email: action.candidate.email,
          phone: action.candidate.phone || "",
          jobId: action.candidate.jobId,
          currentStage: action.candidate.currentStage || "applied",
          tags: action.candidate.tags || [],
          source: action.candidate.source || "mcp",
          notes: [],
          activities: [{ id: `act_${Date.now()}`, type: "stage-change", description: "Candidate added via MCP", timestamp: now }],
          createdAt: now,
          updatedAt: now,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "add", candidateId: id, candidates }, null, 2) }],
        };
      }

      case "update": {
        const c = candidates[action.candidateId];
        if (!c) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Candidate ${action.candidateId} not found` }) }] };
        }
        Object.assign(c, action.fields, { updatedAt: now });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "update", candidateId: action.candidateId, candidate: c }, null, 2) }],
        };
      }

      case "delete": {
        if (!candidates[action.candidateId]) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Candidate ${action.candidateId} not found` }) }] };
        }
        delete candidates[action.candidateId];
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "delete", candidateId: action.candidateId }, null, 2) }],
        };
      }

      case "move": {
        const c = candidates[action.move.candidateId];
        if (!c) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Candidate ${action.move.candidateId} not found` }) }] };
        }
        const oldStage = c.currentStage;
        c.currentStage = action.move.newStage;
        c.updatedAt = now;
        const acts = (c.activities as Array<Record<string, unknown>>) || [];
        acts.push({ id: `act_${Date.now()}`, type: "stage-change", description: `Moved from ${oldStage} to ${action.move.newStage} via MCP`, timestamp: now });
        c.activities = acts;
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "move", candidateId: action.move.candidateId, from: oldStage, to: action.move.newStage }, null, 2) }],
        };
      }

      case "bulk_move": {
        const results = action.moves.map((m) => {
          const c = candidates[m.candidateId];
          if (!c) return { candidateId: m.candidateId, ok: false, error: "not found" };
          const oldStage = c.currentStage;
          c.currentStage = m.newStage;
          c.updatedAt = now;
          return { candidateId: m.candidateId, ok: true, from: oldStage, to: m.newStage };
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "bulk_move", results, candidates }, null, 2) }],
        };
      }

      case "list": {
        let list = Object.values(candidates);
        if (action.jobId) list = list.filter((c) => (c as Record<string, unknown>).jobId === action.jobId);
        if (action.stage) list = list.filter((c) => (c as Record<string, unknown>).currentStage === action.stage);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "list", count: list.length, candidates: list }, null, 2) }],
        };
      }

      default:
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Unknown action type" }) }] };
    }
  },
};
