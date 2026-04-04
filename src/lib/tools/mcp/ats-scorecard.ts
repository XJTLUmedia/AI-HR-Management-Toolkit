/**
 * MCP Tool: ats_scorecard
 *
 * Structured interview scorecards — create evaluation templates,
 * fill scorecards, aggregate scores, and ensure consistent hiring decisions.
 */

interface ScorecardCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 0–1
}

interface ScorecardTemplate {
  id: string;
  name: string;
  jobId?: string;
  interviewType?: string;
  criteria: ScorecardCriterion[];
  createdAt: string;
}

interface ScorecardRating {
  criterionId: string;
  score: number; // 1–5
  comment?: string;
}

interface ScorecardEntry {
  id: string;
  templateId: string;
  candidateId: string;
  interviewId?: string;
  evaluator: string;
  ratings: ScorecardRating[];
  overallRecommendation: "strong_yes" | "yes" | "neutral" | "no" | "strong_no";
  notes: string;
  submittedAt: string;
}

type Action =
  | {
      type: "create_template";
      name: string;
      criteria: { name: string; description: string; weight: number }[];
      jobId?: string;
      interviewType?: string;
    }
  | { type: "list_templates"; jobId?: string }
  | { type: "get_template"; templateId: string }
  | { type: "delete_template"; templateId: string }
  | {
      type: "fill";
      templateId: string;
      candidateId: string;
      evaluator: string;
      ratings: { criterionId: string; score: number; comment?: string }[];
      overallRecommendation: string;
      notes?: string;
      interviewId?: string;
    }
  | { type: "get_entry"; entryId: string }
  | { type: "get_candidate_scores"; candidateId: string; templateId?: string }
  | { type: "aggregate"; candidateId?: string; jobId?: string; templateId?: string }
  | { type: "delete_entry"; entryId: string };

