import { generateText, Output } from "ai";
import { getModel, type ModelConfig } from "@/lib/ai-model";
import { z } from "zod";
import {
  extractMetrics,
  extractDates,
  detectSections,
  estimateYearsOfExperience,
} from "@/lib/analysis";

const ExperienceResultSchema = z.object({
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      current: z.boolean(),
      description: z.string(),
      highlights: z.array(z.string()),
      achievements: z.array(
        z.object({
          description: z.string(),
          metric: z.string().optional(),
          impact: z.enum(["low", "medium", "high"]).optional(),
        })
      ),
      technologies: z.array(z.string()),
    })
  ),
  totalYearsOfExperience: z.number(),
});

export const extractExperienceTool = {
  name: "extract_experience",
  description:
    "Extract work experience from resume text using algorithmic date/metrics extraction combined with AI structuring. Uses pattern matching for metrics, date ranges, and section detection before AI refinement.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
      provider: {
        type: "string",
        description: "AI provider (openai, anthropic, google, deepseek, glm, qwen, openrouter, opencodezen)",
      },
      apiKey: {
        type: "string",
        description: "API key for the chosen provider (optional, falls back to server env)",
      },
      model: {
        type: "string",
        description: "Model name (optional, uses provider default)",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: {
    resumeText: string;
    provider?: string;
    apiKey?: string;
    model?: string;
  }) => {
    // Step 1: Algorithmic pre-extraction
    const metrics = extractMetrics(args.resumeText);
    const dates = extractDates(args.resumeText);
    const sections = detectSections(args.resumeText);
    const algorithmicYears = estimateYearsOfExperience(args.resumeText);
    const experienceSection = sections.find((s) => s.name === "experience");

    const modelConfig: ModelConfig = {
      provider: args.provider as ModelConfig["provider"],
      apiKey: args.apiKey,
      model: args.model,
    };

    // Step 2: LLM refinement with algorithmic context
    const { output: object } = await generateText({
      model: getModel(modelConfig),
      output: Output.object({ schema: ExperienceResultSchema }),
      prompt: `Extract all work experience entries from the following resume text. You have algorithmic pre-analysis to assist you.

ALGORITHMIC PRE-ANALYSIS:
- Date ranges found: ${dates.ranges.map((r) => r.raw).join("; ") || "None detected"}
- Standalone dates: ${dates.standalone.join(", ") || "None"}
- Estimated total years: ${algorithmicYears}
- Metrics found: ${JSON.stringify(metrics)}
- Experience section detected: ${experienceSection ? "Yes" : "No"}
${experienceSection ? `- Experience section preview: ${experienceSection.content.slice(0, 800)}` : ""}

INSTRUCTIONS:
1. Use the detected date ranges to identify employment periods
2. Use the detected metrics (percentages, dollar amounts, team sizes) to populate achievements
3. Cross-verify your totalYearsOfExperience against the algorithmic estimate of ${algorithmicYears} years
4. Focus on ACHIEVEMENTS over RESPONSIBILITIES — convert vague statements into impact
5. Rate impact as low/medium/high based on scope and measurability

Resume text:
${args.resumeText}`,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...object,
            algorithmicAnalysis: {
              detectedDateRanges: dates.ranges.length,
              detectedMetrics: metrics,
              estimatedYears: algorithmicYears,
            },
          }),
        },
      ],
    };
  },
};
