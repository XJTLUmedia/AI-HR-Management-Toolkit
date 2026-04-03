import { generateText, Output } from "ai";
import { getModel, type ModelConfig } from "@/lib/ai-model";
import { z } from "zod";
import { extractKeywords, detectSections } from "@/lib/analysis";

const SkillsResultSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.enum([
        "programming_language",
        "framework",
        "database",
        "devops",
        "soft_skill",
        "tool",
        "methodology",
        "other",
      ]),
      proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
      context: z.string().optional(),
    })
  ),
  categories: z.record(z.string(), z.array(z.string())),
});

export const extractSkillsTool = {
  name: "extract_skills",
  description:
    "Extract skills from resume text using algorithmic keyword analysis combined with AI categorization. Uses TF-IDF keyword extraction and section detection before AI refinement.",
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
    // Step 1: Algorithmic analysis
    const keywords = extractKeywords(args.resumeText);
    const sections = detectSections(args.resumeText);
    const skillsSection = sections.find((s) => s.name === "skills");

    // Extract algorithmically-detected skill candidates from TF-IDF
    const algorithmicSkills = keywords.keywords
      .slice(0, 30)
      .map((k) => k.term);
    const algorithmicBigrams = keywords.bigrams
      .slice(0, 15)
      .map((b) => b.term);

    const modelConfig: ModelConfig = {
      provider: args.provider as ModelConfig["provider"],
      apiKey: args.apiKey,
      model: args.model,
    };

    // Step 2: LLM refinement with algorithmic context
    const { output: object } = await generateText({
      model: getModel(modelConfig),
      output: Output.object({ schema: SkillsResultSchema }),
      prompt: `Extract all skills from the following resume text. You have algorithmic pre-analysis to assist you.

ALGORITHMIC PRE-ANALYSIS:
- Top keywords by TF-IDF: ${algorithmicSkills.join(", ")}
- Top bigrams: ${algorithmicBigrams.join(", ")}
- Skills section detected: ${skillsSection ? "Yes" : "No"}
${skillsSection ? `- Skills section content: ${skillsSection.content.slice(0, 500)}` : ""}

INSTRUCTIONS:
1. Use the algorithmic keywords as a starting point — validate and categorize each one
2. Add any skills the algorithm missed (soft skills, implied skills)
3. For each skill: categorize, estimate proficiency, provide usage context
4. For soft skills, only include those with evidence in the resume
5. Cross-reference TF-IDF scores: high-frequency terms likely indicate core skills

Resume text:
${args.resumeText}`,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...object,
            algorithmicKeywords: algorithmicSkills,
          }),
        },
      ],
    };
  },
};
