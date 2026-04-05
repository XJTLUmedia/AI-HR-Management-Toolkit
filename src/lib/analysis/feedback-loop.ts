/**
 * Feedback Loop — Closes the open-loop parsing problem.
 *
 * When humans correct parsing results, this module:
 *   1. Captures the correction (what the parser got wrong, what the truth is)
 *   2. Detects recurring error patterns (e.g. "always misses dates in this format")
 *   3. Maintains a learned-patterns registry that the sanitizer/classifier can consult
 *   4. Triggers baseline recalibration when enough corrections accumulate
 *
 * This is the strategic fix for "parsing drifts hard when resume PDFs change quarterly."
 * Instead of re-deploying code every time templates change, the system learns from
 * corrections and adapts its confidence thresholds + detected patterns.
 */

export interface ParseCorrection {
  /** The parse ID this correction applies to */
  parseId: string;
  timestamp: number;
  /** Which field was corrected */
  field: string;
  /** What the parser extracted */
  parsedValue: string;
  /** What the human says is correct */
  correctedValue: string;
  /** The raw text context around the field (for pattern detection) */
  rawContext: string;
  /** Category of error */
  errorType: CorrectionErrorType;
  /** Optional: the file type that triggered this */
  fileType?: string;
}

export type CorrectionErrorType =
  | "wrong_value"       // Parser extracted something, but it's wrong
  | "missing_value"     // Parser missed a field entirely
  | "extra_value"       // Parser hallucinated a value that doesn't exist
  | "wrong_type"        // Parser classified the entity incorrectly (e.g. skill → location)
  | "format_error"      // Parser mangled the format (e.g. date "Jan 2024" → "Jan2024")
  | "split_error"       // Parser merged or split fields incorrectly
  | "encoding_artifact"; // Binary/encoding garbage leaked through

export interface LearnedPattern {
  id: string;
  /** When this pattern was first detected */
  firstSeen: number;
  /** When this pattern was last seen */
  lastSeen: number;
  /** How many corrections involve this pattern */
  occurrenceCount: number;
  /** The error pattern category */
  errorType: CorrectionErrorType;
  /** Which field is affected */
  field: string;
  /** A description of the pattern for human review */
  description: string;
  /** Regex pattern that matches the problematic raw text (if detectable) */
  matchPattern?: string;
  /** Suggested fix or transformation */
  suggestedFix?: string;
  /** Whether this pattern has been reviewed and confirmed by a human */
  confirmed: boolean;
  /** Whether this pattern has been incorporated into the parser */
  incorporated: boolean;
}

export interface FeedbackStats {
  totalCorrections: number;
  correctionsByField: Record<string, number>;
  correctionsByErrorType: Record<string, number>;
  learnedPatternCount: number;
  confirmedPatternCount: number;
  incorporatedPatternCount: number;
  /** Correction rate over time (rolling 7-day windows) */
  correctionTrend: Array<{ windowStart: number; windowEnd: number; count: number }>;
  /** Fields with highest error rates */
  topErrorFields: Array<{ field: string; count: number; rate: number }>;
  /** Most common new format patterns detected */
  topNewPatterns: LearnedPattern[];
}

/**
 * Feedback loop tracker. Captures corrections and detects recurring patterns.
 */
export class ParsingFeedbackLoop {
  private corrections: ParseCorrection[] = [];
  private learnedPatterns: Map<string, LearnedPattern> = new Map();
  private totalParses = 0;
  private onDriftCallback?: (stats: FeedbackStats) => void;
  private driftCheckInterval: number; // check every N corrections

  constructor(options: { driftCheckInterval?: number; onDrift?: (stats: FeedbackStats) => void } = {}) {
    this.driftCheckInterval = options.driftCheckInterval ?? 25;
    this.onDriftCallback = options.onDrift;
  }

  /** Increment total parse count (call after every parse, even without corrections) */
  recordParseAttempt(): void {
    this.totalParses++;
  }

  /** Record a human correction */
  recordCorrection(correction: ParseCorrection): LearnedPattern | null {
    this.corrections.push(correction);

    // Detect if this correction matches an existing learned pattern
    const existingPattern = this.findMatchingPattern(correction);
    if (existingPattern) {
      existingPattern.occurrenceCount++;
      existingPattern.lastSeen = correction.timestamp;
      return existingPattern;
    }

    // Try to detect a new pattern from recent corrections
    const newPattern = this.detectNewPattern(correction);

    // Check if it's time for a drift alert
    if (this.corrections.length % this.driftCheckInterval === 0 && this.onDriftCallback) {
      const stats = this.getStats();
      // Alert if correction rate exceeds 15% of total parses
      if (this.totalParses > 0 && this.corrections.length / this.totalParses > 0.15) {
        this.onDriftCallback(stats);
      }
    }

    return newPattern;
  }

