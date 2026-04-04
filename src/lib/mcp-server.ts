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
