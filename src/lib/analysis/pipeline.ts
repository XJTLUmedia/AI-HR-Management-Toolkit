/**
 * Pipeline Orchestrator — Runs the full 5-node atomic deconstruction pipeline.
 *
 * Implements Gemini's pipeline structure:
 *   1. Ingestion   → file format detection & binary-to-string (handled by parser/)
 *   2. Sanitization → artifact removal, noise filtering
 *   3. Tokenization → TF-IDF keyword extraction, n-gram analysis
 *   4. Classification → NER with domain-aware disambiguation & confidence
 *   5. Serialization → structured output ready for schema validation / AI refinement
 *
 * Root cause: zero-friction submissions → automated scalable categorization.
 */

import { sanitizeText, type SanitizationResult } from "./sanitizer";
import { extractKeywords, type KeywordExtractionResult } from "./keyword-extractor";
import { classifyEntities, type ClassificationResult } from "./classifier";
import {
  extractMetrics,
  extractContact,
  detectSections,
  estimateYearsOfExperience,
  type ExtractedMetrics,
  type ExtractedContact,
  type SectionBoundary,
} from "./pattern-matcher";
import {
  getParsingHealthMonitor,
  type ParseHealthSnapshot,
  type FieldConfidence,
  type ParseAnomaly,
} from "./parsing-health";
import { getParsingFeedbackLoop } from "./feedback-loop";

export interface PipelineStage {
  name: string;
  description: string;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  itemsProcessed: number;
  confidence: number; // 0-1 aggregate confidence for this stage
  details: Record<string, unknown>;
}

export interface PipelineResult {
  /** Cleaned text after sanitization */
  cleanText: string;
  /** Raw text before sanitization */
  rawText: string;

  /** The 5 pipeline stages with timing and confidence */
  stages: PipelineStage[];

  /** Aggregate pipeline confidence (weighted average across stages) */
  overallConfidence: number;

  /** Total processing time across all stages */
  totalDurationMs: number;

  /** Per-node outputs */
  sanitization: SanitizationResult;
  tokenization: KeywordExtractionResult;
  classification: ClassificationResult;
  patternMatching: {
    metrics: ExtractedMetrics;
    contact: ExtractedContact;
    sections: SectionBoundary[];
    estimatedYears: number;
  };

  /** Serialization-ready structured summary */
  serialization: {
    coreEntities: {
      identification: { emails: string[]; phones: string[]; urls: string[] };
      capabilities: Array<{ skill: string; confidence: number }>;
      temporalMilestones: Array<{ raw: string; start: string; end: string | null }>;
      education: string[];
    };
    dataQuality: {
      signalToNoiseRatio: number;
      completenessScore: number;
      sectionsFound: string[];
      sectionsMissing: string[];
    };
    assumptions: Array<{ assumption: string; limitation: string; mitigated: boolean }>;
  };

  /** Health tracking — drift detection and anomaly reporting */
  health: {
    parseId: string;
    anomalies: ParseAnomaly[];
    fieldConfidences: FieldConfidence[];
    dispositionCounts: { accepted: number; review: number; rejected: number };
    driftDetected: boolean;
  };
}

const EXPECTED_SECTIONS = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
];

/**
 * Run the full 5-node pipeline on raw resume text.
 * The ingestion stage is assumed complete (text already extracted from file).
 */