  /** Find if a correction matches a known pattern */
  private findMatchingPattern(correction: ParseCorrection): LearnedPattern | null {
    for (const pattern of this.learnedPatterns.values()) {
      if (
        pattern.field === correction.field &&
        pattern.errorType === correction.errorType
      ) {
        // If there's a matchPattern, test against the raw context
        if (pattern.matchPattern) {
          try {
            const regex = new RegExp(pattern.matchPattern, "i");
            if (regex.test(correction.rawContext)) {
              return pattern;
            }
          } catch {
            // Invalid regex in learned pattern, skip
          }
        } else {
          // No regex yet, match by field + error type combo
          return pattern;
        }
      }
    }
    return null;
  }

  /** Attempt to detect a new pattern from recent corrections */
  private detectNewPattern(correction: ParseCorrection): LearnedPattern | null {
    // Look for 3+ similar corrections (same field + same error type) in the last 50 corrections
    const recent = this.corrections.slice(-50);
    const similar = recent.filter(
      (c) => c.field === correction.field && c.errorType === correction.errorType
    );

    if (similar.length < 3) return null;

    // We have a recurring pattern
    const patternId = `${correction.field}:${correction.errorType}:${Date.now()}`;
    const pattern: LearnedPattern = {
      id: patternId,
      firstSeen: similar[0].timestamp,
      lastSeen: correction.timestamp,
      occurrenceCount: similar.length,
      errorType: correction.errorType,
      field: correction.field,
      description: this.generatePatternDescription(correction, similar),
      matchPattern: this.tryExtractCommonPattern(similar),
      suggestedFix: this.generateSuggestedFix(correction, similar),
      confirmed: false,
      incorporated: false,
    };

    this.learnedPatterns.set(patternId, pattern);
    return pattern;
  }

  /** Generate a human-readable description of the detected pattern */
  private generatePatternDescription(
    correction: ParseCorrection,
    similar: ParseCorrection[]
  ): string {
    const fieldName = correction.field;
    const errorType = correction.errorType;
    const count = similar.length;

    switch (errorType) {
      case "wrong_value":
        return `Parser extracts wrong value for "${fieldName}" — ${count} corrections in recent window. Likely new template format.`;
      case "missing_value":
        return `Parser misses "${fieldName}" — ${count} corrections. New section headers or layout may be unrecognized.`;
      case "extra_value":
        return `Parser hallucinating "${fieldName}" values — ${count} corrections. Regex may be too aggressive.`;
      case "wrong_type":
        return `Parser misclassifies "${fieldName}" entity type — ${count} corrections. Disambiguation rules may need updating.`;
      case "format_error":
        return `Parser mangles "${fieldName}" format — ${count} corrections. Sanitization or extraction regex likely outdated.`;
      case "split_error":
        return `Parser incorrectly splits/merges "${fieldName}" — ${count} corrections. Section boundary detection may need tuning.`;
      case "encoding_artifact":
        return `Encoding artifacts leaking into "${fieldName}" — ${count} corrections. New PDF generator may use unknown encoding.`;
      default:
        return `Recurring error in "${fieldName}" (${errorType}) — ${count} corrections detected.`;
    }
  }

  /** Try to find a common regex pattern in the raw contexts of similar corrections */
  private tryExtractCommonPattern(similar: ParseCorrection[]): string | undefined {
    // Simple heuristic: find the longest common substring in raw contexts
    if (similar.length < 2) return undefined;

    const contexts = similar.map((c) => c.rawContext.toLowerCase());
    // Find common words across all contexts
    const wordSets = contexts.map(
      (c) => new Set(c.split(/\s+/).filter((w) => w.length > 2))
    );

    let commonWords: Set<string> = wordSets[0];
    for (let i = 1; i < wordSets.length; i++) {
      commonWords = new Set([...commonWords].filter((w) => wordSets[i].has(w)));
    }

    if (commonWords.size === 0) return undefined;

    // Build a loose pattern from common words
    const words = [...commonWords].slice(0, 5);
    return words.map((w) => escapeRegex(w)).join(".*");
  }

