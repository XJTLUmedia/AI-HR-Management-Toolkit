/**
 * MCP Tool: analyze_resume_comprehensive
 *
 * The "master tool" — runs the full 5-node pipeline, entity classification,
 * keyword analysis, pattern matching, section quality assessment, and
 * skill categorization in a single call. Returns a complete algorithmic
 * profile of a resume without any AI calls.
 *
 * This is the MCP equivalent of calling parse_resume + inspect_pipeline +
 * classify_entities + extract_skills_structured + extract_experience_structured
 * combined, but optimized to avoid redundant computation.
 */

import { parseResume, type FileType } from "@/lib/parser";
import {
  runPipeline,
  classifyEntities,
  extractKeywords,
  extractMetrics,
  extractDates,
  extractContact,
  detectSections,
  estimateYearsOfExperience,
  calculateSimilarity,
  scoreSkillMatch,
  type ClassifiedEntity,
} from "@/lib/analysis";

// Skill category patterns (shared logic)
const CATEGORY_MAP: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|php|kotlin|scala|perl|haskell|elixir|dart|bash|shell|sql)\b/i, category: "programming_language" },
  { pattern: /\b(?:react|angular|vue|svelte|next\.?js|nuxt|django|flask|spring|express|fastapi|rails|laravel|\.net|nest\.?js)\b/i, category: "framework" },
  { pattern: /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|neo4j|firebase|supabase)\b/i, category: "database" },
  { pattern: /\b(?:docker|kubernetes|aws|azure|gcp|terraform|ansible|jenkins|ci\/cd|github\s*actions|vercel|netlify|heroku)\b/i, category: "devops_cloud" },
  { pattern: /\b(?:machine\s*learning|deep\s*learning|nlp|tensorflow|pytorch|scikit[\s-]learn|keras|llm|langchain|openai)\b/i, category: "ml_ai" },
  { pattern: /\b(?:figma|sketch|adobe\s*xd|photoshop|illustrator|ux\s*design|ui\s*design)\b/i, category: "design" },
  { pattern: /\b(?:agile|scrum|kanban|tdd|bdd|ci\/cd|devops)\b/i, category: "methodology" },
  { pattern: /\b(?:git|jira|confluence|slack|notion|postman|swagger|graphql|rest\s*api|grpc|kafka|webpack|vite|storybook)\b/i, category: "tool" },
];

function categorizeSkill(skillText: string): string {
  for (const { pattern, category } of CATEGORY_MAP) {
    if (pattern.test(skillText)) return category;
  }
  return "other";
}