export function runPipeline(rawText: string): PipelineResult {
  const stages: PipelineStage[] = [];

  // -- Stage 1: Ingestion (already done by parser, record metadata) --
  const ingestionStart = performance.now();
  const ingestionStage: PipelineStage = {
    name: "Ingestion",
    description: "File format detection and binary-to-string conversion",
    status: "completed",
    durationMs: 0,
    itemsProcessed: rawText.length,
    confidence: rawText.length > 50 ? 0.95 : 0.3,
    details: {
      characterCount: rawText.length,
      hasContent: rawText.length > 50,
    },
  };
  ingestionStage.durationMs = performance.now() - ingestionStart;
  stages.push(ingestionStage);

  // -- Stage 2: Sanitization --
  const sanitizationStart = performance.now();
  const sanitization = sanitizeText(rawText);
  const sanitizationStage: PipelineStage = {
    name: "Sanitization",
    description: "Removal of stop words, special characters, and non-ASCII artifacts",
    status: "completed",
    durationMs: performance.now() - sanitizationStart,
    itemsProcessed: sanitization.metrics.artifactsFound.length,
    confidence: sanitization.metrics.charsRemoved / sanitization.metrics.originalLength < 0.3 ? 0.9 : 0.7,
    details: {
      charsRemoved: sanitization.metrics.charsRemoved,
      artifactsFound: sanitization.metrics.artifactsFound,
      reductionPercent: Math.round((sanitization.metrics.charsRemoved / sanitization.metrics.originalLength) * 100),
    },
  };
  stages.push(sanitizationStage);

  // -- Stage 3: Tokenization --
  const tokenizationStart = performance.now();
  const tokenization = extractKeywords(sanitization.cleanText);
  const tokenizationStage: PipelineStage = {
    name: "Tokenization",
    description: "Splitting text into discrete word/phrase units with TF-IDF scoring",
    status: "completed",
    durationMs: performance.now() - tokenizationStart,
    itemsProcessed: tokenization.totalTerms,
    confidence: tokenization.uniqueTerms > 20 ? 0.9 : tokenization.uniqueTerms > 5 ? 0.7 : 0.4,
    details: {
      totalTerms: tokenization.totalTerms,
      uniqueTerms: tokenization.uniqueTerms,
      topKeywords: tokenization.keywords.slice(0, 10).map((k) => k.term),
      bigramCount: tokenization.bigrams.length,
      trigramCount: tokenization.trigrams.length,
    },
  };
  stages.push(tokenizationStage);

  // -- Stage 4: Classification --
  const classificationStart = performance.now();
  const classification = classifyEntities(sanitization.cleanText);
  const metrics = extractMetrics(sanitization.cleanText);
  const contact = extractContact(sanitization.cleanText);
  const sections = detectSections(sanitization.cleanText);
  const estimatedYears = estimateYearsOfExperience(sanitization.cleanText);
  const classificationDuration = performance.now() - classificationStart;

  const classificationStage: PipelineStage = {
    name: "Classification",
    description: "Named Entity Recognition with domain-aware disambiguation",
    status: "completed",
    durationMs: classificationDuration,
    itemsProcessed: classification.summary.totalEntities,
    confidence: classification.summary.averageConfidence,
    details: {
      entitiesByType: classification.summary.byType,
      ambiguousEntities: classification.summary.ambiguousEntities,
      disambiguationApplied: classification.summary.disambiguationApplied,
      sectionsDetected: sections.map((s) => s.name),
      estimatedYears,
    },
  };
  stages.push(classificationStage);

  // -- Stage 5: Serialization --
  const serializationStart = performance.now();

  const skillEntities = classification.entities.filter((e) => e.type === "SKILL");
  const dateEntities = classification.entities.filter((e) => e.type === "DATE");
  const educationEntities = classification.entities.filter((e) => e.type === "EDUCATION_DEGREE");

  const sectionsFound = sections.map((s) => s.name);
  const sectionsMissing = EXPECTED_SECTIONS.filter((s) => !sectionsFound.includes(s));

  // Signal-to-noise: ratio of classified entities to total text tokens
  const signalToNoise = tokenization.totalTerms > 0
    ? Math.min(1, classification.summary.totalEntities / (tokenization.totalTerms * 0.1))
    : 0;

  // Completeness: how many expected sections exist (clamped to 1.0 max —
  // detectSections can find more section types than EXPECTED_SECTIONS)
  const completenessScore = Math.min(1, sectionsFound.length / EXPECTED_SECTIONS.length);

  const serialization: PipelineResult["serialization"] = {
    coreEntities: {
      identification: {
        emails: contact.emails,
        phones: contact.phones,
        urls: contact.urls,
      },
      capabilities: skillEntities.map((e) => ({ skill: e.text, confidence: e.confidence })),
      temporalMilestones: dateEntities.map((e) => ({
        raw: e.text,
        start: e.text,
        end: null,
      })),
      education: educationEntities.map((e) => e.text),
    },
    dataQuality: {
      signalToNoiseRatio: Math.round(signalToNoise * 100) / 100,
      completenessScore: Math.round(completenessScore * 100) / 100,
      sectionsFound,
      sectionsMissing,
    },
    assumptions: [
      {
        assumption: "Resume follows predictable semantic formatting",
        limitation: "Visual layouts vary infinitely; positional text assumptions fail on multi-column PDFs",
        mitigated: true, // We use pattern matching, not positional
      },
      {
        assumption: "Keyword extraction equates to skill verification",
        limitation: "Token match does not guarantee proficiency — acts as word counter not capability evaluator",
        mitigated: skillEntities.some((e) => e.confidence < 0.7), // Flag when disambiguation was needed
      },
      {
        assumption: "NLP perfectly interprets human context",
        limitation: "Ambiguous entities (Java=language vs location) can be misclassified without domain training",
        mitigated: classification.summary.disambiguationApplied > 0,
      },
    ],
  };

  const serializationStage: PipelineStage = {
    name: "Serialization",
    description: "Mapping labeled tokens to JSON schema for database insertion",
    status: "completed",
    durationMs: performance.now() - serializationStart,
    itemsProcessed: Object.values(serialization.coreEntities).flat().length,
    confidence: completenessScore * 0.5 + signalToNoise * 0.5,
    details: {
      completenessScore,
      signalToNoiseRatio: signalToNoise,
      sectionsMissing,
    },
  };
  stages.push(serializationStage);

  // Aggregate
  const totalDurationMs = stages.reduce((sum, s) => sum + s.durationMs, 0);
  const stageWeights = [0.1, 0.15, 0.25, 0.3, 0.2]; // classification weighted highest
  const overallConfidence = stages.reduce(
    (sum, s, i) => sum + s.confidence * (stageWeights[i] || 0.2),
    0
  );

  // -- Health Tracking: Record parse and detect anomalies --
  const monitor = getParsingHealthMonitor();
  const feedbackLoop = getParsingFeedbackLoop();

  const parseId = `parse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build field-level confidences from classification entities
  const fieldConfidences: FieldConfidence[] = [
    ...classification.entities.map((e) => ({
      field: e.type,
      confidence: e.confidence,
      rawValue: e.text,
      disposition: monitor.classifyConfidence(e.confidence),
    })),
    // Add section completeness as a pseudo-field
    {
      field: "section_completeness",
      confidence: completenessScore,
      rawValue: `${sectionsFound.length}/${EXPECTED_SECTIONS.length} sections`,
      disposition: monitor.classifyConfidence(completenessScore),
    },
  ];

  const dispositionCounts = { accepted: 0, review: 0, rejected: 0 };
  for (const fc of fieldConfidences) {
    dispositionCounts[fc.disposition]++;
  }

  const stageConfidences: Record<string, number> = {};
  for (const s of stages) {
    stageConfidences[s.name] = s.confidence;
  }

  const snapshot: ParseHealthSnapshot = {
    parseId,
    timestamp: Date.now(),
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    stageConfidences,
    fieldConfidences,
    dispositionCounts,
    anomalies: [],
    sourceMeta: {
      fileType: "unknown", // caller can enrich this
      fileSize: rawText.length,
    },
  };

  const anomalies = monitor.recordParse(snapshot);
  feedbackLoop.recordParseAttempt();

  // Check drift status
  const driftReport = monitor.detectDrift();

  return {
    cleanText: sanitization.cleanText,
    rawText,
    stages,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    sanitization,
    tokenization,
    classification,
    patternMatching: { metrics, contact, sections, estimatedYears },
    serialization,
    health: {
      parseId,
      anomalies,
      fieldConfidences,
      dispositionCounts,
      driftDetected: driftReport.driftDetected,
    },
  };
}
