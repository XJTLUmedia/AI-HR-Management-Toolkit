/**
 * MCP Tool: ATS Pipeline Analytics
 * Pure-data analytics: stage distribution, conversion rates, velocity, bottleneck detection.
 */

interface CandidateSlice {
  id: string;
  currentStage: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  activities?: Array<{ type: string; timestamp: string; description?: string }>;
}

const DEFAULT_ORDER = ["applied", "screening", "phone-screen", "interview", "final-round", "offer", "hired", "rejected"];

export const mcpAtsPipelineAnalyticsTool = {
  name: "ats_pipeline_analytics",
  description:
    "Analyze the ATS hiring pipeline. Given candidates and optional pipeline stage config, returns stage distribution, conversion rates between stages, average time-in-stage, and bottleneck identification. Useful for hiring funnel analysis.",
  inputSchema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        description: "Array of candidate objects, each with id, currentStage, jobId, createdAt, updatedAt, and optionally activities[].",
      },
      stageOrder: {
        type: "array",
        description: `Ordered array of stage names. Defaults to: ${JSON.stringify(DEFAULT_ORDER)}`,
      },
      jobId: {
        type: "string",
        description: "Optional: filter analytics to a specific job ID.",
      },
    },
    required: ["candidates"],
  },

  handler(args: { candidates: CandidateSlice[]; stageOrder?: string[]; jobId?: string }) {
    const stages = args.stageOrder || DEFAULT_ORDER;
    let candidates = args.candidates;
    if (args.jobId) candidates = candidates.filter((c) => c.jobId === args.jobId);

    const total = candidates.length;
    if (total === 0) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true, total: 0, message: "No candidates to analyze" }, null, 2) }],
      };
    }

    // Distribution
    const distribution: Record<string, number> = {};
    for (const s of stages) distribution[s] = 0;
    for (const c of candidates) {
      distribution[c.currentStage] = (distribution[c.currentStage] || 0) + 1;
    }

    // Conversion rates (stage N → stage N+1)
    const conversionRates: Array<{ from: string; to: string; rate: number; fromCount: number; toCount: number }> = [];
    // Cumulative: how many reached at least stage X
    const reachedStage: Record<string, number> = {};
    for (const c of candidates) {
      const idx = stages.indexOf(c.currentStage);
      for (let i = 0; i <= idx; i++) {
        reachedStage[stages[i]] = (reachedStage[stages[i]] || 0) + 1;
      }
    }
    // Also count stage changes from activities
    for (const c of candidates) {
      if (c.activities) {
        for (const a of c.activities) {
          if (a.type === "stage-change" && a.description) {
            const match = a.description.match(/to (.+?)(?:\s|$|via)/i);
            if (match) {
              const st = match[1].trim();
              const idx = stages.indexOf(st);
              if (idx >= 0) {
                for (let i = 0; i <= idx; i++) {
                  reachedStage[stages[i]] = (reachedStage[stages[i]] || 0);
                }
              }
            }
          }
        }
      }
    }

    for (let i = 0; i < stages.length - 1; i++) {
      const fromCount = reachedStage[stages[i]] || 0;
      const toCount = reachedStage[stages[i + 1]] || 0;
      conversionRates.push({
        from: stages[i],
        to: stages[i + 1],
        rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
        fromCount,
        toCount,
      });
    }

    // Average days in pipeline
    const now = Date.now();
    const daysSums: Record<string, number[]> = {};
    for (const c of candidates) {
      const created = new Date(c.createdAt).getTime();
      const days = Math.max(0, (now - created) / 86400000);
      if (!daysSums[c.currentStage]) daysSums[c.currentStage] = [];
      daysSums[c.currentStage].push(days);
    }
    const avgDaysInStage: Record<string, number> = {};
    for (const [stage, arr] of Object.entries(daysSums)) {
      avgDaysInStage[stage] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    }

    // Bottleneck: stage with highest average days and > 2 candidates
    let bottleneck: { stage: string; avgDays: number; candidateCount: number } | null = null;
    for (const [stage, avg] of Object.entries(avgDaysInStage)) {
      const count = distribution[stage] || 0;
      if (count >= 2 && (!bottleneck || avg > bottleneck.avgDays)) {
        bottleneck = { stage, avgDays: avg, candidateCount: count };
      }
    }

    // Overall funnel
    const hiredCount = distribution["hired"] || 0;
    const overallConversion = total > 0 ? Math.round((hiredCount / total) * 100) : 0;

    const result = {
      ok: true,
      total,
      distribution,
      conversionRates,
      avgDaysInStage,
      bottleneck,
      overallConversion: `${overallConversion}% (${hiredCount}/${total} hired)`,
      summary: `Pipeline has ${total} candidates across ${Object.keys(distribution).filter((k) => distribution[k] > 0).length} active stages.${bottleneck ? ` Bottleneck at "${bottleneck.stage}" stage (${bottleneck.candidateCount} candidates, avg ${bottleneck.avgDays} days).` : " No bottleneck detected."}`,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
