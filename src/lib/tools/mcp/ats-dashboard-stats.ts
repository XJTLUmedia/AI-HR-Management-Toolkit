/**
 * MCP Tool: ATS Dashboard Stats
 * Computes dashboard statistics and generates a hiring health report from ATS state data.
 */

interface ATSStateSlice {
  candidates: Record<string, { id: string; currentStage: string; jobId: string; createdAt: string; updatedAt: string; tags?: string[] }>;
  jobs: Record<string, { id: string; title: string; status: string; createdAt: string; candidateIds?: string[] }>;
  interviews: Record<string, { id: string; scheduledDate: string; status: string; candidateId: string; jobId: string }>;
  offers: Record<string, { id: string; status: string; candidateId: string; jobId: string; salary?: { base: number; currency: string } }>;
}

export const mcpAtsDashboardStatsTool = {
  name: "ats_dashboard_stats",
  description:
    "Generate comprehensive ATS dashboard statistics and hiring health report. Provide the full ATS state (candidates, jobs, interviews, offers). Returns key metrics, pipeline health, hiring velocity, and actionable insights.",
  inputSchema: {
    type: "object" as const,
    properties: {
      state: {
        type: "object",
        description: "ATS state object with candidates, jobs, interviews, and offers records (each keyed by ID).",
      },
    },
    required: ["state"],
  },

  handler(args: { state: ATSStateSlice }) {
    const { candidates, jobs, interviews, offers } = args.state;

    const candidateList = Object.values(candidates);
    const jobList = Object.values(jobs);
    const interviewList = Object.values(interviews);
    const offerList = Object.values(offers);

    const now = Date.now();

    // Core metrics
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
    const offerAcceptRate = totalOffers > 0 ? Math.round(((acceptedOffers) / Math.max(1, acceptedOffers + (offersByStatus["declined"] || 0))) * 100) : 0;

    // Hiring velocity (avg days from creation to hired)
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
      if (candidatesPerJob[c.jobId]) {
        candidatesPerJob[c.jobId].count++;
      }
    }

    // Top tags
    const tagCounts: Record<string, number> = {};
    for (const c of candidateList) {
      for (const t of c.tags || []) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Insights
    const insights: string[] = [];
    if (openJobs > 0 && totalCandidates === 0) {
      insights.push("You have open jobs but no candidates. Consider promoting job listings.");
    }
    if (pendingOffers > 3) {
      insights.push(`${pendingOffers} offers are pending. Consider following up to close them.`);
    }
    if (avgDaysToHire && avgDaysToHire > 30) {
      insights.push(`Average time-to-hire is ${avgDaysToHire} days. Look for bottlenecks in the pipeline.`);
    }
    if (offerAcceptRate < 50 && totalOffers >= 3) {
      insights.push(`Offer acceptance rate is ${offerAcceptRate}%. Review compensation competitiveness.`);
    }
    const screeningCount = stageDistribution["screening"] || 0;
    if (screeningCount > totalCandidates * 0.4 && totalCandidates >= 5) {
      insights.push(`${screeningCount} candidates stuck in screening (${Math.round(screeningCount / totalCandidates * 100)}%). Speed up screening process.`);
    }

    const result = {
      ok: true,
      summary: {
        totalCandidates,
        totalJobs,
        openJobs,
        totalInterviews,
        upcomingInterviews,
        completedInterviews,
        totalOffers,
        pendingOffers,
        acceptedOffers,
        offerAcceptRate: `${offerAcceptRate}%`,
        avgDaysToHire,
        hiredCount: hiredCandidates.length,
      },
      stageDistribution,
      offersByStatus,
      candidatesPerJob: Object.values(candidatesPerJob),
      topTags,
      insights: insights.length > 0 ? insights : ["All metrics look healthy!"],
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