  /** Generate a suggested fix based on the error pattern */
  private generateSuggestedFix(
    correction: ParseCorrection,
    similar: ParseCorrection[]
  ): string {
    switch (correction.errorType) {
      case "missing_value":
        return `Add recognition pattern for "${correction.field}" in new template format. Check section header variations.`;
      case "wrong_value":
        return `Review regex for "${correction.field}" extraction. Consider adding corrected values as test cases.`;
      case "wrong_type":
        return `Update disambiguation rules for "${correction.field}". Add new context patterns for correct classification.`;
      case "format_error":
        return `Normalize format for "${correction.field}". Add new format variant to extraction regex.`;
      case "encoding_artifact":
        return `Add new encoding artifact pattern to sanitizer. Check PDF_ARTIFACTS list for missing patterns.`;
      case "split_error":
        return `Review section boundary detection. Check if new resume templates use different delimiters.`;
      case "extra_value":
        return `Tighten regex for "${correction.field}" — current pattern matches too broadly.`;
      default:
        return `Manual review needed for "${correction.field}" error pattern. ${similar.length} similar corrections found.`;
    }
  }

  /** Get learned patterns that haven't been incorporated yet */
  getUnincorporatedPatterns(): LearnedPattern[] {
    return [...this.learnedPatterns.values()]
      .filter((p) => !p.incorporated)
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }

  /** Mark a pattern as confirmed by a human */
  confirmPattern(patternId: string): boolean {
    const pattern = this.learnedPatterns.get(patternId);
    if (!pattern) return false;
    pattern.confirmed = true;
    return true;
  }

  /** Mark a pattern as incorporated into the parser */
  incorporatePattern(patternId: string): boolean {
    const pattern = this.learnedPatterns.get(patternId);
    if (!pattern) return false;
    pattern.incorporated = true;
    return true;
  }

  /** Get comprehensive feedback statistics */
  getStats(): FeedbackStats {
    const correctionsByField: Record<string, number> = {};
    const correctionsByErrorType: Record<string, number> = {};

    for (const c of this.corrections) {
      correctionsByField[c.field] = (correctionsByField[c.field] || 0) + 1;
      correctionsByErrorType[c.errorType] = (correctionsByErrorType[c.errorType] || 0) + 1;
    }

    // Top error fields with rates
    const topErrorFields = Object.entries(correctionsByField)
      .map(([field, count]) => ({
        field,
        count,
        rate: this.totalParses > 0 ? count / this.totalParses : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Correction trend (7-day windows)
    const correctionTrend = this.computeCorrectionTrend();

    // Top new patterns
    const topNewPatterns = this.getUnincorporatedPatterns().slice(0, 5);

    const patterns = [...this.learnedPatterns.values()];

    return {
      totalCorrections: this.corrections.length,
      correctionsByField,
      correctionsByErrorType,
      learnedPatternCount: patterns.length,
      confirmedPatternCount: patterns.filter((p) => p.confirmed).length,
      incorporatedPatternCount: patterns.filter((p) => p.incorporated).length,
      correctionTrend,
      topErrorFields,
      topNewPatterns,
    };
  }

  private computeCorrectionTrend(): FeedbackStats["correctionTrend"] {
    if (this.corrections.length === 0) return [];

    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const sorted = [...this.corrections].sort((a, b) => a.timestamp - b.timestamp);
    const earliest = sorted[0].timestamp;
    const latest = sorted[sorted.length - 1].timestamp;

    const trend: FeedbackStats["correctionTrend"] = [];
    let windowStart = earliest;

    while (windowStart <= latest) {
      const windowEnd = windowStart + WINDOW_MS;
      const count = sorted.filter(
        (c) => c.timestamp >= windowStart && c.timestamp < windowEnd
      ).length;
      trend.push({ windowStart, windowEnd, count });
      windowStart = windowEnd;
    }

    return trend;
  }

  /** Export all corrections (for persistence) */
  exportCorrections(): { corrections: ParseCorrection[]; patterns: LearnedPattern[]; totalParses: number } {
    return {
      corrections: [...this.corrections],
      patterns: [...this.learnedPatterns.values()],
      totalParses: this.totalParses,
    };
  }

  /** Import corrections (for restoring from persistence) */
  importCorrections(data: { corrections: ParseCorrection[]; patterns: LearnedPattern[]; totalParses: number }): void {
    this.corrections = [...data.corrections];
    this.totalParses = data.totalParses;
    this.learnedPatterns.clear();
    for (const p of data.patterns) {
      this.learnedPatterns.set(p.id, p);
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Singleton feedback loop instance */
let _feedbackLoop: ParsingFeedbackLoop | null = null;

export function getParsingFeedbackLoop(
  options?: { driftCheckInterval?: number; onDrift?: (stats: FeedbackStats) => void }
): ParsingFeedbackLoop {
  if (!_feedbackLoop) {
    _feedbackLoop = new ParsingFeedbackLoop(options);
  }
  return _feedbackLoop;
}

export function resetParsingFeedbackLoop(): void {
  _feedbackLoop = null;
}
