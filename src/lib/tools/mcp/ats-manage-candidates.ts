/**
 * MCP Tool: ats_manage_candidates
 *
 * Unified candidate management: CRUD + pipeline operations + analytics.
 * Merges the former manage_candidates tool (rank, filter, recommend_stage,
 * compare, summarize) into this single entry point.
 *
 * Stateless — accepts current state slice, returns updated state slice.
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
  rating?: number;
  resumeData?: {
    skills?: Array<{ name: string; category?: string; proficiency?: string }>;
    experience?: Array<{ company: string; title: string; startDate?: string; endDate?: string }>;
    education?: Array<{ institution: string; degree?: string; field?: string }>;
  };
  assessmentResult?: {
    overallScore: number;
    decision: string;
    axisResults: Array<{ axisName: string; score: number; maxScore: number }>;
  };
}

interface MoveInput {
  candidateId: string;
  newStage: string;
}

type Action =
  // CRUD / pipeline
  | { type: "add"; candidate: CandidateInput }
  | { type: "update"; candidateId: string; fields: Partial<CandidateInput> }
  | { type: "delete"; candidateId: string }
  | { type: "move"; move: MoveInput }
  | { type: "bulk_move"; moves: MoveInput[] }
  | { type: "list"; jobId?: string; stage?: string }
  // Analytics (merged from manage_candidates)
  | { type: "rank" }
  | { type: "filter" }
  | { type: "recommend_stage" }
  | { type: "compare" }
  | { type: "summarize" };

export const mcpAtsManageCandidatesTool = {
  name: "ats_manage_candidates",
  description:
    `Unified candidate management for the ATS pipeline. Actions:
CRUD: add, update, delete, move, bulk_move, list
Analytics: rank (sort by fit), filter (by criteria), recommend_stage (suggest moves), compare (side-by-side), summarize (overview stats)
Pass the current candidates record and an action. Returns updated state and/or analysis results.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "object",
        description: "Current candidates record (id → candidate object). Pass {} for a fresh start. For analytics actions (rank/filter/compare/summarize/recommend_stage), pass as array or record.",
      },
      action: {
        type: "object",
        description: `Action to perform. Types:
- { type: "add", candidate: { firstName, lastName, email, phone?, jobId, currentStage?, tags?, source? } }
- { type: "update", candidateId: string, fields: { partial candidate fields } }
- { type: "delete", candidateId: string }
- { type: "move", move: { candidateId, newStage } }
- { type: "bulk_move", moves: [{ candidateId, newStage }, ...] }
- { type: "list", jobId?: string, stage?: string }
- { type: "rank" }    — Rank candidates by fit score
- { type: "filter" }  — Filter by criteria
- { type: "recommend_stage" } — Suggest pipeline stage changes
- { type: "compare" } — Side-by-side comparison
- { type: "summarize" } — Aggregate stats`,
      },
      criteria: {
        type: "object",
        description: "For rank/filter: { requiredSkills?: string[], minimumRating?: number, stages?: string[], tags?: string[], sortBy?: 'rating'|'name'|'stage'|'assessment', limit?: number }",
      },
      jobDescription: {
        type: "string",
        description: "Optional job description for relevance ranking (used by 'rank' action).",
      },
    },
    required: ["candidates", "action"],
  },

  handler(args: {
    candidates: Record<string, Record<string, unknown>> | CandidateInput[];
    action: Action;
    criteria?: {
      requiredSkills?: string[];
      minimumRating?: number;
      stages?: string[];
      tags?: string[];
      sortBy?: "rating" | "name" | "stage" | "assessment";
      limit?: number;
    };
    jobDescription?: string;
  }) {
    const { action, criteria, jobDescription } = args;

    // ── Analytics actions operate on candidate array ──
    if (["rank", "filter", "recommend_stage", "compare", "summarize"].includes(action.type)) {
      const candidateArray: CandidateInput[] = Array.isArray(args.candidates)
        ? args.candidates
        : Object.values(args.candidates) as unknown as CandidateInput[];

      switch (action.type) {
        case "rank": return rankCandidates(candidateArray, criteria, jobDescription);
        case "filter": return filterCandidates(candidateArray, criteria);
        case "recommend_stage": return recommendStages(candidateArray);
        case "compare": return compareCandidates(candidateArray);
        case "summarize": return summarizeCandidates(candidateArray);
      }
    }

    // ── CRUD actions operate on candidates record ──
    const candidates = Array.isArray(args.candidates)
      ? Object.fromEntries(args.candidates.map((c) => [c.id, c]))
      : { ...args.candidates };
    const now = new Date().toISOString();

    function genId() {
      return `cand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

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
        } as unknown as Record<string, unknown>;
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

// ── Analytics helpers (ported from manage-candidates.ts) ──────────────────

function rankCandidates(
  candidates: CandidateInput[],
  criteria?: { requiredSkills?: string[]; limit?: number },
  jobDescription?: string,
) {
  const scored = candidates.map((c) => {
    let score = 0;
    if (c.assessmentResult) score += c.assessmentResult.overallScore * 40;
    if (c.rating) score += (c.rating / 5) * 25;
    if (criteria?.requiredSkills && c.resumeData?.skills) {
      const candidateSkills = new Set(c.resumeData.skills.map((s) => s.name.toLowerCase()));
      const matchCount = criteria.requiredSkills.filter((s) => candidateSkills.has(s.toLowerCase())).length;
      score += (matchCount / criteria.requiredSkills.length) * 20;
    }
    if (jobDescription && c.resumeData?.skills) {
      const jdWords = new Set(jobDescription.toLowerCase().split(/\W+/));
      const skillWords = c.resumeData.skills.map((s) => s.name.toLowerCase());
      const overlap = skillWords.filter((w) => jdWords.has(w)).length;
      score += Math.min(overlap * 3, 15);
    }
    return { ...c, _score: Math.round(score * 100) / 100 };
  });

  scored.sort((a, b) => b._score - a._score);
  const limited = criteria?.limit ? scored.slice(0, criteria.limit) : scored;

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "rank", totalCandidates: candidates.length,
        ranked: limited.map((c, i) => ({
          rank: i + 1, id: c.id, name: `${c.firstName} ${c.lastName}`,
          score: c._score, stage: c.currentStage,
          assessment: c.assessmentResult
            ? { overall: c.assessmentResult.overallScore, decision: c.assessmentResult.decision }
            : null,
        })),
      }),
    }],
  };
}

function filterCandidates(
  candidates: CandidateInput[],
  criteria?: { requiredSkills?: string[]; minimumRating?: number; stages?: string[]; tags?: string[]; sortBy?: string; limit?: number },
) {
  let filtered = [...candidates];
  if (criteria?.stages?.length) filtered = filtered.filter((c) => criteria.stages!.includes(c.currentStage ?? ""));
  if (criteria?.tags?.length) {
    const tagSet = new Set(criteria.tags.map((t) => t.toLowerCase()));
    filtered = filtered.filter((c) => (c.tags ?? []).some((t) => tagSet.has(t.toLowerCase())));
  }
  if (criteria?.minimumRating) filtered = filtered.filter((c) => (c.rating ?? 0) >= criteria.minimumRating!);
  if (criteria?.requiredSkills?.length) {
    filtered = filtered.filter((c) => {
      if (!c.resumeData?.skills) return false;
      const skills = new Set(c.resumeData.skills.map((s) => s.name.toLowerCase()));
      return criteria.requiredSkills!.every((s) => skills.has(s.toLowerCase()));
    });
  }
  if (criteria?.sortBy) {
    filtered.sort((a, b) => {
      switch (criteria.sortBy) {
        case "rating": return (b.rating ?? 0) - (a.rating ?? 0);
        case "name": return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case "assessment": return (b.assessmentResult?.overallScore ?? 0) - (a.assessmentResult?.overallScore ?? 0);
        default: return 0;
      }
    });
  }
  if (criteria?.limit) filtered = filtered.slice(0, criteria.limit);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "filter", totalBefore: candidates.length, totalAfter: filtered.length,
        candidates: filtered.map((c) => ({
          id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email,
          stage: c.currentStage, rating: c.rating, tags: c.tags,
        })),
      }),
    }],
  };
}

function recommendStages(candidates: CandidateInput[]) {
  const recommendations = candidates.map((c) => {
    const rec = {
      id: c.id, name: `${c.firstName} ${c.lastName}`,
      currentStage: c.currentStage ?? "applied",
      suggestedStage: c.currentStage ?? "applied",
      reason: "No change recommended",
    };
    if (c.assessmentResult) {
      const { overallScore, decision } = c.assessmentResult;
      if (decision === "reject" && rec.currentStage !== "rejected") {
        rec.suggestedStage = "rejected";
        rec.reason = `Assessment decision: reject (score: ${(overallScore * 100).toFixed(0)}%)`;
      } else if (decision === "pass" && overallScore > 0.8 && ["applied", "screening"].includes(rec.currentStage)) {
        rec.suggestedStage = "phone-screen";
        rec.reason = `Strong assessment score (${(overallScore * 100).toFixed(0)}%) — advance to phone screen`;
      } else if (decision === "review" && rec.currentStage === "applied") {
        rec.suggestedStage = "screening";
        rec.reason = `Assessment suggests review (${(overallScore * 100).toFixed(0)}%) — move to screening`;
      }
    }
    return rec;
  });

  const hasChanges = recommendations.filter((r) => r.suggestedStage !== r.currentStage);
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "recommend_stage", totalCandidates: candidates.length,
        recommendedMoves: hasChanges.length,
        recommendations: hasChanges.length > 0 ? hasChanges : recommendations,
      }),
    }],
  };
}

function compareCandidates(candidates: CandidateInput[]) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "compare",
        candidates: candidates.map((c) => ({
          id: c.id, name: `${c.firstName} ${c.lastName}`, stage: c.currentStage,
          rating: c.rating ?? "N/A",
          skillCount: c.resumeData?.skills?.length ?? 0,
          experienceCount: c.resumeData?.experience?.length ?? 0,
          educationCount: c.resumeData?.education?.length ?? 0,
          assessment: c.assessmentResult
            ? { overall: `${(c.assessmentResult.overallScore * 100).toFixed(0)}%`, decision: c.assessmentResult.decision }
            : "Not assessed",
          topSkills: (c.resumeData?.skills ?? []).slice(0, 5).map((s) => s.name),
          latestRole: c.resumeData?.experience?.[0]
            ? `${c.resumeData.experience[0].title} at ${c.resumeData.experience[0].company}`
            : "N/A",
        })),
      }),
    }],
  };
}

function summarizeCandidates(candidates: CandidateInput[]) {
  const stages: Record<string, number> = {};
  let totalRated = 0, ratingSum = 0, assessed = 0, scoreSum = 0;
  for (const c of candidates) {
    const stage = c.currentStage ?? "unknown";
    stages[stage] = (stages[stage] ?? 0) + 1;
    if (c.rating) { totalRated++; ratingSum += c.rating; }
    if (c.assessmentResult) { assessed++; scoreSum += c.assessmentResult.overallScore; }
  }
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "summarize", total: candidates.length, byStage: stages,
        averageRating: totalRated ? Math.round((ratingSum / totalRated) * 100) / 100 : null,
        assessedCount: assessed,
        averageAssessmentScore: assessed ? `${((scoreSum / assessed) * 100).toFixed(0)}%` : null,
      }),
    }],
  };
}
