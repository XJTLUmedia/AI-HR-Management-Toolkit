/**
 * Parsing Health Monitor — Detects drift before it becomes a crisis.
 *
 * Tracks per-parse confidence, maintains rolling baselines, and fires
 * alerts when parsing quality degrades beyond configurable thresholds.
 *
 * Addresses the "quarterly PDF drift" problem: resume templates evolve
 * (Canva, Figma, AI-generated, new ATS exports), and hardcoded regex
 * silently degrades. This module makes degradation visible and actionable.
 */

export interface FieldConfidence {
  field: string;
  confidence: number;
  rawValue: string;
  /** Whether this field was auto-accepted, queued for review, or rejected */
  disposition: "accepted" | "review" | "rejected";
}

export interface ParseHealthSnapshot {
  /** Unique parse ID for traceability */
  parseId: string;
  timestamp: number;
  /** Overall pipeline confidence from runPipeline */
  overallConfidence: number;
  /** Per-stage confidence scores */
  stageConfidences: Record<string, number>;
  /** Per-field confidence with dispositions */
  fieldConfidences: FieldConfidence[];
  /** How many fields fell into each disposition bucket */
  dispositionCounts: { accepted: number; review: number; rejected: number };
  /** Detected anomalies for this parse */
  anomalies: ParseAnomaly[];
  /** Source metadata for upstream tracking */
  sourceMeta: {
    fileType: string;
    fileSize: number;
    pageCount?: number;
  };
}

export interface ParseAnomaly {
  type:
    | "low_overall_confidence"
    | "stage_degradation"
    | "high_rejection_rate"
    | "empty_critical_field"
    | "sanitization_excess"
    | "section_missing"
    | "unknown_artifacts";
  severity: "warning" | "critical";
  message: string;
  details: Record<string, unknown>;
}

export interface DriftReport {
  /** Current rolling window stats */
  current: WindowStats;
  /** Baseline stats (from the last stable period) */
  baseline: WindowStats;
  /** Whether drift is detected beyond threshold */
  driftDetected: boolean;
  /** Per-metric drift deltas */
  deltas: Array<{
    metric: string;
    baselineValue: number;
    currentValue: number;
    delta: number;
    severity: "ok" | "warning" | "critical";
  }>;
  /** When baseline was last calibrated */
  baselineTimestamp: number;
  /** Recommendations based on drift analysis */
  recommendations: string[];
}

export interface WindowStats {
  sampleCount: number;
  meanOverallConfidence: number;
  medianOverallConfidence: number;
  p10Confidence: number;
  meanDispositionRates: { accepted: number; review: number; rejected: number };
  meanStageConfidences: Record<string, number>;
  anomalyRate: number;
  topAnomalyTypes: Array<{ type: string; count: number }>;
}

export interface HealthConfig {
  /** Confidence thresholds for field disposition */
  confidenceThresholds: {
    autoAccept: number;   // >= this → accepted (default: 0.85)
    review: number;       // >= this → review queue (default: 0.60)
                          // < review → rejected
  };
  /** How many recent parses to keep in the rolling window */
  rollingWindowSize: number; // default: 200
  /** Drift detection: max allowed drop in mean confidence vs baseline */
  driftThresholds: {
    confidenceDrop: number;    // default: 0.10 (10% drop = warning)
    criticalDrop: number;      // default: 0.20 (20% drop = critical)
    rejectionRateSpike: number; // default: 0.15 (15% absolute increase)
    anomalyRateSpike: number;  // default: 0.10
  };
}

const DEFAULT_CONFIG: HealthConfig = {
  confidenceThresholds: {
    autoAccept: 0.85,
    review: 0.60,
  },
  rollingWindowSize: 200,
  driftThresholds: {
    confidenceDrop: 0.10,
    criticalDrop: 0.20,
    rejectionRateSpike: 0.15,
    anomalyRateSpike: 0.10,
  },
};

