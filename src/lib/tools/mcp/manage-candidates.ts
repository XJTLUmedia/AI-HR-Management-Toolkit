/**
 * MCP Tool: manage_candidates
 * Pure-function candidate management — ranking, filtering, stage recommendation.
 * No localStorage access; operates on data passed in.
 */

interface CandidateInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: string;
  tags: string[];
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

interface ManageCandidatesArgs {
  action: "rank" | "filter" | "recommend_stage" | "compare" | "summarize";
  candidates: CandidateInput[];
  criteria?: {
    requiredSkills?: string[];
    minimumRating?: number;
    stages?: string[];
    tags?: string[];
    sortBy?: "rating" | "name" | "stage" | "assessment";
    limit?: number;
  };
  jobDescription?: string;
}

export const mcpManageCandidatesTool = {
  name: "manage_candidates",
  description:
    "Manage and analyze candidates: rank by fit, filter by criteria, recommend pipeline stage changes, compare candidates side-by-side, or get a summary. Operates on candidate data passed in — does not access browser storage.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["rank", "filter", "recommend_stage", "compare", "summarize"],
        description:
          "Action: rank (sort by fit), filter (by criteria), recommend_stage (suggest stage moves), compare (side-by-side), summarize (overview stats)",
      },
      candidates: {
        type: "array",
        items: { type: "object" },
        description: "Array of candidate objects with id, firstName, lastName, email, currentStage, tags, resumeData, assessmentResult",
      },
      criteria: {
        type: "object",
        description: "Filter/rank criteria: requiredSkills, minimumRating, stages, tags, sortBy, limit",
      },
      jobDescription: {
        type: "string",
        description: "Optional job description for relevance ranking",
      },
    },
    required: ["action", "candidates"],
  },

  handler(args: ManageCandidatesArgs): { content: Array<{ type: "text"; text: string }> } {
    const { action, candidates, criteria, jobDescription } = args;

    switch (action) {
      case "rank":
        return rankCandidates(candidates, criteria, jobDescription);
      case "filter":
        return filterCandidates(candidates, criteria);
      case "recommend_stage":
        return recommendStages(candidates);
      case "compare":
        return compareCandidates(candidates);
      case "summarize":
        return summarizeCandidates(candidates);
      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${action}` }) }] };
    }
  },
};

function rankCandidates(
  candidates: CandidateInput[],
  criteria?: ManageCandidatesArgs["criteria"],
  jobDescription?: string
) {
  const scored = candidates.map((c) => {
    let score = 0;
    // Assessment score (0-100 weight)
    if (c.assessmentResult) score += c.assessmentResult.overallScore * 40;
    // Rating (0-5 → 0-25 weight)
    if (c.rating) score += (c.rating / 5) * 25;
    // Skill match
    if (criteria?.requiredSkills && c.resumeData?.skills) {
      const candidateSkills = new Set(c.resumeData.skills.map((s) => s.name.toLowerCase()));
      const matchCount = criteria.requiredSkills.filter((s) => candidateSkills.has(s.toLowerCase())).length;
      score += (matchCount / criteria.requiredSkills.length) * 20;
    }
    // Job description keyword overlap
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
        action: "rank",
        totalCandidates: candidates.length,
        ranked: limited.map((c, i) => ({
          rank: i + 1,
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          score: c._score,
          stage: c.currentStage,
          assessment: c.assessmentResult
            ? { overall: c.assessmentResult.overallScore, decision: c.assessmentResult.decision }
            : null,
        })),
      }),
    }],
  };
}

function filterCandidates(candidates: CandidateInput[], criteria?: ManageCandidatesArgs["criteria"]) {
  let filtered = [...candidates];
  if (criteria?.stages?.length) {
    filtered = filtered.filter((c) => criteria.stages!.includes(c.currentStage));
  }
  if (criteria?.tags?.length) {
    const tagSet = new Set(criteria.tags.map((t) => t.toLowerCase()));
    filtered = filtered.filter((c) => c.tags.some((t) => tagSet.has(t.toLowerCase())));
  }
  if (criteria?.minimumRating) {
    filtered = filtered.filter((c) => (c.rating ?? 0) >= criteria.minimumRating!);
  }
  if (criteria?.requiredSkills?.length && criteria.requiredSkills.length > 0) {
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

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "filter",
        totalBefore: candidates.length,
        totalAfter: filtered.length,
        candidates: filtered.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          stage: c.currentStage,
          rating: c.rating,
          tags: c.tags,
        })),
      }),
    }],
  };
}

function recommendStages(candidates: CandidateInput[]) {
  const recommendations = candidates.map((c) => {
    const rec: { id: string; name: string; currentStage: string; suggestedStage: string; reason: string } = {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      currentStage: c.currentStage,
      suggestedStage: c.currentStage,
      reason: "No change recommended",
    };

    if (c.assessmentResult) {
      const { overallScore, decision } = c.assessmentResult;
      if (decision === "reject" && c.currentStage !== "rejected") {
        rec.suggestedStage = "rejected";
        rec.reason = `Assessment decision: reject (score: ${(overallScore * 100).toFixed(0)}%)`;
      } else if (decision === "pass" && overallScore > 0.8 && ["applied", "screening"].includes(c.currentStage)) {
        rec.suggestedStage = "phone-screen";
        rec.reason = `Strong assessment score (${(overallScore * 100).toFixed(0)}%) — advance to phone screen`;
      } else if (decision === "review" && c.currentStage === "applied") {
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
        action: "recommend_stage",
        totalCandidates: candidates.length,
        recommendedMoves: hasChanges.length,
        recommendations: hasChanges.length > 0 ? hasChanges : recommendations,
      }),
    }],
  };
}

function compareCandidates(candidates: CandidateInput[]) {
  const comparison = candidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    stage: c.currentStage,
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
  }));

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ action: "compare", candidates: comparison }),
    }],
  };
}

function summarizeCandidates(candidates: CandidateInput[]) {
  const stages: Record<string, number> = {};
  let totalRated = 0;
  let ratingSum = 0;
  let assessed = 0;
  let scoreSum = 0;

  for (const c of candidates) {
    stages[c.currentStage] = (stages[c.currentStage] ?? 0) + 1;
    if (c.rating) { totalRated++; ratingSum += c.rating; }
    if (c.assessmentResult) { assessed++; scoreSum += c.assessmentResult.overallScore; }
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        action: "summarize",
        total: candidates.length,
        byStage: stages,
        averageRating: totalRated ? Math.round((ratingSum / totalRated) * 100) / 100 : null,
        assessedCount: assessed,
        averageAssessmentScore: assessed ? `${((scoreSum / assessed) * 100).toFixed(0)}%` : null,
      }),
    }],
  };
}