export const mcpAnalyzeResumeComprehensiveTool = {
  name: "analyze_resume_comprehensive",
  description:
    "Run a comprehensive algorithmic analysis on a resume in a single call. Accepts raw text or a file (base64-encoded PDF/DOCX/TXT/MD or URL). Runs the full 5-node pipeline (Ingestion → Sanitization → Tokenization → Classification → Serialization) and returns: pipeline confidence scores, classified entities by type, categorized skills with proficiency estimates, structured experience timeline, career analysis, contact info, metrics/achievements, section quality assessment, and data quality scores. Optionally matches against a job description. This is a one-call alternative to chaining parse_resume + inspect_pipeline + classify_entities + extract_skills_structured + extract_experience_structured + compute_similarity.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description:
          "Raw resume text. Provide either resumeText OR (content + fileType), not both.",
      },
      content: {
        type: "string",
        description:
          "Base64-encoded file content or URL. Use with fileType. Ignored if resumeText is provided.",
      },
      fileType: {
        type: "string",
        enum: ["pdf", "docx", "txt", "md", "url"],
        description: "File type when using content parameter",
      },
      jobDescription: {
        type: "string",
        description:
          "Optional job description to compute similarity and skill gap analysis",
      },
      requiredSkills: {
        type: "array",
        items: { type: "string" },
        description: "Optional required skills to check against",
      },
    },
    required: [],
  },
  handler: async (args: {
    resumeText?: string;
    content?: string;
    fileType?: FileType;
    jobDescription?: string;
    requiredSkills?: string[];
  }) => {
    // Step 1: Get raw text
    let rawText: string;
    if (args.resumeText) {
      rawText = args.resumeText;
    } else if (args.content && args.fileType) {
      const parsed = await parseResume(args.content, args.fileType);
      rawText = parsed.text;
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error:
                "Provide either resumeText or (content + fileType)",
            }),
          },
        ],
      };
    }

    // Step 2: Run full pipeline (this includes sanitization, tokenization, classification, patterns)
    const pipeline = runPipeline(rawText);

    // Step 3: Extract additional data not covered by pipeline
    const dates = extractDates(rawText);
    const keywords = extractKeywords(rawText);
    const keywordMap = new Map(
      keywords.keywords.map((k, i) => [k.term.toLowerCase(), { rank: i, score: k.score, frequency: k.frequency }])
    );

    // Step 4: Build categorized skill inventory from NER results
    const skillEntities = pipeline.classification.entities.filter(
      (e) => e.type === "SKILL"
    );
    const categorizedSkills: Record<
      string,
      Array<{
        name: string;
        confidence: number;
        tfidfRank: number;
        frequency: number;
      }>
    > = {};

    const processedSkillNames = new Set<string>();
    for (const entity of skillEntities) {
      const normalized = entity.text.toLowerCase();
      if (processedSkillNames.has(normalized)) continue;
      processedSkillNames.add(normalized);

      const category = categorizeSkill(entity.text);
      const kw = keywordMap.get(normalized);

      if (!categorizedSkills[category]) categorizedSkills[category] = [];
      categorizedSkills[category].push({
        name: entity.text,
        confidence: Math.round(entity.confidence * 100) / 100,
        tfidfRank: (kw?.rank ?? keywords.keywords.length) + 1,
        frequency: kw?.frequency ?? 1,
      });
    }

    // Also capture TF-IDF keywords that match skill patterns but weren't in NER
    for (const kw of keywords.keywords.slice(0, 50)) {
      const normalized = kw.term.toLowerCase();
      if (processedSkillNames.has(normalized)) continue;
      const category = categorizeSkill(kw.term);
      if (category === "other") continue;
      processedSkillNames.add(normalized);
      if (!categorizedSkills[category]) categorizedSkills[category] = [];
      categorizedSkills[category].push({
        name: kw.term,
        confidence: 0.6, // lower confidence for TF-IDF-only matches
        tfidfRank: keywords.keywords.indexOf(kw) + 1,
        frequency: kw.frequency,
      });
    }

    // Sort within categories
    for (const cat of Object.keys(categorizedSkills)) {
      categorizedSkills[cat].sort((a, b) => a.tfidfRank - b.tfidfRank);
    }

    // Step 5: Build experience timeline from NER + patterns
    const jobTitles = pipeline.classification.entities.filter(
      (e) => e.type === "JOB_TITLE"
    );
    const organizationsEntities = pipeline.classification.entities.filter(
      (e) => e.type === "ORGANIZATION"
    );

    const experienceTimeline = dates.ranges.map((range) => {
      const rangeIdx = rawText.indexOf(range.raw);
      const nearbyText =
        rangeIdx >= 0
          ? rawText.slice(
              Math.max(0, rangeIdx - 200),
              rangeIdx + range.raw.length + 200
            )
          : "";

      return {
        dateRange: range,
        title:
          jobTitles.find((jt) =>
            nearbyText.toLowerCase().includes(jt.text.toLowerCase())
          )?.text ?? null,
        organization:
          organizationsEntities.find((org) =>
            nearbyText.toLowerCase().includes(org.text.toLowerCase())
          )?.text ?? null,
        metrics: extractMetrics(nearbyText),
      };
    });

    // Step 6: Quality assessment
    const EXPECTED_SECTIONS = [
      "summary",
      "experience",
      "education",
      "skills",
      "certifications",
      "projects",
    ];
    const sectionsFound = pipeline.patternMatching.sections.map((s) => s.name);
    const sectionsMissing = EXPECTED_SECTIONS.filter(
      (s) => !sectionsFound.includes(s)
    );

    const qualityScore = {
      overallConfidence: Math.round(pipeline.overallConfidence * 100) / 100,
      sectionCompleteness: Math.round(
        (sectionsFound.length / EXPECTED_SECTIONS.length) * 100
      ),
      entityDensity:
        pipeline.classification.summary.totalEntities > 0
          ? Math.round(
              (pipeline.classification.summary.totalEntities /
                Math.max(1, keywords.totalTerms)) *
                1000
            ) / 10
          : 0,
      averageEntityConfidence: Math.round(
        pipeline.classification.summary.averageConfidence * 100
      ),
      hasContactInfo:
        pipeline.patternMatching.contact.emails.length > 0 ||
        pipeline.patternMatching.contact.phones.length > 0,
      hasMetrics:
        pipeline.patternMatching.metrics.percentages.length > 0 ||
        pipeline.patternMatching.metrics.dollarAmounts.length > 0,
      issues: [
        ...(sectionsMissing.length > 0
          ? [`Missing sections: ${sectionsMissing.join(", ")}`]
          : []),
        ...(pipeline.patternMatching.contact.emails.length === 0
          ? ["No email detected"]
          : []),
        ...(pipeline.patternMatching.contact.phones.length === 0
          ? ["No phone number detected"]
          : []),
        ...(pipeline.patternMatching.metrics.percentages.length === 0 &&
        pipeline.patternMatching.metrics.dollarAmounts.length === 0
          ? ["No quantifiable metrics/achievements found"]
          : []),
        ...(pipeline.classification.summary.ambiguousEntities > 3
          ? [
              `${pipeline.classification.summary.ambiguousEntities} ambiguous entities detected`,
            ]
          : []),
      ],
    };

    // Step 7: Optional job match
    let jobMatch = undefined;
    if (args.jobDescription) {
      const similarity = calculateSimilarity(rawText, args.jobDescription);
      const jobKw = extractKeywords(args.jobDescription);
      const jobSkillTerms = jobKw.keywords.slice(0, 25).map((k) => k.term);
      const resumeSkillTerms = keywords.keywords
        .slice(0, 40)
        .map((k) => k.term);
      const skillMatchResult = scoreSkillMatch(
        resumeSkillTerms,
        jobSkillTerms
      );

      const weightedScore = Math.round(similarity.weightedScore * 100);
      let fitTier: string;
      if (weightedScore >= 70) fitTier = "strong_match";
      else if (weightedScore >= 50) fitTier = "moderate_match";
      else if (weightedScore >= 30) fitTier = "weak_match";
      else fitTier = "poor_match";

      jobMatch = {
        fitTier,
        scores: {
          weighted: weightedScore,
          cosine: Math.round(similarity.cosine * 100),
          jaccard: Math.round(similarity.jaccard * 100),
          keywordMatch: Math.round(
            similarity.keywordOverlap.matchRate * 100
          ),
          skillMatch: skillMatchResult.score,
        },
        matchedKeywords: similarity.keywordOverlap.matched.slice(0, 20),
        missingKeywords: similarity.keywordOverlap.missing.slice(0, 20),
        matchedSkills: skillMatchResult.matched,
        missingSkills: skillMatchResult.missing,
      };
    }

    // Step 8: Required skills check
    let requiredSkillsResult = undefined;
    if (args.requiredSkills && args.requiredSkills.length > 0) {
      const allSkills = [...processedSkillNames];
      requiredSkillsResult = {
        total: args.requiredSkills.length,
        matched: 0,
        missing: 0,
        details: args.requiredSkills.map((req) => {
          const normalized = req.toLowerCase();
          const found = allSkills.some(
            (s) => s.includes(normalized) || normalized.includes(s)
          );
          return { required: req, found };
        }),
      };
      requiredSkillsResult.matched = requiredSkillsResult.details.filter(
        (d) => d.found
      ).length;
      requiredSkillsResult.missing = requiredSkillsResult.details.filter(
        (d) => !d.found
      ).length;
    }

    // Step 9: Assemble complete analysis
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            // Pipeline metadata
            pipeline: {
              overallConfidence: pipeline.overallConfidence,
              totalDurationMs: Math.round(pipeline.totalDurationMs * 100) / 100,
              stages: pipeline.stages.map((s) => ({
                name: s.name,
                status: s.status,
                durationMs: Math.round(s.durationMs * 100) / 100,
                confidence: Math.round(s.confidence * 100) / 100,
                itemsProcessed: s.itemsProcessed,
              })),
            },

            // Contact information
            contact: pipeline.patternMatching.contact,

            // Categorized skills with TF-IDF ranking
            skills: {
              totalSkills: processedSkillNames.size,
              byCategory: categorizedSkills,
              topByTfidf: keywords.keywords
                .slice(0, 15)
                .map((k) => ({ term: k.term, score: Math.round(k.score * 1000) / 1000 })),
            },

            // Experience timeline
            experience: {
              estimatedYears: pipeline.patternMatching.estimatedYears,
              dateRangesFound: dates.ranges.length,
              timeline: experienceTimeline.map((t) => ({
                ...t,
                metrics: {
                  percentages: t.metrics.percentages.length,
                  dollarAmounts: t.metrics.dollarAmounts.length,
                  teamSizes: t.metrics.teamSizes.length,
                },
              })),
              jobTitles: jobTitles.map((jt) => jt.text),
              organizations: organizationsEntities.map((o) => o.text),
            },

            // Entity classification summary
            entities: {
              total: pipeline.classification.summary.totalEntities,
              byType: pipeline.classification.summary.byType,
              averageConfidence: Math.round(pipeline.classification.summary.averageConfidence * 100) / 100,
              ambiguous: pipeline.classification.summary.ambiguousEntities,
            },

            // Sections detected
            sections: {
              found: sectionsFound,
              missing: sectionsMissing,
              completeness: qualityScore.sectionCompleteness,
            },

            // Metrics/achievements
            metrics: pipeline.patternMatching.metrics,

            // Quality scoring
            quality: qualityScore,

            // Optional job match
            ...(jobMatch ? { jobMatch } : {}),

            // Optional required skills check
            ...(requiredSkillsResult ? { requiredSkillsMatch: requiredSkillsResult } : {}),

            // Raw text stats
            textStats: {
              characterCount: rawText.length,
              totalTerms: keywords.totalTerms,
              uniqueTerms: keywords.uniqueTerms,
            },
          }),
        },
      ],
    };
  },
};