/**
 * In-memory health tracker. In production, back with persistent storage.
 * Holds a rolling window of parse snapshots and a calibrated baseline.
 */
export class ParsingHealthMonitor {
  private config: HealthConfig;
  private snapshots: ParseHealthSnapshot[] = [];
  private baseline: WindowStats | null = null;
  private baselineTimestamp = 0;

  constructor(config: Partial<HealthConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      confidenceThresholds: {
        ...DEFAULT_CONFIG.confidenceThresholds,
        ...config.confidenceThresholds,
      },
      driftThresholds: {
        ...DEFAULT_CONFIG.driftThresholds,
        ...config.driftThresholds,
      },
    };
  }

  /** Assign disposition to a confidence score */
  classifyConfidence(confidence: number): "accepted" | "review" | "rejected" {
    if (confidence >= this.config.confidenceThresholds.autoAccept) return "accepted";
    if (confidence >= this.config.confidenceThresholds.review) return "review";
    return "rejected";
  }

  /** Record a parse result and check for anomalies */
  recordParse(snapshot: ParseHealthSnapshot): ParseAnomaly[] {
    const anomalies: ParseAnomaly[] = [];

    // Check for low overall confidence
    if (snapshot.overallConfidence < this.config.confidenceThresholds.review) {
      anomalies.push({
        type: "low_overall_confidence",
        severity: "critical",
        message: `Overall confidence ${snapshot.overallConfidence.toFixed(2)} is below review threshold ${this.config.confidenceThresholds.review}`,
        details: { confidence: snapshot.overallConfidence },
      });
    }

    // Check for high rejection rate
    const totalFields =
      snapshot.dispositionCounts.accepted +
      snapshot.dispositionCounts.review +
      snapshot.dispositionCounts.rejected;
    if (totalFields > 0) {
      const rejectionRate = snapshot.dispositionCounts.rejected / totalFields;
      if (rejectionRate > 0.3) {
        anomalies.push({
          type: "high_rejection_rate",
          severity: "critical",
          message: `${Math.round(rejectionRate * 100)}% of fields rejected — likely format incompatibility`,
          details: { rejectionRate, counts: snapshot.dispositionCounts },
        });
      }
    }

    // Check for stage degradation (any stage below 0.5)
    for (const [stage, conf] of Object.entries(snapshot.stageConfidences)) {
      if (conf < 0.5) {
        anomalies.push({
          type: "stage_degradation",
          severity: "warning",
          message: `Stage "${stage}" confidence at ${conf.toFixed(2)} — potential format incompatibility`,
          details: { stage, confidence: conf },
        });
      }
    }

    // Check for excessive sanitization (>40% of text removed)
    const sanitizationDetails = snapshot.stageConfidences["Sanitization"];
    if (sanitizationDetails !== undefined && sanitizationDetails < 0.7) {
      anomalies.push({
        type: "sanitization_excess",
        severity: "warning",
        message: "High artifact ratio in sanitization — possible new PDF generator format",
        details: { sanitizationConfidence: sanitizationDetails },
      });
    }

    // Attach anomalies to snapshot and store
    snapshot.anomalies = [...snapshot.anomalies, ...anomalies];
    this.snapshots.push(snapshot);

    // Trim to rolling window
    if (this.snapshots.length > this.config.rollingWindowSize) {
      this.snapshots = this.snapshots.slice(-this.config.rollingWindowSize);
    }

    return anomalies;
  }

  /** Compute stats for a set of snapshots */
  private computeStats(snapshots: ParseHealthSnapshot[]): WindowStats {
    if (snapshots.length === 0) {
      return {
        sampleCount: 0,
        meanOverallConfidence: 0,
        medianOverallConfidence: 0,
        p10Confidence: 0,
        meanDispositionRates: { accepted: 0, review: 0, rejected: 0 },
        meanStageConfidences: {},
        anomalyRate: 0,
        topAnomalyTypes: [],
      };
    }

    const confidences = snapshots.map((s) => s.overallConfidence).sort((a, b) => a - b);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const median = confidences[Math.floor(confidences.length / 2)];
    const p10 = confidences[Math.floor(confidences.length * 0.1)];

    // Disposition rates
    let totalAccepted = 0, totalReview = 0, totalRejected = 0;
    for (const s of snapshots) {
      totalAccepted += s.dispositionCounts.accepted;
      totalReview += s.dispositionCounts.review;
      totalRejected += s.dispositionCounts.rejected;
    }
    const totalDispositions = totalAccepted + totalReview + totalRejected;
    const dispositionRates = totalDispositions > 0
      ? {
          accepted: totalAccepted / totalDispositions,
          review: totalReview / totalDispositions,
          rejected: totalRejected / totalDispositions,
        }
      : { accepted: 0, review: 0, rejected: 0 };

    // Stage confidences
    const stageAccum: Record<string, number[]> = {};
    for (const s of snapshots) {
      for (const [stage, conf] of Object.entries(s.stageConfidences)) {
        if (!stageAccum[stage]) stageAccum[stage] = [];
        stageAccum[stage].push(conf);
      }
    }
    const meanStageConfidences: Record<string, number> = {};
    for (const [stage, values] of Object.entries(stageAccum)) {
      meanStageConfidences[stage] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Anomaly tracking
    const anomalyCounts: Record<string, number> = {};
    let totalAnomalies = 0;
    for (const s of snapshots) {
      totalAnomalies += s.anomalies.length > 0 ? 1 : 0;
      for (const a of s.anomalies) {
        anomalyCounts[a.type] = (anomalyCounts[a.type] || 0) + 1;
      }
    }

    const topAnomalyTypes = Object.entries(anomalyCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      sampleCount: snapshots.length,
      meanOverallConfidence: Math.round(mean * 1000) / 1000,
      medianOverallConfidence: Math.round(median * 1000) / 1000,
      p10Confidence: Math.round(p10 * 1000) / 1000,
      meanDispositionRates: {
        accepted: Math.round(dispositionRates.accepted * 1000) / 1000,
        review: Math.round(dispositionRates.review * 1000) / 1000,
        rejected: Math.round(dispositionRates.rejected * 1000) / 1000,
      },
      meanStageConfidences,
      anomalyRate: Math.round((totalAnomalies / snapshots.length) * 1000) / 1000,
      topAnomalyTypes,
    };
  }

  /** Calibrate baseline from current rolling window (call when parsing quality is known-good) */
  calibrateBaseline(): WindowStats {
    this.baseline = this.computeStats(this.snapshots);
    this.baselineTimestamp = Date.now();
    return this.baseline;
  }

  /** Get current rolling window stats */
  getCurrentStats(): WindowStats {
    return this.computeStats(this.snapshots);
  }

  /** Detect drift by comparing current window to baseline */
  detectDrift(): DriftReport {
    const current = this.getCurrentStats();
    const baseline = this.baseline || current; // If no baseline, compare to self (no drift)
    const thresholds = this.config.driftThresholds;

    const deltas: DriftReport["deltas"] = [];
    const recommendations: string[] = [];

    // Confidence drift
    const confDelta = baseline.meanOverallConfidence - current.meanOverallConfidence;
    deltas.push({
      metric: "meanOverallConfidence",
      baselineValue: baseline.meanOverallConfidence,
      currentValue: current.meanOverallConfidence,
      delta: confDelta,
      severity: confDelta >= thresholds.criticalDrop
        ? "critical"
        : confDelta >= thresholds.confidenceDrop
          ? "warning"
          : "ok",
    });
    if (confDelta >= thresholds.confidenceDrop) {
      recommendations.push(
        `Mean confidence dropped ${(confDelta * 100).toFixed(1)}% from baseline. ` +
        `Review recent low-confidence parses for new format patterns.`
      );
    }

    // Rejection rate drift
    const rejDelta = current.meanDispositionRates.rejected - baseline.meanDispositionRates.rejected;
    deltas.push({
      metric: "rejectionRate",
      baselineValue: baseline.meanDispositionRates.rejected,
      currentValue: current.meanDispositionRates.rejected,
      delta: rejDelta,
      severity: rejDelta >= thresholds.rejectionRateSpike ? "critical" : "ok",
    });
    if (rejDelta >= thresholds.rejectionRateSpike) {
      recommendations.push(
        `Rejection rate spiked by ${(rejDelta * 100).toFixed(1)}%. ` +
        `Check if new resume templates bypass sanitization or classification patterns.`
      );
    }

    // Anomaly rate drift
    const anomDelta = current.anomalyRate - baseline.anomalyRate;
    deltas.push({
      metric: "anomalyRate",
      baselineValue: baseline.anomalyRate,
      currentValue: current.anomalyRate,
      delta: anomDelta,
      severity: anomDelta >= thresholds.anomalyRateSpike ? "warning" : "ok",
    });
    if (anomDelta >= thresholds.anomalyRateSpike) {
      recommendations.push(
        `Anomaly rate increased by ${(anomDelta * 100).toFixed(1)}%. ` +
        `Inspect top anomaly types for pattern updates needed.`
      );
    }

    // Per-stage drift
    for (const [stage, baselineConf] of Object.entries(baseline.meanStageConfidences)) {
      const currentConf = current.meanStageConfidences[stage] ?? 0;
      const stageDelta = baselineConf - currentConf;
      if (stageDelta >= thresholds.confidenceDrop) {
        deltas.push({
          metric: `stage:${stage}`,
          baselineValue: baselineConf,
          currentValue: currentConf,
          delta: stageDelta,
          severity: stageDelta >= thresholds.criticalDrop ? "critical" : "warning",
        });
        recommendations.push(
          `Stage "${stage}" degraded by ${(stageDelta * 100).toFixed(1)}%. ` +
          `This stage's regex/patterns may need updating for new formats.`
        );
      }
    }

    const driftDetected = deltas.some((d) => d.severity !== "ok");

    if (!driftDetected) {
      recommendations.push("Parsing quality is stable. No drift detected.");
    }

    return {
      current,
      baseline,
      driftDetected,
      deltas,
      baselineTimestamp: this.baselineTimestamp,
      recommendations,
    };
  }

  /** Get snapshots that need human review (high anomaly or low confidence) */
  getReviewQueue(limit = 20): ParseHealthSnapshot[] {
    return this.snapshots
      .filter(
        (s) =>
          s.anomalies.length > 0 ||
          s.overallConfidence < this.config.confidenceThresholds.autoAccept
      )
      .sort((a, b) => a.overallConfidence - b.overallConfidence)
      .slice(0, limit);
  }

  /** Get the current config (for inspection/debugging) */
  getConfig(): HealthConfig {
    return { ...this.config };
  }

  /** Get snapshot count */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /** Export all snapshots (for persistence) */
  exportSnapshots(): ParseHealthSnapshot[] {
    return [...this.snapshots];
  }

  /** Import snapshots (for restoring from persistence) */
  importSnapshots(snapshots: ParseHealthSnapshot[]): void {
    this.snapshots = [...snapshots];
    if (this.snapshots.length > this.config.rollingWindowSize) {
      this.snapshots = this.snapshots.slice(-this.config.rollingWindowSize);
    }
  }
}

/** Singleton monitor instance */
let _monitor: ParsingHealthMonitor | null = null;

export function getParsingHealthMonitor(config?: Partial<HealthConfig>): ParsingHealthMonitor {
  if (!_monitor) {
    _monitor = new ParsingHealthMonitor(config);
  }
  return _monitor;
}

export function resetParsingHealthMonitor(): void {
  _monitor = null;
}
