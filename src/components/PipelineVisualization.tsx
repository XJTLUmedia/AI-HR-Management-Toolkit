"use client";

interface PipelineStage {
  name: string;
  description: string;
  status: string;
  durationMs: number;
  itemsProcessed: number;
  confidence: number;
  details: Record<string, unknown>;
}

interface ClassificationEntity {
  text: string;
  type: string;
  confidence: number;
  disambiguation?: string;
}

interface PipelineData {
  stages: PipelineStage[];
  overallConfidence: number;
  totalDurationMs: number;
  dataQuality: {
    signalToNoiseRatio: number;
    completenessScore: number;
    sectionsFound: string[];
    sectionsMissing: string[];
  };
  assumptions: Array<{
    assumption: string;
    limitation: string;
    mitigated: boolean;
  }>;
  classification: {
    totalEntities: number;
    byType: Record<string, number>;
    averageConfidence: number;
    ambiguousEntities: number;
    disambiguationApplied: number;
    entities: ClassificationEntity[];
  };
}

interface PipelineVisualizationProps {
  pipeline: PipelineData;
}

const stageIcons: Record<string, string> = {
  Ingestion: "📥",
  Sanitization: "🧹",
  Tokenization: "🔤",
  Classification: "🏷️",
  Serialization: "📦",
};

function confidenceColor(c: number): { color: string } {
  if (c >= 0.85) return { color: 'var(--success)' };
  if (c >= 0.65) return { color: 'var(--warning)' };
  return { color: 'var(--danger)' };
}

function confidenceBg(c: number): string {
  if (c >= 0.85) return 'var(--success)';
  if (c >= 0.65) return 'var(--warning)';
  return 'var(--danger)';
}

function entityTypeStyle(type: string): { bg: string; color: string } {
  const styles: Record<string, { bg: string; color: string }> = {
    SKILL: { bg: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' },
    EMAIL: { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' },
    PHONE: { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' },
    URL: { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' },
    JOB_TITLE: { bg: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' },
    ORGANIZATION: { bg: 'color-mix(in srgb, var(--primary-dark) 12%, transparent)', color: 'var(--primary-dark)' },
    EDUCATION_DEGREE: { bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' },
    METRIC: { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' },
    DATE: { bg: 'var(--surface-secondary)', color: 'var(--muted)' },
    LOCATION: { bg: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' },
    PERSON: { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' },
    CERTIFICATION: { bg: 'color-mix(in srgb, var(--primary-light) 15%, transparent)', color: 'var(--primary-light)' },
  };
  return styles[type] || { bg: 'var(--surface-secondary)', color: 'var(--muted)' };
}

export function PipelineVisualization({ pipeline }: PipelineVisualizationProps) {
  return (
    <div className="space-y-6">
      {/* Overall Pipeline Health */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Pipeline Health
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
              5-node atomic deconstruction · {pipeline.totalDurationMs.toFixed(1)}ms total
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={confidenceColor(pipeline.overallConfidence)}>
              {Math.round(pipeline.overallConfidence * 100)}%
            </p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>confidence</p>
          </div>
        </div>

        {/* Data Quality Bar */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>Signal-to-Noise</span>
              <span style={confidenceColor(pipeline.dataQuality.signalToNoiseRatio)}>
                {Math.round(pipeline.dataQuality.signalToNoiseRatio * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full progress-animated"
                style={{ width: `${Math.round(pipeline.dataQuality.signalToNoiseRatio * 100)}%`, background: confidenceBg(pipeline.dataQuality.signalToNoiseRatio) }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>Completeness</span>
              <span style={confidenceColor(pipeline.dataQuality.completenessScore)}>
                {Math.round(pipeline.dataQuality.completenessScore * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full progress-animated"
                style={{ width: `${Math.round(pipeline.dataQuality.completenessScore * 100)}%`, background: confidenceBg(pipeline.dataQuality.completenessScore) }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Stages */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Pipeline Stages
        </h3>
        <div className="space-y-2">
          {pipeline.stages.map((stage, i) => (
            <div
              key={stage.name}
              className="rounded-xl p-4 transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-base" style={{ background: 'var(--surface-secondary)' }}>
                    {stageIcons[stage.name] || "⚙️"}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {i + 1}. {stage.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {stage.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-semibold" style={confidenceColor(stage.confidence)}>
                      {Math.round(stage.confidence * 100)}%
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>confidence</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>
                      {stage.durationMs.toFixed(1)}ms
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{stage.itemsProcessed} items</p>
                  </div>
                </div>
              </div>
              {/* Stage connector line */}
              {i < pipeline.stages.length - 1 && (
                <div className="ml-4 mt-2 flex items-center gap-1">
                  <div className="h-4 w-px" style={{ background: 'var(--border)' }} />
                  <svg className="h-3 w-3" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Classified Entities */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Classified Entities ({pipeline.classification.totalEntities})
        </h3>
        <div className="mb-3 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          {Object.entries(pipeline.classification.byType).map(([type, count]) => {
            const s = entityTypeStyle(type);
            return (
              <span key={type} className="flex items-center gap-1">
                <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>
                  {type}
                </span>
                <span>×{count}</span>
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {pipeline.classification.entities.map((entity, i) => {
            const s = entityTypeStyle(entity.type);
            return (
              <span
                key={`${entity.text}-${entity.type}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: s.bg, color: s.color }}
                title={entity.disambiguation || `${entity.type} · ${Math.round(entity.confidence * 100)}% confidence`}
              >
                {entity.text}
                <span className="text-[10px] opacity-70">
                  {Math.round(entity.confidence * 100)}%
                </span>
                {entity.disambiguation && (
                  <span className="text-[10px]" title={entity.disambiguation}>⚡</span>
                )}
              </span>
            );
          })}
        </div>
        {pipeline.classification.ambiguousEntities > 0 && (
          <p className="mt-2.5 text-xs" style={{ color: 'var(--warning)' }}>
            ⚠ {pipeline.classification.ambiguousEntities} ambiguous entities detected · {pipeline.classification.disambiguationApplied} resolved via domain disambiguation
          </p>
        )}
      </section>

      {/* Missing Sections */}
      {pipeline.dataQuality.sectionsMissing.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Missing Sections
          </h3>
          <div className="flex flex-wrap gap-2">
            {pipeline.dataQuality.sectionsMissing.map((section) => (
              <span
                key={section}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}
              >
                ✕ {section}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Assumption Audit */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Assumption Audit
        </h3>
        <div className="space-y-2">
          {pipeline.assumptions.map((assumption, i) => (
            <div
              key={i}
              className="rounded-xl p-3.5 text-xs"
              style={{
                background: assumption.mitigated
                  ? 'color-mix(in srgb, var(--success) 6%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 6%, transparent)',
                border: `1px solid ${assumption.mitigated
                  ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                  : 'color-mix(in srgb, var(--warning) 15%, transparent)'}`,
              }}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 min-w-fit">
                  {assumption.mitigated ? "✅" : "⚠️"}
                </span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {assumption.assumption}
                  </p>
                  <p className="mt-0.5" style={{ color: 'var(--muted)' }}>
                    {assumption.limitation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
