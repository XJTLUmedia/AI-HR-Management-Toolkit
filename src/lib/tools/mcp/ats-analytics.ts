/**
 * MCP Tool: ats_analytics
 *
 * Unified ATS analytics tool. Merges two previously separate tools:
 *   - ats_dashboard_stats   → report_type: "dashboard"
 *   - ats_pipeline_analytics → report_type: "pipeline"
 *   - both                   → report_type: "full"
 */

interface ATSStateSlice {
  candidates: Record<string, { id: string; currentStage: string; jobId: string; createdAt: string; updatedAt: string; tags?: string[]; activities?: Array<{ type: string; timestamp: string; description?: string }> }>;
  jobs: Record<string, { id: string; title: string; status: string; createdAt: string; candidateIds?: string[] }>;
  interviews: Record<string, { id: string; scheduledDate: string; status: string; candidateId: string; jobId: string }>;
  offers: Record<string, { id: string; status: string; candidateId: string; jobId: string; salary?: { base: number; currency: string } }>;
}

const DEFAULT_STAGE_ORDER = ["applied", "screening", "phone-screen", "interview", "final-round", "offer", "hired", "rejected"];

// ── Dashboard logic ───────────────────────────────────────────────────────

function computeDashboard(state: ATSStateSlice) {
  const { candidates, jobs, interviews, offers } = state;
  const candidateList = Object.values(candidates);
  const jobList = Object.values(jobs);
  const interviewList = Object.values(interviews);
  const offerList = Object.values(offers);
  const now = Date.now();

  const totalCandidates = candidateList.length;
  const totalJobs = jobList.length;
  const openJobs = jobList.filter((j) => j.status === "open" || j.status === "active").length;
  const totalInterviews = interviewList.length;
  const totalOffers = offerList.length;

  // Pipeline distribution
  const stageDistribution: Record<string, number> = {};
  for (const c of candidateList) {
    stageDistribution[c.currentStage] = (stageDistribution[c.currentStage] || 0) + 1;
  }

  // Interview stats
  const upcomingInterviews = interviewList.filter((i) => i.status === "scheduled" && new Date(i.scheduledDate).getTime() > now).length;
  const completedInterviews = interviewList.filter((i) => i.status === "completed").length;

  // Offer stats
  const offersByStatus: Record<string, number> = {};
  for (const o of offerList) {
    offersByStatus[o.status] = (offersByStatus[o.status] || 0) + 1;
  }
  const acceptedOffers = offersByStatus["accepted"] || 0;
  const pendingOffers = (offersByStatus["sent"] || 0) + (offersByStatus["pending-approval"] || 0) + (offersByStatus["approved"] || 0);
  const declinedOffers = offersByStatus["declined"] || 0;
  const offerAcceptRate = totalOffers > 0 ? Math.round((acceptedOffers / Math.max(1, acceptedOffers + declinedOffers)) * 100) : 0;

  // Hiring velocity
  const hiredCandidates = candidateList.filter((c) => c.currentStage === "hired");
  let avgDaysToHire: number | null = null;
  if (hiredCandidates.length > 0) {
    const totalDays = hiredCandidates.reduce((sum, c) => {
      return sum + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000;
    }, 0);
    avgDaysToHire = Math.round((totalDays / hiredCandidates.length) * 10) / 10;
  }

  // Candidates per job
  const candidatesPerJob: Record<string, { jobTitle: string; count: number }> = {};
  for (const j of jobList) {
    candidatesPerJob[j.id] = { jobTitle: j.title, count: 0 };
  }
  for (const c of candidateList) {
    if (candidatesPerJob[c.jobId]) candidatesPerJob[c.jobId].count++;
  }

  // Top tags
  const tagCounts: Record<string, number> = {};
  for (const c of candidateList) {
    for (const t of c.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));

  // Insights
  const insights: string[] = [];
  if (openJobs > 0 && totalCandidates === 0) insights.push("You have open jobs but no candidates. Consider promoting job listings.");
  if (pendingOffers > 3) insights.push(`${pendingOffers} offers are pending. Consider following up to close them.`);
  if (avgDaysToHire && avgDaysToHire > 30) insights.push(`Average time-to-hire is ${avgDaysToHire} days. Look for bottlenecks in the pipeline.`);
  if (offerAcceptRate < 50 && totalOffers >= 3) insights.push(`Offer acceptance rate is ${offerAcceptRate}%. Review compensation competitiveness.`);
  const screeningCount = stageDistribution["screening"] || 0;
  if (screeningCount > totalCandidates * 0.4 && totalCandidates >= 5) {
    insights.push(`${screeningCount} candidates stuck in screening (${Math.round(screeningCount / totalCandidates * 100)}%). Speed up screening process.`);
  }

  return {
    summary: {
      totalCandidates, totalJobs, openJobs, totalInterviews,
      upcomingInterviews, completedInterviews, totalOffers,
      pendingOffers, acceptedOffers, offerAcceptRate: `${offerAcceptRate}%`,
      avgDaysToHire, hiredCount: hiredCandidates.length,
    },
    stageDistribution,
    offersByStatus,
    candidatesPerJob: Object.values(candidatesPerJob),
    topTags,
    insights: insights.length > 0 ? insights : ["All metrics look healthy!"],
  };
}

// ── Pipeline analytics logic ──────────────────────────────────────────────