interface StateSlice {
  scorecardTemplates: Record<string, ScorecardTemplate>;
  scorecardEntries: Record<string, ScorecardEntry>;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function handleAction(input: { action: Action; state: StateSlice }) {
  const { action, state } = input;
  const templates = state.scorecardTemplates ?? {};
  const entries = state.scorecardEntries ?? {};

  switch (action.type) {
    case "create_template": {
      const id = genId("tmpl");
      const totalWeight = action.criteria.reduce((s, c) => s + c.weight, 0);
      if (Math.abs(totalWeight - 1) > 0.01) {
        return err(`Criteria weights must sum to 1.0; got ${totalWeight.toFixed(3)}`);
      }
      const template: ScorecardTemplate = {
        id,
        name: action.name,
        jobId: action.jobId,
        interviewType: action.interviewType,
        criteria: action.criteria.map((c) => ({
          id: genId("crit"),
          name: c.name,
          description: c.description,
          weight: c.weight,
        })),
        createdAt: new Date().toISOString(),
      };
      return ok({
        created: true,
        template,
        _storeOp: "upsert_scorecard_template",
        _entity: template,
      });
    }

    case "list_templates": {
      let list = Object.values(templates);
      if (action.jobId) list = list.filter((t) => t.jobId === action.jobId);
      return ok({
        templates: list.map((t) => ({
          id: t.id,
          name: t.name,
          jobId: t.jobId,
          interviewType: t.interviewType,
          criteriaCount: t.criteria.length,
          createdAt: t.createdAt,
        })),
        total: list.length,
      });
    }

    case "get_template": {
      const t = templates[action.templateId];
      if (!t) return err("Template not found");
      return ok({ template: t });
    }

    case "delete_template": {
      if (!templates[action.templateId]) return err("Template not found");
      return ok({
        deleted: true,
        templateId: action.templateId,
        _storeOp: "delete_scorecard_template",
        _entity: { id: action.templateId },
      });
    }

    case "fill": {
      const tmpl = templates[action.templateId];
      if (!tmpl) return err("Template not found");
      const validCritIds = new Set(tmpl.criteria.map((c) => c.id));
      for (const r of action.ratings) {
        if (!validCritIds.has(r.criterionId))
          return err(`Unknown criterion ${r.criterionId}`);
        if (r.score < 1 || r.score > 5)
          return err(`Score must be 1-5; got ${r.score} for ${r.criterionId}`);
      }
      const id = genId("sc");
      const entry: ScorecardEntry = {
        id,
        templateId: action.templateId,
        candidateId: action.candidateId,
        interviewId: action.interviewId,
        evaluator: action.evaluator,
        ratings: action.ratings,
        overallRecommendation: action.overallRecommendation as ScorecardEntry["overallRecommendation"],
        notes: action.notes ?? "",
        submittedAt: new Date().toISOString(),
      };
      // Compute weighted score
      let weightedScore = 0;
      for (const r of entry.ratings) {
        const crit = tmpl.criteria.find((c) => c.id === r.criterionId);
        if (crit) weightedScore += r.score * crit.weight;
      }
      return ok({
        submitted: true,
        entry,
        weightedScore: Math.round(weightedScore * 100) / 100,
        _storeOp: "upsert_scorecard_entry",
        _entity: entry,
      });
    }

    case "get_entry": {
      const e = entries[action.entryId];
      if (!e) return err("Entry not found");
      return ok({ entry: e });
    }

    case "get_candidate_scores": {
      let candidateEntries = Object.values(entries).filter(
        (e) => e.candidateId === action.candidateId
      );
      if (action.templateId)
        candidateEntries = candidateEntries.filter(
          (e) => e.templateId === action.templateId
        );

      const scored = candidateEntries.map((e) => {
        const tmpl = templates[e.templateId];
        let weightedScore = 0;
        if (tmpl) {
          for (const r of e.ratings) {
            const crit = tmpl.criteria.find((c) => c.id === r.criterionId);
            if (crit) weightedScore += r.score * crit.weight;
          }
        }
        return {
          entryId: e.id,
          templateName: tmpl?.name ?? e.templateId,
          evaluator: e.evaluator,
          weightedScore: Math.round(weightedScore * 100) / 100,
          recommendation: e.overallRecommendation,
          submittedAt: e.submittedAt,
        };
      });
      return ok({ candidateId: action.candidateId, scorecards: scored, total: scored.length });
    }

    case "aggregate": {
      let filteredEntries = Object.values(entries);
      if (action.candidateId)
        filteredEntries = filteredEntries.filter((e) => e.candidateId === action.candidateId);
      if (action.templateId)
        filteredEntries = filteredEntries.filter((e) => e.templateId === action.templateId);
      if (action.jobId)
        filteredEntries = filteredEntries.filter((e) => {
          const tmpl = templates[e.templateId];
          return tmpl?.jobId === action.jobId;
        });

      if (filteredEntries.length === 0) return ok({ aggregate: null, message: "No scorecards match" });

      // Group by candidate
      const byCandidate: Record<string, typeof filteredEntries> = {};
      for (const e of filteredEntries) {
        (byCandidate[e.candidateId] ??= []).push(e);
      }

      const ranking = Object.entries(byCandidate).map(([candidateId, ces]) => {
        const scores = ces.map((e) => {
          const tmpl = templates[e.templateId];
          let ws = 0;
          if (tmpl)
            for (const r of e.ratings) {
              const crit = tmpl.criteria.find((c) => c.id === r.criterionId);
              if (crit) ws += r.score * crit.weight;
            }
          return ws;
        });
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const recMap = { strong_yes: 5, yes: 4, neutral: 3, no: 2, strong_no: 1 };
        const avgRec =
          ces.reduce((a, e) => a + (recMap[e.overallRecommendation] ?? 3), 0) / ces.length;
        return {
          candidateId,
          evaluationCount: ces.length,
          avgWeightedScore: Math.round(avg * 100) / 100,
          avgRecommendation: Math.round(avgRec * 100) / 100,
          evaluators: [...new Set(ces.map((e) => e.evaluator))],
        };
      });

      ranking.sort((a, b) => b.avgWeightedScore - a.avgWeightedScore);
      return ok({ ranking, totalCandidates: ranking.length, totalScorecards: filteredEntries.length });
    }

    case "delete_entry": {
      if (!entries[action.entryId]) return err("Entry not found");
      return ok({
        deleted: true,
        entryId: action.entryId,
        _storeOp: "delete_scorecard_entry",
        _entity: { id: action.entryId },
      });
    }

    default:
      return err(`Unknown action: ${(action as { type: string }).type}`);
  }
}

export const mcpAtsScorecardTool = {
  name: "ats_scorecard",
  description:
    "Structured interview scorecards — create evaluation templates with weighted criteria, " +
    "fill scorecards per candidate/evaluator, aggregate scores to rank candidates, ensure " +
    "consistent hiring decisions. Actions: create_template, list_templates, get_template, " +
    "delete_template, fill, get_entry, get_candidate_scores, aggregate, delete_entry.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object" as const,
        description:
          'Action to perform. Set "type" to one of: create_template, list_templates, ' +
          "get_template, delete_template, fill, get_entry, get_candidate_scores, aggregate, delete_entry.",
      },
      state: {
        type: "object" as const,
        description: "Current ATS state containing scorecardTemplates and scorecardEntries.",
      },
    },
    required: ["action", "state"],
  },
  handler: (args: { action: Action; state: StateSlice }) => handleAction(args),
};
