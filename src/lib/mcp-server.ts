import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { parseResumeTool, inspectPipelineTool, exportResultsTool, sendEmailTool } from "@/lib/tools";
import {
  mcpExtractKeywordsTool,
  mcpDetectPatternsTool,
  mcpComputeSimilarityTool,
  mcpBatchParseTool,
  mcpAssessCandidateTool,
  mcpManageCandidatesTool,
  mcpClassifyEntitiesTool,
  mcpExtractSkillsStructuredTool,
  mcpExtractExperienceStructuredTool,
  mcpAnalyzeResumeComprehensiveTool,
  mcpAtsManageCandidatesTool,
  mcpAtsPipelineAnalyticsTool,
  mcpAtsScheduleInterviewTool,
  mcpAtsManageOffersTool,
  mcpAtsDashboardStatsTool,
  mcpAtsGenerateDemoDataTool,
  mcpAtsManageJobsTool,
  mcpAtsManageNotesTool,
  mcpAtsInterviewFeedbackTool,
  mcpAtsSearchTool,
} from "@/lib/tools/mcp";

// MCP ToolAnnotations per tool — readOnlyHint, destructiveHint, idempotentHint, openWorldHint
const TOOL_ANNOTATIONS: Record<string, {
  title: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}> = {
  parse_resume:                   { title: "Parse Resume",                      readOnlyHint: true,  openWorldHint: false },
  inspect_pipeline:               { title: "Inspect Pipeline",                  readOnlyHint: true,  openWorldHint: false },
  extract_keywords:               { title: "Extract Keywords",                  readOnlyHint: true,  openWorldHint: false },
  detect_patterns:                { title: "Detect Patterns",                   readOnlyHint: true,  openWorldHint: false },
  compute_similarity:             { title: "Compute Similarity",                readOnlyHint: true,  openWorldHint: false },
  classify_entities:              { title: "Classify Entities",                 readOnlyHint: true,  openWorldHint: false },
  extract_skills_structured:      { title: "Extract Skills (Structured)",       readOnlyHint: true,  openWorldHint: false },
  extract_experience_structured:  { title: "Extract Experience (Structured)",   readOnlyHint: true,  openWorldHint: false },
  analyze_resume_comprehensive:   { title: "Analyze Resume (Comprehensive)",    readOnlyHint: true,  openWorldHint: true  },
  batch_parse_resumes:            { title: "Batch Parse Resumes",               readOnlyHint: true,  openWorldHint: false },
  export_results:                 { title: "Export Results",                    readOnlyHint: true,  openWorldHint: false },
  send_email:                     { title: "Send Email",                        readOnlyHint: false, destructiveHint: false, openWorldHint: true  },
  assess_candidate:               { title: "Assess Candidate",                  readOnlyHint: true,  openWorldHint: true  },
  manage_candidates:              { title: "Manage Candidates",                 readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_manage_candidates:          { title: "ATS: Manage Candidates",            readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_pipeline_analytics:         { title: "ATS: Pipeline Analytics",           readOnlyHint: true,  openWorldHint: false },
  ats_schedule_interview:         { title: "ATS: Schedule Interview",           readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_manage_offers:              { title: "ATS: Manage Offers",                readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_dashboard_stats:            { title: "ATS: Dashboard Stats",              readOnlyHint: true,  openWorldHint: false },
  ats_generate_demo_data:         { title: "ATS: Generate Demo Data",           readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_manage_jobs:                { title: "ATS: Manage Jobs",                  readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_manage_notes:               { title: "ATS: Manage Notes",                 readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_interview_feedback:         { title: "ATS: Interview Feedback",           readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_search:                     { title: "ATS: Search",                       readOnlyHint: true,  openWorldHint: false },
};

// All tools in registration order — each has { name, description, inputSchema, handler }
const allTools = [
  parseResumeTool,
  inspectPipelineTool,
  mcpExtractKeywordsTool,
  mcpDetectPatternsTool,
  mcpComputeSimilarityTool,
  mcpClassifyEntitiesTool,
  mcpExtractSkillsStructuredTool,
  mcpExtractExperienceStructuredTool,
  mcpAnalyzeResumeComprehensiveTool,
  mcpBatchParseTool,
  exportResultsTool,
  sendEmailTool,
  mcpAssessCandidateTool,
  mcpManageCandidatesTool,
  mcpAtsManageCandidatesTool,
  mcpAtsPipelineAnalyticsTool,
  mcpAtsScheduleInterviewTool,
  mcpAtsManageOffersTool,
  mcpAtsDashboardStatsTool,
  mcpAtsGenerateDemoDataTool,
  mcpAtsManageJobsTool,
  mcpAtsManageNotesTool,
  mcpAtsInterviewFeedbackTool,
  mcpAtsSearchTool,
];

export function createResumeParserMcpServer(): Server {
  const server = new Server(
    { name: "resume-parser", version: "3.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: TOOL_ANNOTATIONS[t.name],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = allTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tool.handler(args as any);
  });

  return server;
}
