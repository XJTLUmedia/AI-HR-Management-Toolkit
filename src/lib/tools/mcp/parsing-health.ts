/**
 * MCP Tool: parsing_health
 *
 * Exposes the parsing health monitor and feedback loop through MCP.
 * Allows AI agents and operators to:
 *   - Check current parsing health (drift detection)
 *   - View the review queue (low-confidence parses)
 *   - Submit corrections (human-in-the-loop feedback)
 *   - View learned patterns and feedback stats
 *   - Calibrate baselines when quality is known-good
 *
 * This closes the open-loop parsing problem: instead of silently degrading
 * when resume PDF formats change quarterly, the system detects drift,
 * captures corrections, and surfaces actionable recommendations.
 */

import {
  getParsingHealthMonitor,
} from "@/lib/analysis/parsing-health";
import {
  getParsingFeedbackLoop,
  type ParseCorrection,
  type CorrectionErrorType,
  type LearnedPattern,
} from "@/lib/analysis/feedback-loop";

type HealthAction =
  | "check_drift"
  | "current_stats"
  | "review_queue"
  | "submit_correction"
  | "feedback_stats"
  | "learned_patterns"
  | "calibrate_baseline";

interface HealthInput {
  action: HealthAction;
  /** For submit_correction */
  correction?: {
    parseId: string;
    field: string;
    parsedValue: string;
    correctedValue: string;
    rawContext: string;
    errorType: CorrectionErrorType;
    fileType?: string;
  };
  /** For review_queue */
  limit?: number;
  /** For learned_patterns: filter by confirmed/unincorporated */
  patternFilter?: "all" | "unincorporated" | "confirmed";
  /** For confirm/incorporate pattern */
  patternId?: string;
}

export const mcpParsingHealthTool = {
  name: "parsing_health",
  description:
    "Monitor parsing quality, detect drift when resume formats change, " +
    "submit human corrections, and view learned error patterns. " +
    "Use 'check_drift' to see if parsing quality has degraded. " +
    "Use 'submit_correction' to feed back human corrections that improve pattern detection. " +
    "Use 'calibrate_baseline' after confirming parsing quality is good to set the reference point.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: [
          "check_drift",
          "current_stats",
          "review_queue",
          "submit_correction",
          "feedback_stats",
          "learned_patterns",
          "calibrate_baseline",
        ],
        description:
          "check_drift: Compare current parsing quality to baseline and detect degradation. " +
          "current_stats: Get rolling window statistics. " +
          "review_queue: Get parses that need human review (low confidence / anomalies). " +
          "submit_correction: Record a human correction for a parsed field. " +
          "feedback_stats: Get correction statistics and error trends. " +
          "learned_patterns: View patterns detected from corrections. " +
          "calibrate_baseline: Set current quality as the reference baseline.",
      },
      correction: {
        type: "object",
        description: "Required for submit_correction. The correction details.",
        properties: {
          parseId: { type: "string", description: "The parse ID being corrected" },
          field: { type: "string", description: "Which field was wrong (e.g. 'email', 'SKILL', 'DATE')" },
          parsedValue: { type: "string", description: "What the parser extracted" },
          correctedValue: { type: "string", description: "What the correct value is" },
          rawContext: { type: "string", description: "Raw text around the field for pattern learning" },
          errorType: {
            type: "string",
            enum: ["wrong_value", "missing_value", "extra_value", "wrong_type", "format_error", "split_error", "encoding_artifact"],
            description: "Category of the parsing error",
          },
          fileType: { type: "string", description: "Optional: the file type (pdf, docx, etc.)" },
        },
      },
      limit: {
        type: "number",
        description: "For review_queue: max number of items to return (default: 20)",
      },
      patternFilter: {
        type: "string",
        enum: ["all", "unincorporated", "confirmed"],
        description: "For learned_patterns: filter by status",
      },
      patternId: {
        type: "string",
        description: "For confirming or incorporating a learned pattern",
      },
    },
    required: ["action"],
  },
  handler(input: HealthInput) {
    const monitor = getParsingHealthMonitor();
    const feedbackLoop = getParsingFeedbackLoop();

    const ok = (data: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    });

    switch (input.action) {
      case "check_drift": {
        const driftReport = monitor.detectDrift();
        return ok({ action: "check_drift", success: true, ...driftReport });
      }

      case "current_stats": {
        const stats = monitor.getCurrentStats();
        return ok({ action: "current_stats", success: true, ...stats });
      }

      case "review_queue": {
        const queue = monitor.getReviewQueue(input.limit ?? 20);
        return ok({ action: "review_queue", success: true, items: queue });
      }

      case "submit_correction": {
        if (!input.correction) {
          return ok({
            action: "submit_correction",
            success: false,
            message: "Missing 'correction' field. Provide parseId, field, parsedValue, correctedValue, rawContext, and errorType.",
          });
        }

        const correction: ParseCorrection = {
          parseId: input.correction.parseId,
          timestamp: Date.now(),
          field: input.correction.field,
          parsedValue: input.correction.parsedValue,
          correctedValue: input.correction.correctedValue,
          rawContext: input.correction.rawContext,
          errorType: input.correction.errorType,
          fileType: input.correction.fileType,
        };

        const learnedPattern = feedbackLoop.recordCorrection(correction);

        return ok({
          action: "submit_correction",
          success: true,
          message: learnedPattern
            ? `Correction recorded. Matched/created pattern: "${learnedPattern.description}" (${learnedPattern.occurrenceCount} occurrences)`
            : "Correction recorded. No recurring pattern detected yet.",
          pattern: learnedPattern,
        });
      }

      case "feedback_stats": {
        const stats = feedbackLoop.getStats();
        return ok({ action: "feedback_stats", success: true, ...stats });
      }

      case "learned_patterns": {
        const filter = input.patternFilter ?? "unincorporated";
        let patterns: LearnedPattern[];

        if (filter === "unincorporated") {
          patterns = feedbackLoop.getUnincorporatedPatterns();
        } else {
          const allData = feedbackLoop.exportCorrections();
          patterns = filter === "confirmed"
            ? allData.patterns.filter((p) => p.confirmed)
            : allData.patterns;
        }

        return ok({ action: "learned_patterns", success: true, patterns });
      }

      case "calibrate_baseline": {
        const baseline = monitor.calibrateBaseline();
        return ok({ action: "calibrate_baseline", success: true, baseline });
      }

      default:
        return ok({ action: input.action, success: false, message: `Unknown action: ${input.action}` });
    }
  },
};
