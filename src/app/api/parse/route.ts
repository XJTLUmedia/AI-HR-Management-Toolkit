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

export const maxDuration = 60;

const MIME_TO_FILETYPE: Record<string, FileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

export async function POST(req: NextRequest) {
  try {
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
    const file = formData.get("file") as File | null;
    const urlInput = formData.get("url") as string | null;

    // URL-based input
    if (urlInput) {
      const parsed = await parseResume(urlInput, "url");
      return await generateStructuredResume(parsed.text, parsed.pageCount, { provider, apiKey, model });
    }

    if (!file) {
      return NextResponse.json({ error: "No file or URL provided" }, { status: 400 });
    }

    // Determine file type from MIME type or extension
    let fileType: FileType | undefined = MIME_TO_FILETYPE[file.type];
    if (!fileType) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") fileType = "pdf";
      else if (ext === "docx") fileType = "docx";
      else if (ext === "txt") fileType = "txt";
      else if (ext === "md" || ext === "markdown") fileType = "md";
    }

    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: PDF, DOCX, TXT, MD" },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const parsed = await parseResume(base64, fileType);

    return await generateStructuredResume(parsed.text, parsed.pageCount, { provider, apiKey, model });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse resume" },
      { status: 500 }
    );
  }
}

async function generateStructuredResume(
  text: string,
  pageCount: number | undefined,
  config: { provider: AIProvider; apiKey: string; model: string }
) {
  // Run the full 5-node pipeline
  const pipeline = runPipeline(text);

  const keywords = pipeline.tokenization;
  const metrics = pipeline.patternMatching.metrics;
  const sections = pipeline.patternMatching.sections;
  const yearsOfExperience = pipeline.patternMatching.estimatedYears;
  const classification = pipeline.classification;

  const structured = await generateStructuredObject({
    config,
    schema: ResumeSchema,
    prompt: `Parse the following resume text into a structured format optimized for recruiter review.

ALGORITHMIC PRE-ANALYSIS (5-Node Pipeline):
- Pipeline confidence: ${Math.round(pipeline.overallConfidence * 100)}%
- Top keywords (TF-IDF): ${keywords.keywords.slice(0, 15).map((k: { term: string }) => k.term).join(", ")}
- Estimated years of experience: ${yearsOfExperience}
- Metrics found: ${metrics.percentages.join(", ")} | ${metrics.dollarAmounts.join(", ")} | Team sizes: ${metrics.teamSizes.join(", ")}
- Detected sections: ${sections.map((s: SectionBoundary) => s.name).join(", ")}
- Classified entities: ${classification.summary.totalEntities} (${classification.summary.ambiguousEntities} ambiguous, ${classification.summary.disambiguationApplied} disambiguated)
- Skills detected (with confidence): ${classification.entities.filter((e: ClassifiedEntity) => e.type === "SKILL").map((e: ClassifiedEntity) => `${e.text} (${Math.round(e.confidence * 100)}%)`).join(", ")}
- Data quality: signal-to-noise ${Math.round(pipeline.serialization.dataQuality.signalToNoiseRatio * 100)}%, completeness ${Math.round(pipeline.serialization.dataQuality.completenessScore * 100)}%

DISAMBIGUATION NOTES:
${classification.entities.filter((e: ClassifiedEntity) => e.disambiguation).map((e: ClassifiedEntity) => `- ${e.text}: ${e.disambiguation}`).join("\n") || "None needed"}

ASSUMPTIONS & LIMITATIONS:
${pipeline.serialization.assumptions.map((a: { assumption: string; limitation: string; mitigated: boolean }) => `- ${a.assumption}: ${a.limitation} [${a.mitigated ? "MITIGATED" : "UNMITIGATED"}]`).join("\n")}

Extract:
- Contact info (including LinkedIn, GitHub, portfolio links)
- Professional summary
- Skills with proficiency levels and usage context (use confidence scores to inform proficiency)
- Work experience with quantifiable achievements and metrics (prioritize impact over responsibilities)
- Education
- Certifications with issuer and dates
- Projects with technologies and highlights
- Languages

For achievements, extract specific metrics like percentages, dollar amounts, team sizes, and timeframes. Use the algorithmic metrics as ground truth.

Resume text:
${pipeline.cleanText}`,
  });

  return NextResponse.json({
    rawText: text,
    pageCount: pageCount ?? null,
    structured,
    algorithmicAnalysis: {
      topKeywords: keywords.keywords.slice(0, 10).map((k: { term: string }) => k.term),
      estimatedYears: yearsOfExperience,
      sectionsDetected: sections.map((s: SectionBoundary) => s.name),
      metricsCount: metrics.percentages.length + metrics.dollarAmounts.length + metrics.teamSizes.length,
    },
    pipeline: {
      stages: pipeline.stages.map((s: PipelineStage) => ({
        name: s.name,
        description: s.description,
        status: s.status,
        durationMs: Math.round(s.durationMs * 100) / 100,
        itemsProcessed: s.itemsProcessed,
        confidence: Math.round(s.confidence * 100) / 100,
        details: s.details,
      })),
      overallConfidence: pipeline.overallConfidence,
      totalDurationMs: pipeline.totalDurationMs,
      dataQuality: pipeline.serialization.dataQuality,
      assumptions: pipeline.serialization.assumptions,
      classification: {
        totalEntities: classification.summary.totalEntities,
        byType: classification.summary.byType,
        averageConfidence: Math.round(classification.summary.averageConfidence * 100) / 100,
        ambiguousEntities: classification.summary.ambiguousEntities,
        disambiguationApplied: classification.summary.disambiguationApplied,
        entities: classification.entities.slice(0, 30).map((e: ClassifiedEntity) => ({
          text: e.text,
          type: e.type,
          confidence: Math.round(e.confidence * 100) / 100,
          disambiguation: e.disambiguation,
        })),
      },
    },
    health: {
      parseId: pipeline.health.parseId,
      anomalies: pipeline.health.anomalies,
      dispositionCounts: pipeline.health.dispositionCounts,
      driftDetected: pipeline.health.driftDetected,
    },
  });
}
