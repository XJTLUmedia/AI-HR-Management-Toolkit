import { generateText, Output } from "ai";
import { getModel, type ModelConfig } from "@/lib/ai-model";
import { JobMatchSchema } from "@/lib/schemas/resume";
import {
  calculateSimilarity,
  extractKeywords,
  scoreSkillMatch,
} from "@/lib/analysis";

export const matchJobTool = {
  name: "match_job",
  description:
    "Match a resume against a job description using cosine similarity, Jaccard index, TF-IDF keyword analysis, and AI assessment. Returns algorithmic scores combined with AI-refined compatibility analysis.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
      jobDescription: {
        type: "string",
        description: "The job description to match against",
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
    required: ["resumeText", "jobDescription"],
  },
  handler: async (args: {
    resumeText: string;
    jobDescription: string;
    provider?: string;
    apiKey?: string;
    model?: string;
  }) => {
    // Step 1: Algorithmic similarity analysis
    const similarity = calculateSimilarity(args.resumeText, args.jobDescription);
    const resumeKeywords = extractKeywords(args.resumeText);
    const jobKeywords = extractKeywords(args.jobDescription);

    // Extract skill-like terms from job and resume for skill matching
    const jobSkillTerms = jobKeywords.keywords.slice(0, 25).map((k) => k.term);
    const resumeSkillTerms = resumeKeywords.keywords.slice(0, 40).map((k) => k.term);
    const skillMatch = scoreSkillMatch(resumeSkillTerms, jobSkillTerms);

    const algorithmicScore = Math.round(similarity.weightedScore * 100);

    const modelConfig: ModelConfig = {
      provider: args.provider as ModelConfig["provider"],
      apiKey: args.apiKey,
      model: args.model,
    };

    // Step 2: LLM refinement with full algorithmic context
    const { output: object } = await generateText({
      model: getModel(modelConfig),
      output: Output.object({ schema: JobMatchSchema }),
      prompt: `Analyze how well this resume matches the given job description. You have comprehensive algorithmic analysis to assist you.

ALGORITHMIC ANALYSIS:
- Cosine similarity: ${(similarity.cosine * 100).toFixed(1)}%
- Jaccard similarity: ${(similarity.jaccard * 100).toFixed(1)}%
- Keyword match rate: ${(similarity.keywordOverlap.matchRate * 100).toFixed(1)}%
- Weighted algorithmic score: ${algorithmicScore}/100
- Matched keywords: ${similarity.keywordOverlap.matched.slice(0, 20).join(", ")}
- Missing keywords: ${similarity.keywordOverlap.missing.slice(0, 20).join(", ")}
- Skill match score: ${skillMatch.score}/100
- Matched skills: ${skillMatch.matched.join(", ")}
- Missing skills: ${skillMatch.missing.join(", ")}

INSTRUCTIONS:
1. Use the algorithmic score (${algorithmicScore}) as a baseline, adjust based on qualitative assessment
2. The keyword overlap shows specific matches/gaps — incorporate these into your analysis
3. The cosine/Jaccard scores measure document-level similarity — use for overall fit assessment
4. Provide specific improvement suggestions referencing the MISSING keywords
5. Your final score should be within ±15 points of the algorithmic baseline unless you have strong reasons

Resume:
${args.resumeText}

Job Description:
${args.jobDescription}`,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ...object,
            algorithmicScores: {
              cosineSimilarity: Math.round(similarity.cosine * 100),
              jaccardSimilarity: Math.round(similarity.jaccard * 100),
              keywordMatchRate: Math.round(similarity.keywordOverlap.matchRate * 100),
              weightedScore: algorithmicScore,
              skillMatchScore: skillMatch.score,
              matchedKeywords: similarity.keywordOverlap.matched.slice(0, 20),
              missingKeywords: similarity.keywordOverlap.missing.slice(0, 20),
            },
          }),
        },
      ],
    };
  },
};
