import { parseResume, type FileType } from "@/lib/parser";
import { runPipeline, type ClassifiedEntity } from "@/lib/analysis";

export const mcpBatchParseTool = {
  name: "batch_parse_resumes",
  description:
    "Parse multiple resume files at once and run the full algorithmic pipeline on each. Returns raw text, pipeline analysis, keywords, entities, and confidence scores for each file. The LLM client should interpret and structure the results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      files: {
        type: "array",
        description: "Array of files to parse",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name" },
            content: {
              type: "string",
              description: "Base64-encoded file content",
            },
            fileType: {
              type: "string",
              enum: ["pdf", "docx", "txt", "md"],
              description: "File type",
            },
          },
          required: ["name", "content", "fileType"],
        },
      },
    },
    required: ["files"],
  },
  handler: async (args: {
    files: Array<{ name: string; content: string; fileType: FileType }>;
  }) => {
    if (args.files.length > 20) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Maximum 20 files per batch. Received " + args.files.length + "." }) }],
      };
    }

    const results: Array<{
      fileName: string;
      success: boolean;
      rawText?: string;
      pipeline?: {
        overallConfidence: number;
        totalDurationMs: number;
        topKeywords: string[];
        estimatedYears: number;
        detectedSections: string[];
        skillEntities: string[];
        cleanText: string;
      };
      error?: string;
    }> = [];

    for (const file of args.files) {
      try {
        const parsed = await parseResume(file.content, file.fileType);
        const pipeline = runPipeline(parsed.text);

        results.push({
          fileName: file.name,
          success: true,
          rawText: parsed.text,
          pipeline: {
            overallConfidence: Math.round(pipeline.overallConfidence * 100) / 100,
            totalDurationMs: Math.round(pipeline.totalDurationMs * 100) / 100,
            topKeywords: pipeline.tokenization.keywords
              .slice(0, 15)
              .map((k: { term: string }) => k.term),
            estimatedYears: pipeline.patternMatching.estimatedYears,
            detectedSections: pipeline.patternMatching.sections.map(
              (s: { name: string }) => s.name
            ),
            skillEntities: pipeline.classification.entities
              .filter((e: ClassifiedEntity) => e.type === "SKILL")
              .map((e: ClassifiedEntity) => e.text),
            cleanText: pipeline.cleanText,
          },
        });
      } catch (err) {
        results.push({
          fileName: file.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            total: args.files.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
            next_steps: [
              "Review each resume's pipeline confidence to identify low-quality parses",
              "Compare top keywords across resumes to rank candidates by relevance",
              "Use analyze_resume with aspects=['similarity'] and a job description to score each candidate",
              "For detailed analysis of a specific resume, call inspect_pipeline with its rawText",
              "Use export_results to save the structured results as JSON or CSV",
            ],
          }),
        },
      ],
    };
  },
};
