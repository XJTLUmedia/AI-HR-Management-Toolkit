import { parseResume, type FileType } from "@/lib/parser";
import {
  extractKeywords,
  extractMetrics,
  extractContact,
  detectSections,
  estimateYearsOfExperience,
} from "@/lib/analysis";

export const parseResumeTool = {
  name: "parse_resume",
  description:
    "Parse a resume file (PDF, DOCX, TXT, MD) or URL and extract text with algorithmic pre-analysis including keyword extraction, metrics detection, section identification, and experience estimation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      content: {
        type: "string",
        description: "Base64-encoded file content, or a URL string when fileType is 'url'",
      },
      fileType: {
        type: "string",
        enum: ["pdf", "docx", "txt", "md", "url"],
        description: "File type: pdf, docx, txt, md, or url",
      },
    },
    required: ["content", "fileType"],
  },
  handler: async (args: { content: string; fileType: FileType }) => {
    const result = await parseResume(args.content, args.fileType);
    const text = result.text;

    // Algorithmic pre-analysis
    const keywords = extractKeywords(text);
    const metrics = extractMetrics(text);
    const contact = extractContact(text);
    const sections = detectSections(text);
    const yearsOfExperience = estimateYearsOfExperience(text);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            rawText: text,
            pageCount: result.pageCount ?? null,
            characterCount: text.length,
            analysis: {
              topKeywords: keywords.keywords.slice(0, 20).map((k) => k.term),
              topBigrams: keywords.bigrams.slice(0, 10).map((b) => b.term),
              metrics,
              contact,
              detectedSections: sections.map((s) => s.name),
              estimatedYearsOfExperience: yearsOfExperience,
              totalTerms: keywords.totalTerms,
              uniqueTerms: keywords.uniqueTerms,
            },
            next_steps: [
              "Call inspect_pipeline with the rawText for detailed 5-stage analysis with confidence scores",
              "Call analyze_resume with aspects: ['keywords'] for deeper TF-IDF keyword analysis and skill section content",
              "Call analyze_resume with aspects: ['patterns'] for date ranges, metrics, and section-level content",
              "Call analyze_resume with aspects: ['similarity'] and a jobDescription to assess candidate fit",
            ],
          }),
        },
      ],
    };
  },
};
