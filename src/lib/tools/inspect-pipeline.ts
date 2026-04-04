import { runPipeline } from "@/lib/analysis";

export const inspectPipelineTool = {
  name: "inspect_pipeline",
  description:
    "Run the full 5-node atomic deconstruction pipeline (Ingestion → Sanitization → Tokenization → Classification → Serialization) on resume text. Returns stage-by-stage metrics, confidence scores, entity classification with disambiguation, data quality assessment, and assumption audit. Use this to understand HOW the parser processes a resume and WHERE confidence is low.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: { resumeText: string }) => {
    const pipeline = runPipeline(args.resumeText);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            overallConfidence: pipeline.overallConfidence,
            totalDurationMs: pipeline.totalDurationMs,
            stages: pipeline.stages.map((s) => ({
              name: s.name,
              description: s.description,
              status: s.status,
              durationMs: Math.round(s.durationMs * 100) / 100,
              itemsProcessed: s.itemsProcessed,
              confidence: Math.round(s.confidence * 100) / 100,
              details: s.details,
            })),
            classification: {
              totalEntities: pipeline.classification.summary.totalEntities,
              byType: pipeline.classification.summary.byType,
              averageConfidence: Math.round(pipeline.classification.summary.averageConfidence * 100) / 100,
              ambiguousEntities: pipeline.classification.summary.ambiguousEntities,
              disambiguationApplied: pipeline.classification.summary.disambiguationApplied,
              topEntities: pipeline.classification.entities.slice(0, 20).map((e) => ({
                text: e.text,
                type: e.type,
                confidence: Math.round(e.confidence * 100) / 100,
                disambiguation: e.disambiguation || null,
              })),
            },
            dataQuality: pipeline.serialization.dataQuality,
            coreEntities: pipeline.serialization.coreEntities,
            assumptions: pipeline.serialization.assumptions,
            sanitizationMetrics: pipeline.sanitization.metrics,
            next_steps: [
              "Review stage confidence scores — stages below 70% may need manual verification",
              "Check ambiguous entities and disambiguation results for accuracy",
              "Use analyze_resume with aspects: ['keywords'] for deeper keyword analysis if skill classification needs refinement",
              "Use analyze_resume with aspects: ['patterns'] to extract structured date ranges and metrics for experience analysis",
              "Analyze the dataQuality and assumptions to identify potential parsing issues",
            ],
          }),
        },
      ],
    };
  },
};
