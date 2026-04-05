export { extractKeywords, tokenize, termFrequency } from "./keyword-extractor";
export type { KeywordExtractionResult, TfIdfResult } from "./keyword-extractor";

export {
  cosineSimilarity,
  jaccardSimilarity,
  analyzeKeywordOverlap,
  calculateSimilarity,
  scoreSkillMatch,
} from "./scoring";
export type { SimilarityResult, KeywordOverlap } from "./scoring";

export {
  extractMetrics,
  extractDates,
  extractContact,
  detectSections,
  estimateYearsOfExperience,
} from "./pattern-matcher";
export type {
  ExtractedMetrics,
  ExtractedDates,
  ExtractedContact,
  SectionBoundary,
} from "./pattern-matcher";

export { sanitizeText } from "./sanitizer";
export type { SanitizationResult } from "./sanitizer";

export { classifyEntities } from "./classifier";
export type { ClassifiedEntity, ClassificationResult, EntityType } from "./classifier";

export { runPipeline } from "./pipeline";
export type { PipelineResult, PipelineStage } from "./pipeline";

export { assessCandidate } from "./criteria-scorer";
export type { AxisScore, AssessmentResult } from "./criteria-scorer";

export { ParsingHealthMonitor, getParsingHealthMonitor, resetParsingHealthMonitor } from "./parsing-health";
export type {
  ParseHealthSnapshot,
  ParseAnomaly,
  DriftReport,
  WindowStats,
  FieldConfidence,
  HealthConfig,
} from "./parsing-health";

export { ParsingFeedbackLoop, getParsingFeedbackLoop, resetParsingFeedbackLoop } from "./feedback-loop";
export type {
  ParseCorrection,
  CorrectionErrorType,
  LearnedPattern,
  FeedbackStats,
} from "./feedback-loop";