function computePipeline(
  candidates: Array<{ id: string; currentStage: string; jobId: string; createdAt: string; updatedAt: string; activities?: Array<{ type: string; timestamp: string; description?: string }> }>,
  stageOrder: string[],
  jobId?: string,
) {
  if (jobId) candidates = candidates.filter((c) => c.jobId === jobId);
  const total = candidates.length;
  if (total === 0) return { total: 0, message: "No candidates to analyze" };

  // Distribution
  const distribution: Record<string, number> = {};
  for (const s of stageOrder) distribution[s] = 0;
  for (const c of candidates) distribution[c.currentStage] = (distribution[c.currentStage] || 0) + 1;

  // Cumulative reach
  const reachedStage: Record<string, number> = {};
  for (const c of candidates) {
    const idx = stageOrder.indexOf(c.currentStage);
    for (let i = 0; i <= idx; i++) reachedStage[stageOrder[i]] = (reachedStage[stageOrder[i]] || 0) + 1;
  }
  for (const c of candidates) {
    if (c.activities) {
      for (const a of c.activities) {
        if (a.type === "stage-change" && a.description) {
          const match = a.description.match(/to (.+?)(?:\s|$|via)/i);
          if (match) {
            const st = match[1].trim();
            const idx = stageOrder.indexOf(st);
            if (idx >= 0) {
              for (let i = 0; i <= idx; i++) reachedStage[stageOrder[i]] = reachedStage[stageOrder[i]] || 0;
            }
          }
        }
      }
    }
  }

  // Conversion rates
  const conversionRates: Array<{ from: string; to: string; rate: number; fromCount: number; toCount: number }> = [];
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const fromCount = reachedStage[stageOrder[i]] || 0;
    const toCount = reachedStage[stageOrder[i + 1]] || 0;
    conversionRates.push({
      from: stageOrder[i], to: stageOrder[i + 1],
      rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
      fromCount, toCount,
    });
  }

  // Average days in stage
  const now = Date.now();
  const daysSums: Record<string, number[]> = {};
  for (const c of candidates) {
    const days = Math.max(0, (now - new Date(c.createdAt).getTime()) / 86400000);
    if (!daysSums[c.currentStage]) daysSums[c.currentStage] = [];
    daysSums[c.currentStage].push(days);
  }
  const avgDaysInStage: Record<string, number> = {};
  for (const [stage, arr] of Object.entries(daysSums)) {
    avgDaysInStage[stage] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  }

  // Bottleneck
  let bottleneck: { stage: string; avgDays: number; candidateCount: number } | null = null;
  for (const [stage, avg] of Object.entries(avgDaysInStage)) {
    const count = distribution[stage] || 0;
    if (count >= 2 && (!bottleneck || avg > bottleneck.avgDays)) {
      bottleneck = { stage, avgDays: avg, candidateCount: count };
    }
  }

  const hiredCount = distribution["hired"] || 0;
  const overallConversion = total > 0 ? Math.round((hiredCount / total) * 100) : 0;

  return {
    total, distribution, conversionRates, avgDaysInStage, bottleneck,
    overallConversion: `${overallConversion}% (${hiredCount}/${total} hired)`,
    summary: `Pipeline has ${total} candidates across ${Object.keys(distribution).filter((k) => distribution[k] > 0).length} active stages.${bottleneck ? ` Bottleneck at "${bottleneck.stage}" stage (${bottleneck.candidateCount} candidates, avg ${bottleneck.avgDays} days).` : " No bottleneck detected."}`,
  };
}

// ── Tool export ───────────────────────────────────────────────────────────

export const mcpAtsAnalyticsTool = {
  name: "ats_analytics",
  description:
    `Unified ATS analytics. Select report type:
- "dashboard" — Hiring health report: key metrics, stage distribution, offer stats, velocity, insights
- "pipeline"  — Funnel analysis: conversion rates, avg days-in-stage, bottleneck detection
- "full"      — Both reports combined`,
  inputSchema: {
    type: "object" as const,
    properties: {
      report_type: {
        type: "string",
        enum: ["dashboard", "pipeline", "full"],
        description: 'Which report to generate. Defaults to "full".',
      },
      state: {
        type: "object",
        description: "ATS state object with candidates, jobs, interviews, and offers records (each keyed by ID). Required for 'dashboard' and 'full' reports.",
      },
      candidates: {
        type: "array",
        description: "Array of candidate objects. Required for 'pipeline' report. For 'full'/'dashboard', candidates come from state.",
      },
      stageOrder: {
        type: "array",
        description: `Ordered pipeline stages for funnel analysis. Defaults to: ${JSON.stringify(DEFAULT_STAGE_ORDER)}`,
      },
      jobId: {
        type: "string",
        description: "Optional: filter pipeline analytics to a specific job.",
      },
    },
    required: [],
  },

  handler(args: {
    report_type?: "dashboard" | "pipeline" | "full";
    state?: ATSStateSlice;
    candidates?: Array<{ id: string; currentStage: string; jobId: string; createdAt: string; updatedAt: string; activities?: Array<{ type: string; timestamp: string; description?: string }> }>;
    stageOrder?: string[];
    jobId?: string;
  }) {
    const reportType = args.report_type || "full";
    const result: Record<string, unknown> = { ok: true, reportType };

    if (reportType === "dashboard" || reportType === "full") {
      if (!args.state) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "'state' is required for dashboard report" }) }] };
      }
      result.dashboard = computeDashboard(args.state);
    }

    if (reportType === "pipeline" || reportType === "full") {
      // For 'full', derive candidates array from state if not explicitly provided
      const candidateArray = args.candidates ?? (args.state ? Object.values(args.state.candidates) : undefined);
      if (!candidateArray) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "'candidates' array or 'state' is required for pipeline report" }) }] };
      }
      result.pipeline = computePipeline(candidateArray, args.stageOrder || DEFAULT_STAGE_ORDER, args.jobId);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
