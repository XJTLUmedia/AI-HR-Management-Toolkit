import {
  calculateSimilarity,
  extractKeywords,
  scoreSkillMatch,
  classifyEntities,
} from "@/lib/analysis";

// Skill category patterns for gap classification
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|php|kotlin|scala|rust|go|swift)\b/i, category: "programming_language" },
  { pattern: /\b(?:react|angular|vue|svelte|next\.?js|nuxt|django|flask|spring|express|fastapi|rails|laravel)\b/i, category: "framework" },
  { pattern: /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle)\b/i, category: "database" },
  { pattern: /\b(?:docker|kubernetes|aws|azure|gcp|terraform|ansible|jenkins|ci\/cd|github\s*actions)\b/i, category: "devops_cloud" },
  { pattern: /\b(?:machine\s*learning|deep\s*learning|nlp|tensorflow|pytorch|scikit[\s-]learn|keras|llm)\b/i, category: "ml_ai" },
];

function categorizeSkill(term: string): string {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(term)) return category;
  }
  return "other";
}

export const mcpComputeSimilarityTool = {
  name: "compute_similarity",
  description:
    "Compare a resume against a job description using cosine similarity, Jaccard index, TF-IDF overlap, and skill matching. Returns a computed fit tier (strong/moderate/weak/poor), per-skill gap analysis with categories, and actionable gap recommendations. No AI calls — all scoring is algorithmic.",
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
    },
    required: ["resumeText", "jobDescription"],
  },
  handler: async (args: { resumeText: string; jobDescription: string }) => {
    const similarity = calculateSimilarity(args.resumeText, args.jobDescription);
    const resumeKeywords = extractKeywords(args.resumeText);
    const jobKeywords = extractKeywords(args.jobDescription);

    const jobSkillTerms = jobKeywords.keywords.slice(0, 25).map((k) => k.term);
    const resumeSkillTerms = resumeKeywords.keywords.slice(0, 40).map((k) => k.term);
    const skillMatch = scoreSkillMatch(resumeSkillTerms, jobSkillTerms);

    // Compute fit tier
    const weightedScore = Math.round(similarity.weightedScore * 100);
    let fitTier: string;
    let fitDescription: string;
    if (weightedScore >= 70) {
      fitTier = "strong_match";
      fitDescription = "Candidate's profile strongly aligns with requirements";
    } else if (weightedScore >= 50) {
      fitTier = "moderate_match";
      fitDescription = "Candidate meets many requirements but has notable gaps";
    } else if (weightedScore >= 30) {
      fitTier = "weak_match";
      fitDescription = "Candidate has some relevant skills but significant gaps exist";
    } else {
      fitTier = "poor_match";
      fitDescription = "Candidate's profile does not align with role requirements";
    }

    // Categorize matched and missing skills
    const categorizedMatched = skillMatch.matched.map((s) => ({
      skill: s,
      category: categorizeSkill(s),
    }));
    const categorizedMissing = skillMatch.missing.map((s) => ({
      skill: s,
      category: categorizeSkill(s),
    }));

    // Group missing skills by category for gap analysis
    const gapsByCategory: Record<string, string[]> = {};
    for (const { skill, category } of categorizedMissing) {
      if (!gapsByCategory[category]) gapsByCategory[category] = [];
      gapsByCategory[category].push(skill);
    }

    // Compute per-category match rates
    const allJobSkillsCategorized = jobSkillTerms.map((t) => ({
      skill: t,
      category: categorizeSkill(t),
    }));
    const categoryStats: Record<string, { total: number; matched: number; rate: number }> = {};
    for (const { category } of allJobSkillsCategorized) {
      if (!categoryStats[category]) categoryStats[category] = { total: 0, matched: 0, rate: 0 };
      categoryStats[category].total++;
    }
    for (const { category } of categorizedMatched) {
      if (categoryStats[category]) categoryStats[category].matched++;
    }
    for (const cat of Object.keys(categoryStats)) {
      categoryStats[cat].rate = Math.round(
        (categoryStats[cat].matched / categoryStats[cat].total) * 100
      );
    }

    // Generate computed recommendations based on gaps
    const recommendations: string[] = [];
    for (const [category, skills] of Object.entries(gapsByCategory)) {
      if (skills.length >= 3) {
        recommendations.push(
          `Critical gap in ${category.replace(/_/g, " ")}: missing ${skills.join(", ")}`
        );
      } else if (skills.length > 0) {
        recommendations.push(
          `Minor gap in ${category.replace(/_/g, " ")}: missing ${skills.join(", ")}`
        );
      }
    }

    // NER-based entity overlap for additional signal
    const resumeClassification = classifyEntities(args.resumeText);
    const jobClassification = classifyEntities(args.jobDescription);
    const resumeSkillSet = new Set(
      resumeClassification.entities.filter((e) => e.type === "SKILL").map((e) => e.text.toLowerCase())
    );
    const jobSkillSet = new Set(
      jobClassification.entities.filter((e) => e.type === "SKILL").map((e) => e.text.toLowerCase())
    );
    const nerMatched = [...jobSkillSet].filter((s) => resumeSkillSet.has(s));
    const nerMissing = [...jobSkillSet].filter((s) => !resumeSkillSet.has(s));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            // Top-level assessment
            fitTier,
            fitDescription,
            // Numerical scores
            scores: {
              weighted: weightedScore,
              cosineSimilarity: Math.round(similarity.cosine * 100),
              jaccardSimilarity: Math.round(similarity.jaccard * 100),
              keywordMatchRate: Math.round(similarity.keywordOverlap.matchRate * 100),
              skillMatchScore: skillMatch.score,
            },
            // Categorized skill analysis
            skillAnalysis: {
              matched: categorizedMatched,
              missing: categorizedMissing,
              gapsByCategory,
              categoryMatchRates: categoryStats,
            },
            // NER-based cross-validation
            nerSkillOverlap: {
              matched: nerMatched,
              missing: nerMissing,
              matchRate: jobSkillSet.size > 0
                ? Math.round((nerMatched.length / jobSkillSet.size) * 100)
                : 0,
            },
            // Keyword overlap
            keywordAnalysis: {
              matchedKeywords: similarity.keywordOverlap.matched.slice(0, 30),
              missingKeywords: similarity.keywordOverlap.missing.slice(0, 30),
            },
            // Computed recommendations
            recommendations,
          }),
        },
      ],
    };
  },
};
