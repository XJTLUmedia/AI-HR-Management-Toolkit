import { NextRequest, NextResponse } from "next/server";
import { parseResume, type FileType } from "@/lib/parser";
import { type AIProvider } from "@/lib/ai-model";
import { ResumeSchema } from "@/lib/schemas/resume";
import { generateStructuredObject } from "@/lib/structured-output";
import {
  runPipeline,
  type SectionBoundary,
  type ClassifiedEntity,
  type PipelineStage,
} from "@/lib/analysis";

export const maxDuration = 300;

const MIME_TO_FILETYPE: Record<string, FileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

function getFileType(file: File): FileType | null {
  let fileType: FileType | undefined = MIME_TO_FILETYPE[file.type];
  if (!fileType) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") fileType = "pdf";
    else if (ext === "docx") fileType = "docx";
    else if (ext === "txt") fileType = "txt";
    else if (ext === "md" || ext === "markdown") fileType = "md";
  }
  return fileType ?? null;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") || undefined;
  const provider = (req.headers.get("x-ai-provider") as AIProvider) || undefined;
  const model = req.headers.get("x-ai-model") || undefined;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key is required. Please configure your AI provider key in the UI." },
      { status: 401 }
    );
  }

  if (!provider) {
    return NextResponse.json(
      { error: "AI provider is required. Please choose a provider in the UI." },
      { status: 400 }
    );
  }

  if (!model) {
    return NextResponse.json(
      { error: "AI model is required. Fetch live models and select one in the UI." },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > 20) {
    return NextResponse.json({ error: "Maximum 20 files per batch" }, { status: 400 });
  }

  const results: Array<{
    fileName: string;
    success: boolean;
    rawText?: string;
    structured?: Record<string, unknown>;
    pipeline?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      const fileType = getFileType(file);
      if (!fileType) {
        results.push({ fileName: file.name, success: false, error: "Unsupported file type" });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        results.push({ fileName: file.name, success: false, error: "File exceeds 10MB limit" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const parsed = await parseResume(base64, fileType);
      const pipeline = runPipeline(parsed.text);

      const keywords = pipeline.tokenization;
      const metrics = pipeline.patternMatching.metrics;
      const sections = pipeline.patternMatching.sections;
      const yearsOfExperience = pipeline.patternMatching.estimatedYears;
      const classification = pipeline.classification;

      const structured = await generateStructuredObject({
        config: { provider, apiKey, model },
        schema: ResumeSchema,
        prompt: `Parse the following resume text into a structured format optimized for recruiter review.

ALGORITHMIC PRE-ANALYSIS (5-Node Pipeline):
- Pipeline confidence: ${Math.round(pipeline.overallConfidence * 100)}%
- Top keywords (TF-IDF): ${keywords.keywords.slice(0, 15).map((k: { term: string }) => k.term).join(", ")}
- Estimated years of experience: ${yearsOfExperience}
- Metrics found: ${metrics.percentages.join(", ")} | ${metrics.dollarAmounts.join(", ")} | Team sizes: ${metrics.teamSizes.join(", ")}
- Detected sections: ${sections.map((s: SectionBoundary) => s.name).join(", ")}
- Classified entities: ${classification.summary.totalEntities} (${classification.summary.ambiguousEntities} ambiguous, ${classification.summary.disambiguationApplied} disambiguated)
- Skills detected: ${classification.entities.filter((e: ClassifiedEntity) => e.type === "SKILL").map((e: ClassifiedEntity) => `${e.text} (${Math.round(e.confidence * 100)}%)`).join(", ")}

Extract:
- Contact info (including LinkedIn, GitHub, portfolio links)
- Professional summary
- Skills with proficiency levels and usage context
- Work experience with quantifiable achievements and metrics
- Education
- Certifications with issuer and dates
- Projects with technologies and highlights
- Languages

Resume text:
${pipeline.cleanText}`,
      });

      results.push({
        fileName: file.name,
        success: true,
        rawText: parsed.text,
        structured: structured as unknown as Record<string, unknown>,
        pipeline: {
          overallConfidence: pipeline.overallConfidence,
          totalDurationMs: pipeline.totalDurationMs,
          stages: pipeline.stages.map((s: PipelineStage) => ({
            name: s.name,
            status: s.status,
            durationMs: Math.round(s.durationMs * 100) / 100,
            confidence: Math.round(s.confidence * 100) / 100,
          })),
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

  return NextResponse.json({
    total: files.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
