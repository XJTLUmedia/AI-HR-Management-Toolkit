"use client";

import type { AssessmentResult as AssessmentResultType } from "@/lib/analysis/criteria-scorer";

interface AssessmentResultProps {
  result: AssessmentResultType;
  criteriaName?: string;
}

function decisionBadge(decision: string) {
  const styles: Record<string, { bg: string; color: string }> = {
    pass: { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' },
    review: { bg: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' },
    reject: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' },
  };
  const s = styles[decision] ?? styles.review;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {decision.toUpperCase()}
    </span>
  );
}

function scoreColor(score: number): { color: string } {
  if (score >= 70) return { color: 'var(--success)' };
  if (score >= 50) return { color: 'var(--warning)' };
  return { color: 'var(--danger)' };
}

function barBg(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

export function AssessmentResultDisplay({ result, criteriaName }: AssessmentResultProps) {
  const enabledAxes = result.axes.filter((a) => a.enabled);

  return (
    <div className="space-y-5">
      {/* Overall Score */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {criteriaName ? `Assessment: ${criteriaName}` : "Assessment Result"}
            </p>
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="text-3xl font-bold" style={scoreColor(result.overallScore)}>
                {result.overallScore}
              </span>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>/ 100</span>
              {decisionBadge(result.decision)}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              {result.summary}
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  strokeWidth="6"
                  stroke="var(--border)"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={`${(result.overallScore / 100) * 175.93} 175.93`}
                  strokeLinecap="round"
                  stroke={barBg(result.overallScore)}
                  className="animate-[score-ring_1s_ease-out]"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                style={scoreColor(result.overallScore)}
              >
                {result.overallScore}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-axis breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Score Breakdown
        </h4>
        {enabledAxes.map((axis) => (
          <div key={axis.axis} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                {axis.axis}
              </span>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--muted)' }}>{axis.weight}% weight</span>
                <span className="font-semibold" style={scoreColor(axis.score)}>
                  {axis.score}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full progress-animated"
                style={{ width: `${axis.score}%`, background: barBg(axis.score) }}
              />
            </div>
            {axis.details && Object.keys(axis.details).length > 0 && (
              <details className="text-xs" style={{ color: 'var(--muted)' }}>
                <summary className="cursor-pointer transition-colors hover:opacity-80">
                  Details
                </summary>
                <div className="mt-1 ml-2 space-y-0.5">
                  {Object.entries(axis.details).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-medium">{key}:</span>{" "}
                      {Array.isArray(value)
                        ? value.length > 0
                          ? value.join(", ")
                          : "—"
                        : String(value)}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
