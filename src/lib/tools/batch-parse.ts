import { parseResume, type FileType } from "@/lib/parser";
import { generateText, Output } from "ai";
import { getModel, type AIProvider } from "@/lib/ai-model";
import { ResumeSchema } from "@/lib/schemas/resume";
import {
  runPipeline,
  type ClassifiedEntity,
} from "@/lib/analysis";

export const batchParseTool = {
  name: "batch_parse_resumes",
  description:
    "Parse multiple resumes at once. Takes an array of file objects with base64-encoded content and file types. Returns structured data for each resume.",
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
            content: { type: "string", description: "Base64-encoded file content" },
            fileType: {
              type: "string",
              enum: ["pdf", "docx", "txt", "md"],
              description: "File type",
            },
          },
          required: ["name", "content", "fileType"],
        },
      },
      provider: { type: "string", description: "AI provider (optional)" },
      apiKey: { type: "string", description: "API key (optional)" },
      model: { type: "string", description: "Model name (optional)" },
    },
    required: ["files"],
  },
  handler: async (args: {
    files: Array<{ name: string; content: string; fileType: FileType }>;
    provider?: string;
    apiKey?: string;
    model?: string;
  }) => {
    const results: Array<{
      fileName: string;
      success: boolean;
      structured?: unknown;
      error?: string;
    }> = [];

    for (const file of args.files) {
      try {
        const parsed = await parseResume(file.content, file.fileType);
        const pipeline = runPipeline(parsed.text);
        const keywords = pipeline.tokenization;
        const classification = pipeline.classification;

        const { output: structured } = await generateText({
          model: getModel({
            provider: args.provider as AIProvider | undefined,
            apiKey: args.apiKey,
            model: args.model,
          }),
          output: Output.object({ schema: ResumeSchema }),
          prompt: `Parse the following resume text into a structured format.

ALGORITHMIC PRE-ANALYSIS:
- Pipeline confidence: ${Math.round(pipeline.overallConfidence * 100)}%
- Top keywords: ${keywords.keywords.slice(0, 15).map((k: { term: string }) => k.term).join(", ")}
- Estimated years: ${pipeline.patternMatching.estimatedYears}
- Classified entities: ${classification.summary.totalEntities}
- Skills detected: ${classification.entities.filter((e: ClassifiedEntity) => e.type === "SKILL").map((e: ClassifiedEntity) => e.text).join(", ")}

Extract contact info, summary, skills, experience, education, certifications, projects, and languages.

Resume text:
${pipeline.cleanText}`,
        });

        results.push({ fileName: file.name, success: true, structured });
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
          }),
        },
      ],
    };
  },
};
