import { generateText, Output } from "ai";
import { getModel, type ModelConfig } from "@/lib/ai-model";
import { ResumeSummarySchema } from "@/lib/schemas/resume";
import {
  extractKeywords,
  extractMetrics,
  detectSections,
  estimateYearsOfExperience,
  extractContact,
} from "@/lib/analysis";

export const summarizeResumeTool = {
  name: "summarize_resume",
  description:
    "Generate a recruiter-focused summary using algorithmic pre-analysis (TF-IDF keywords, metrics extraction, section detection, experience estimation) combined with AI synthesis.",
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
    // Step 1: Algorithmic pre-analysis
    const keywords = extractKeywords(args.resumeText);
    const metrics = extractMetrics(args.resumeText);
    const sections = detectSections(args.resumeText);
    const yearsOfExperience = estimateYearsOfExperience(args.resumeText);
    const contact = extractContact(args.resumeText);

    const modelConfig: ModelConfig = {
      provider: args.provider as ModelConfig["provider"],
      apiKey: args.apiKey,
      model: args.model,
    };

    // Step 2: LLM synthesis with rich algorithmic context
    const { output: object } = await generateText({
      model: getModel(modelConfig),
      output: Output.object({ schema: ResumeSummarySchema }),
      prompt: `Generate a recruiter-focused summary of the following resume. You have algorithmic pre-analysis to assist you.

ALGORITHMIC PRE-ANALYSIS:
- Top keywords (TF-IDF): ${keywords.keywords.slice(0, 15).map((k) => k.term).join(", ")}
- Top bigrams: ${keywords.bigrams.slice(0, 8).map((b) => b.term).join(", ")}
- Unique terms: ${keywords.uniqueTerms} | Total terms: ${keywords.totalTerms}
- Estimated years of experience: ${yearsOfExperience}
- Quantifiable metrics found:
  * Percentages: ${metrics.percentages.join(", ") || "None"}
  * Dollar amounts: ${metrics.dollarAmounts.join(", ") || "None"}
  * Team sizes: ${metrics.teamSizes.join(", ") || "None"}
- Detected sections: ${sections.map((s) => s.name).join(", ")}
- Contact info: ${contact.emails.length} emails, ${contact.phones.length} phones, ${contact.linkedinUrls.length} LinkedIn, ${contact.githubUrls.length} GitHub

INSTRUCTIONS:
1. Use ${yearsOfExperience} years as the experience baseline (verify against content)
2. The TF-IDF keywords indicate the candidate's core domain — use them for role matching
3. Incorporate the detected metrics as key achievements
4. The section analysis shows resume completeness — flag missing important sections
5. Provide actionable improvement areas based on what's algorithmically absent

Resume:
${args.resumeText}`,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...object,
            algorithmicInsights: {
              topKeywords: keywords.keywords.slice(0, 10).map((k) => k.term),
              estimatedYears: yearsOfExperience,
              metricsFound: {
                percentages: metrics.percentages.length,
                dollarAmounts: metrics.dollarAmounts.length,
                teamSizes: metrics.teamSizes.length,
              },
              sectionsDetected: sections.map((s) => s.name),
              resumeCompleteness: sections.length,
            },
          }),
        },
      ],
    };
  },
};
