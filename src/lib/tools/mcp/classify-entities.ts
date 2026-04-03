/**
 * MCP Tool: classify_entities
 * Exposes the full NER classifier directly — 15 entity types with
 * confidence scoring, domain-aware disambiguation, and summary statistics.
 * 100% algorithmic — no AI calls.
 */

import {
  classifyEntities,
  type ClassifiedEntity,
  type EntityType,
} from "@/lib/analysis";

export const mcpClassifyEntitiesTool = {
  name: "classify_entities",
  description:
    "Run Named Entity Recognition on resume text. Extracts 12 entity types (PERSON, ORGANIZATION, DATE, SKILL, LOCATION, EMAIL, PHONE, URL, EDUCATION_DEGREE, CERTIFICATION, JOB_TITLE, METRIC) with per-entity confidence scores (0-1) and domain-aware disambiguation (e.g., Java the language vs Java the island). Returns classified entities grouped by type, confidence statistics, and ambiguity analysis. 100% algorithmic — no AI calls needed.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
      minConfidence: {
        type: "number",
        description:
          "Minimum confidence threshold (0-1) to include an entity. Default: 0 (all entities).",
      },
      entityTypes: {
        type: "array",
        items: { type: "string" },
        description:
          "Filter to specific entity types (e.g., ['SKILL', 'JOB_TITLE']). Default: all types.",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: {
    resumeText: string;
    minConfidence?: number;
    entityTypes?: string[];
  }) => {
    const result = classifyEntities(args.resumeText);

    // Apply filters
    let entities = result.entities;

    if (args.minConfidence !== undefined && args.minConfidence > 0) {
      entities = entities.filter((e) => e.confidence >= args.minConfidence!);
    }

    if (args.entityTypes && args.entityTypes.length > 0) {
      const typeSet = new Set(
        args.entityTypes.map((t) => t.toUpperCase())
      );
      entities = entities.filter((e) => typeSet.has(e.type));
    }

    // Group entities by type
    const grouped: Record<string, Array<{ text: string; confidence: number; context: string; disambiguation?: string }>> = {};
    for (const e of entities) {
      if (!grouped[e.type]) grouped[e.type] = [];
      grouped[e.type].push({
        text: e.text,
        confidence: Math.round(e.confidence * 100) / 100,
        context: e.context,
        ...(e.disambiguation ? { disambiguation: e.disambiguation } : {}),
      });
    }

    // Confidence distribution
    const highConfidence = entities.filter((e) => e.confidence >= 0.8).length;
    const mediumConfidence = entities.filter(
      (e) => e.confidence >= 0.6 && e.confidence < 0.8
    ).length;
    const lowConfidence = entities.filter((e) => e.confidence < 0.6).length;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            totalEntities: entities.length,
            entitiesByType: grouped,
            summary: {
              ...result.summary,
              filteredCount: entities.length,
              originalCount: result.entities.length,
            },
            confidenceDistribution: {
              high: highConfidence,
              medium: mediumConfidence,
              low: lowConfidence,
            },
            disambiguated: entities
              .filter((e) => e.disambiguation)
              .map((e) => ({
                text: e.text,
                type: e.type,
                confidence: e.confidence,
                reason: e.disambiguation,
              })),
          }),
        },
      ],
    };
  },
};
