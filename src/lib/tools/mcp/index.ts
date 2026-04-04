// Unified resume analysis (replaces: extract-keywords, detect-patterns, compute-similarity,
// classify-entities, extract-skills-structured, extract-experience-structured, analyze-resume-comprehensive)
export { mcpAnalyzeResumeTool } from "./analyze-resume";

// Candidate operations
export { mcpBatchParseTool } from "./batch-parse";
export { mcpAssessCandidateTool } from "./assess-candidate";
export { mcpAtsManageCandidatesTool } from "./ats-manage-candidates"; // absorbs manage-candidates

// Unified ATS analytics (replaces: ats-dashboard-stats, ats-pipeline-analytics)
export { mcpAtsAnalyticsTool } from "./ats-analytics";

// ATS domain tools
export { mcpAtsScheduleInterviewTool } from "./ats-schedule-interview";
export { mcpAtsManageOffersTool } from "./ats-manage-offers";
export { mcpAtsGenerateDemoDataTool } from "./ats-generate-demo-data";
export { mcpAtsManageJobsTool } from "./ats-manage-jobs";
export { mcpAtsManageNotesTool } from "./ats-manage-notes";
export { mcpAtsInterviewFeedbackTool } from "./ats-interview-feedback";
export { mcpAtsSearchTool } from "./ats-search";

// Enterprise HR features
export { mcpAtsComplianceTool } from "./ats-compliance";
export { mcpAtsTalentPoolTool } from "./ats-talent-pool";
export { mcpAtsScorecardTool } from "./ats-scorecard";
export { mcpAtsOnboardingTool } from "./ats-onboarding";
export { mcpAtsCommunicationTool } from "./ats-communication";
