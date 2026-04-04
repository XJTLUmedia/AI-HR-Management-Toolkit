import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { parseResumeTool, inspectPipelineTool, exportResultsTool, sendEmailTool } from "@/lib/tools";
import {
  mcpAnalyzeResumeTool,
  mcpBatchParseTool,
  mcpAssessCandidateTool,
  mcpAtsManageCandidatesTool,
  mcpAtsAnalyticsTool,
  mcpAtsScheduleInterviewTool,
  mcpAtsManageOffersTool,
  mcpAtsGenerateDemoDataTool,
  mcpAtsManageJobsTool,
  mcpAtsManageNotesTool,
  mcpAtsInterviewFeedbackTool,
  mcpAtsSearchTool,
  mcpAtsComplianceTool,
  mcpAtsTalentPoolTool,
  mcpAtsScorecardTool,
  mcpAtsOnboardingTool,
  mcpAtsCommunicationTool,
} from "@/lib/tools/mcp";

// MCP ToolAnnotations per tool — readOnlyHint, destructiveHint, idempotentHint, openWorldHint
const TOOL_ANNOTATIONS: Record<string, {
  title: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}> = {
  parse_resume:          { title: "Parse Resume",              readOnlyHint: true,  openWorldHint: false },
  inspect_pipeline:      { title: "Inspect Pipeline",          readOnlyHint: true,  openWorldHint: false },
  analyze_resume:        { title: "Analyze Resume",            readOnlyHint: true,  openWorldHint: false },
  batch_parse_resumes:   { title: "Batch Parse Resumes",       readOnlyHint: true,  openWorldHint: false },
  export_results:        { title: "Export Results",            readOnlyHint: true,  openWorldHint: false },
  send_email:            { title: "Send Email",                readOnlyHint: false, destructiveHint: false, openWorldHint: true  },
  assess_candidate:      { title: "Assess Candidate",          readOnlyHint: true,  openWorldHint: true  },
  ats_manage_candidates: { title: "ATS: Manage Candidates",    readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_analytics:         { title: "ATS: Analytics",            readOnlyHint: true,  openWorldHint: false },
  ats_schedule_interview:{ title: "ATS: Schedule Interview",   readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_manage_offers:     { title: "ATS: Manage Offers",        readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_generate_demo_data:{ title: "ATS: Generate Demo Data",   readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_manage_jobs:       { title: "ATS: Manage Jobs",          readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_manage_notes:      { title: "ATS: Manage Notes",         readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_interview_feedback:{ title: "ATS: Interview Feedback",   readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  ats_search:            { title: "ATS: Search",               readOnlyHint: true,  openWorldHint: false },
  ats_compliance:        { title: "ATS: Compliance & Audit",   readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_talent_pool:       { title: "ATS: Talent Pool CRM",     readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_scorecard:         { title: "ATS: Scorecards",          readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_onboarding:        { title: "ATS: Onboarding",          readOnlyHint: false, destructiveHint: true,  idempotentHint: false, openWorldHint: false },
  ats_communication:     { title: "ATS: Communication",       readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

// Static resources exposed by this MCP server
const MCP_RESOURCES = [
  {
    uri: "mcp://ai-hr-management-toolkit/guide",
    name: "Usage Guide",
    description: "How to use the AI HR Management Toolkit — tool overview, supported file formats, and workflow examples.",
    mimeType: "text/plain",
  },
  {
    uri: "mcp://ai-hr-management-toolkit/schema/resume",
    name: "Resume Schema",
    description: "JSON schema describing the structured output format produced by the parse_resume tool.",
    mimeType: "application/json",
  },
];

const MCP_RESOURCE_CONTENT: Record<string, string> = {
  "mcp://ai-hr-management-toolkit/guide": [
    "AI Resume Parser & ATS Toolkit — Usage Guide",
    "=============================================",
    "",
    "PARSING & ANALYSIS",
    "  parse_resume         — Parse a single resume from text, file URL, or raw content (PDF/DOCX/TXT/MD/URL).",
    "  analyze_resume       — Unified analysis with selectable aspects: keywords, entities, skills,",
    "                         experience, patterns, similarity, or all. 100% algorithmic — no AI calls.",
    "  batch_parse_resumes  — Parse up to 20 resumes in one call; returns an array of parsed results.",
    "  assess_candidate     — Score a candidate against custom criteria. Algorithmic fallback if no apiKey provided.",
    "  inspect_pipeline     — Inspect the internal NLP analysis pipeline for debugging.",
    "",
    "ATS TOOLS",
    "  ats_manage_candidates — CRUD + analytics: add/update/delete/move/list + rank/filter/compare/summarize/recommend.",
    "  ats_manage_jobs       — Create / update / delete / list job postings.",
    "  ats_manage_offers     — Extend, accept, or reject offers.",
    "  ats_manage_notes      — Add or retrieve free-text notes on candidates.",
    "  ats_schedule_interview — Schedule interview slots and send invitations.",
    "  ats_interview_feedback — Record interview feedback and scores.",
    "  ats_analytics         — Dashboard stats + pipeline funnel combined. report_type: dashboard|pipeline|full.",
    "  ats_generate_demo_data — Populate the ATS with realistic demo data for testing.",
    "  ats_search            — Full-text search across all ATS entities.",
    "",
    "ENTERPRISE HR",
    "  ats_compliance       — EEO/EEOC reporting, GDPR export/erasure, audit trail, data retention policies.",
    "  ats_talent_pool      — Passive candidate talent pools (CRM). Create pools, add/remove candidates, search, analytics.",
    "  ats_scorecard        — Structured interview scorecards with weighted criteria, fill per evaluator, aggregate rankings.",
    "  ats_onboarding       — Post-hire onboarding checklists: tasks by category, assignees, progress tracking, overdue alerts.",
    "  ats_communication    — Email templates ({{variable}} interpolation), send/preview, communication history, stats.",
    "",
    "EXPORT & EMAIL",
    "  export_results — Export parsed results to JSON, CSV, or Markdown.",
    "  send_email     — Email a candidate summary or offer letter.",
    "",
    "SUPPORTED FILE FORMATS: PDF, DOCX, TXT, Markdown, plain text, URL",
    "AI PROVIDERS: openai, anthropic, google, deepseek, glm, qwen, openrouter, opencodezen",
  ].join("\n"),
  "mcp://ai-hr-management-toolkit/schema/resume": JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ParsedResume",
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Full name of the candidate" },
      "email": { "type": "string", "format": "email" },
      "phone": { "type": "string" },
      "location": { "type": "string" },
      "summary": { "type": "string", "description": "Professional summary or objective" },
      "skills": { "type": "array", "items": { "type": "string" } },
      "experience": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "company": { "type": "string" },
            "title": { "type": "string" },
            "startDate": { "type": "string" },
            "endDate": { "type": "string" },
            "description": { "type": "string" }
          }
        }
      },
      "education": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "institution": { "type": "string" },
            "degree": { "type": "string" },
            "field": { "type": "string" },
            "graduationYear": { "type": "string" }
          }
        }
      },
      "languages": { "type": "array", "items": { "type": "string" } },
      "certifications": { "type": "array", "items": { "type": "string" } }
    }
  }, null, 2),
};

// Static prompts exposed by this MCP server
const MCP_PROMPTS = [
  {
    name: "parse-and-assess-candidate",
    description: "Parse a resume and assess the candidate's fit for a specific role using criteria-based scoring.",
    arguments: [
      { name: "content", description: "Resume text, file content (base64), or URL to fetch", required: true },
      { name: "role", description: "Job title or role the candidate is being assessed for", required: false },
      { name: "criteria", description: "JSON array of evaluation criteria (e.g. required skills, experience years)", required: false },
    ],
  },
  {
    name: "compare-candidates",
    description: "Parse and compare multiple candidates side-by-side for a position, ranking them by fit score.",
    arguments: [
      { name: "resumes", description: "Newline-separated list of resume URLs or base64-encoded file contents", required: true },
      { name: "jobDescription", description: "Job description text to score candidates against", required: false },
    ],
  },
  {
    name: "ats-pipeline-summary",
    description: "Generate a concise ATS pipeline summary showing candidate counts by stage and key hiring metrics.",
    arguments: [
      { name: "jobId", description: "Optional job ID to filter pipeline stats to a single opening", required: false },
    ],
  },
];

const MCP_PROMPT_MESSAGES: Record<string, Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }>> = {
  "parse-and-assess-candidate": [
    {
      role: "user",
      content: {
        type: "text",
        text: "Please parse the following resume and assess the candidate's fit{{#role}} for the role of {{role}}{{/role}}{{#criteria}} against these criteria: {{criteria}}{{/criteria}}:\n\n{{content}}",
      },
    },
  ],
  "compare-candidates": [
    {
      role: "user",
      content: {
        type: "text",
        text: "Compare the following candidates{{#jobDescription}} for this role:\n{{jobDescription}}\n\nCandidates{{/jobDescription}}:\n{{resumes}}\n\nRank them by fit and provide a brief rationale for each.",
      },
    },
  ],
  "ats-pipeline-summary": [
    {
      role: "user",
      content: {
        type: "text",
        text: "Generate a concise ATS pipeline summary{{#jobId}} for job ID {{jobId}}{{/jobId}}. Show stage totals, conversion rates, and any bottlenecks.",
      },
    },
  ],
};

// All tools in registration order — each has { name, description, inputSchema, handler }
const allTools = [
  // Parsing & Analysis (5)
  parseResumeTool,
  mcpAnalyzeResumeTool,
  mcpBatchParseTool,
  mcpAssessCandidateTool,
  inspectPipelineTool,
  // ATS (9)
  mcpAtsManageCandidatesTool,
  mcpAtsManageJobsTool,
  mcpAtsManageOffersTool,
  mcpAtsManageNotesTool,
  mcpAtsScheduleInterviewTool,
  mcpAtsInterviewFeedbackTool,
  mcpAtsAnalyticsTool,
  mcpAtsGenerateDemoDataTool,
  mcpAtsSearchTool,
  // Enterprise HR (5)
  mcpAtsComplianceTool,
  mcpAtsTalentPoolTool,
  mcpAtsScorecardTool,
  mcpAtsOnboardingTool,
  mcpAtsCommunicationTool,
  // Utilities (2)
  exportResultsTool,
  sendEmailTool,
];

export function createResumeParserMcpServer(): Server {
  const server = new Server(
    { name: "ai-hr-management-toolkit", version: "3.1.1" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: MCP_RESOURCES,
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const text = MCP_RESOURCE_CONTENT[uri];
    if (!text) {
      return { contents: [] };
    }
    const mimeType = MCP_RESOURCES.find((r) => r.uri === uri)?.mimeType ?? "text/plain";
    return { contents: [{ uri, mimeType, text }] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: MCP_PROMPTS,
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const messages = MCP_PROMPT_MESSAGES[name];
    if (!messages) {
      throw new Error(`Unknown prompt: ${name}`);
    }
    const prompt = MCP_PROMPTS.find((p) => p.name === name);
    return { description: prompt?.description ?? name, messages };
  });

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
