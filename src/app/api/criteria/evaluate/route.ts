import { NextRequest, NextResponse } from "next/server";
import { parseResume, type FileType } from "@/lib/parser";
import { type AIProvider } from "@/lib/ai-model";
import { ResumeSchema } from "@/lib/schemas/resume";
import { AssessmentCriteriaSchema } from "@/lib/schemas/criteria";
import { generateStructuredObject } from "@/lib/structured-output";
import { assessCandidate } from "@/lib/analysis";
import { estimateYearsOfExperience } from "@/lib/analysis";

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

    if (!apiKey || !provider || !model) {
      return NextResponse.json(
        { error: "API key, provider, and model are required." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const urlInput = formData.get("url") as string | null;
    const criteriaRaw = formData.get("criteria") as string | null;

    if (!criteriaRaw) {
      return NextResponse.json(
        { error: "Assessment criteria JSON is required in the 'criteria' form field." },
        { status: 400 }
      );
    }

    // Parse & validate criteria
    let criteria;
    try {
      criteria = AssessmentCriteriaSchema.parse(JSON.parse(criteriaRaw));
    } catch {
      return NextResponse.json(
        { error: "Invalid assessment criteria format." },
        { status: 400 }
      );
    }

    // Parse resume
    let text: string;
    if (urlInput) {
      const parsed = await parseResume(urlInput, "url");
      text = parsed.text;
    } else if (file) {
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
          { error: "Unsupported file type." },
          { status: 400 }
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size must be under 10MB." },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseResume(buffer.toString("base64"), fileType);
      text = parsed.text;
    } else {
      return NextResponse.json(
        { error: "No file or URL provided." },
        { status: 400 }
      );
    }

    // Generate structured resume via AI
    const structured = await generateStructuredObject({
      config: { provider, apiKey, model },
      schema: ResumeSchema,
      prompt: `Parse the following resume text into a structured format. Extract contact info, summary, skills with proficiency, experience, education, certifications, and projects.\n\nResume:\n${text}`,
    });

    const estimatedYears = estimateYearsOfExperience(text);

    // Run assessment against criteria
    const assessment = assessCandidate(structured, criteria, estimatedYears);

    return NextResponse.json({
      structured,
      assessment,
      criteria: { name: criteria.name, description: criteria.description },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assessment failed" },
      { status: 500 }
    );
  }
}
