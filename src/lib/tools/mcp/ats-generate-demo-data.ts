/**
 * MCP Tool: ATS Generate Demo Data
 * Generates realistic demo ATS state data for testing and demonstration purposes.
 * Returns a full ATSState object with jobs, candidates, interviews, and offers.
 */

import { generateDemoData } from "@/lib/ats/demo-data";

export const mcpAtsGenerateDemoDataTool = {
  name: "ats_generate_demo_data",
  description:
    "Generate a full set of realistic demo data for the ATS (Applicant Tracking System). Returns a complete ATSState with sample jobs, candidates at various pipeline stages, scheduled interviews, and offers. Useful for testing, demonstrations, or populating an empty ATS instance.",
  inputSchema: {
    type: "object" as const,
    properties: {
      includeStats: {
        type: "boolean",
        description:
          "If true, include summary statistics alongside the generated data. Default: false.",
      },
    },
    required: [] as string[],
  },

  handler(args: { includeStats?: boolean }) {
    const demoState = generateDemoData();

    const candidateList = Object.values(demoState.candidates);
    const jobList = Object.values(demoState.jobs);
    const interviewList = Object.values(demoState.interviews);
    const offerList = Object.values(demoState.offers);

    const summary = {
      totalJobs: jobList.length,
      totalCandidates: candidateList.length,
      totalInterviews: interviewList.length,
      totalOffers: offerList.length,
      jobTitles: jobList.map((j) => j.title),
      stageDistribution: candidateList.reduce(
        (acc, c) => {
          acc[c.currentStage] = (acc[c.currentStage] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    if (args.includeStats) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ summary, state: demoState }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary,
              state: demoState,
              instructions:
                "Use the IMPORT_STATE action with this state object to load demo data into the ATS. The state includes candidates, jobs, interviews, offers, and default pipeline settings.",
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
