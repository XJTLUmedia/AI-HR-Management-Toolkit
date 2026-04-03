/**
 * MCP Tool: extract_skills_structured
 *
 * Algorithmic skill extraction with categorization and proficiency estimation.
 * Combines NER classifier (15 entity types), TF-IDF keyword analysis,
 * section detection, and frequency-based proficiency estimation.
 *
 * 100% algorithmic — no AI calls. This is the MCP equivalent of the non-MCP
 * extract_skills tool, but replaces AI categorization with code-based rules.
 */

import {
  classifyEntities,
  extractKeywords,
  detectSections,
  type ClassifiedEntity,
} from "@/lib/analysis";

// Skill category patterns — mirrors classifier.ts SKILL_PATTERNS, extended with more granularity
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  {
    pattern:
      /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|php|kotlin|scala|perl|haskell|elixir|clojure|dart|objective[\s-]?c|fortran|cobol|lua|julia|groovy|matlab|r\b(?:\s+programming)?|visual\s*basic|vb\.?net|assembly|bash|shell|powershell|sql)\b/i,
    category: "programming_language",
  },
  {
    pattern:
      /\b(?:react|angular|vue|svelte|next\.?js|nuxt|remix|gatsby|django|flask|spring|express|fastapi|rails|laravel|\.net|asp\.net|phoenix|sinatra|gin|fiber|actix|rocket|nest\.?js|koa|hapi|strapi|blazor|avalonia|qt|electron|tauri)\b/i,
    category: "framework",
  },
  {
    pattern:
      /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|sql\s*server|neo4j|couchdb|mariadb|firebase|supabase|cockroachdb|tidb|clickhouse|influxdb)\b/i,
    category: "database",
  },
  {
    pattern:
      /\b(?:docker|kubernetes|aws|azure|gcp|terraform|ansible|jenkins|ci\/cd|github\s*actions|gitlab\s*ci|circleci|argocd|helm|prometheus|grafana|datadog|nagios|nginx|apache|caddy|traefik|vercel|netlify|heroku|cloudflare)\b/i,
    category: "devops_cloud",
  },
  {
    pattern:
      /\b(?:machine\s*learning|deep\s*learning|nlp|natural\s*language|computer\s*vision|tensorflow|pytorch|scikit[\s-]learn|keras|hugging\s*face|transformers|bert|gpt|llm|langchain|openai|anthropic|reinforcement\s*learning|neural\s*network|xgboost|random\s*forest|svm|regression)\b/i,
    category: "ml_ai",
  },
  {
    pattern:
      /\b(?:figma|sketch|adobe\s*xd|photoshop|illustrator|after\s*effects|premiere|indesign|blender|cinema\s*4d|maya|ux\s*design|ui\s*design|wireframing|prototyping|user\s*research|information\s*architecture)\b/i,
    category: "design",
  },
  {
    pattern:
      /\b(?:agile|scrum|kanban|waterfall|lean|six\s*sigma|tdd|bdd|pair\s*programming|code\s*review|mob\s*programming|sprint|retrospective|standup|okr|safe)\b/i,
    category: "methodology",
  },
  {
    pattern:
      /\b(?:git|jira|confluence|slack|notion|trello|asana|linear|vscode|vim|emacs|intellij|pycharm|webstorm|postman|insomnia|swagger|graphql|rest\s*api|grpc|rabbitmq|kafka|sqs|sns|celery|airflow|webpack|vite|rollup|esbuild|turbopack|storybook)\b/i,
    category: "tool",
  },
  {
    pattern:
      /\b(?:communication|leadership|teamwork|problem[\s-]solving|critical\s*thinking|time\s*management|collaboration|mentoring|coaching|presentation|negotiation|conflict\s*resolution|adaptability|creativity|strategic\s*thinking|stakeholder\s*management|cross[\s-]functional)\b/i,
    category: "soft_skill",
  },
  {
    pattern:
      /\b(?:unit\s*test|integration\s*test|e2e|end[\s-]to[\s-]end|jest|mocha|pytest|cypress|playwright|selenium|cucumber|testing|test\s*automation|qa|quality\s*assurance|load\s*test|performance\s*test|stress\s*test)\b/i,
    category: "testing",
  },
  {
    pattern:
      /\b(?:oauth|jwt|saml|ssl|tls|https|encryption|authentication|authorization|cors|csp|xss|csrf|sql\s*injection|penetration\s*test|vulnerability|soc[\s-]2|gdpr|hipaa|pci[\s-]dss|iso[\s-]27001|cybersecurity|infosec)\b/i,
    category: "security",
  },
  {
    pattern:
      /\b(?:html|css|sass|less|tailwind|bootstrap|material[\s-]ui|chakra|ant\s*design|styled[\s-]components|css[\s-]modules|responsive|accessibility|a11y|wcag|seo|progressive\s*web|pwa|web\s*components)\b/i,
    category: "web_frontend",
  },
  {
    pattern:
      /\b(?:ios|android|react\s*native|flutter|swift|swiftui|uikit|jetpack\s*compose|xamarin|cordova|capacitor|expo|mobile\s*development|app\s*store|play\s*store)\b/i,
    category: "mobile",
  },
];

// Proficiency-indicating context patterns (for estimation from text)
const PROFICIENCY_SIGNALS: Array<{
  pattern: RegExp;
  level: "expert" | "advanced" | "intermediate" | "beginner";
  weight: number;
}> = [
  // Expert signals
  { pattern: /\b(?:expert|master(?:y|ed)?|authority|thought\s*leader|architect(?:ed)?|pioneer(?:ed)?|10\+?\s*years?)\b/i, level: "expert", weight: 1.0 },
  { pattern: /\b(?:designed?\s+(?:and\s+)?(?:built|implemented|architected)|led\s+(?:the\s+)?(?:design|architecture|development\s+of))\b/i, level: "expert", weight: 0.9 },
  // Advanced signals
  { pattern: /\b(?:advanced|proficient|extensive|strong|senior|deep\s*knowledge|5\+?\s*years?)\b/i, level: "advanced", weight: 0.8 },
  { pattern: /\b(?:optimized|scaled|mentored|led|managed|refactored)\b/i, level: "advanced", weight: 0.7 },
  // Intermediate signals
  { pattern: /\b(?:intermediate|moderate|working\s*knowledge|competent|3\+?\s*years?|developed|implemented|built)\b/i, level: "intermediate", weight: 0.5 },
  // Beginner signals
  { pattern: /\b(?:beginner|basic|familiar|exposure|coursework|learning|studied|introductory|1\s*year)\b/i, level: "beginner", weight: 0.3 },
];

function categorizeSkill(skillText: string): string {
  const lowerSkill = skillText.toLowerCase();
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(lowerSkill)) return category;
  }
  return "other";
}

function estimateProficiency(
  skillText: string,
  context: string,
  frequency: number,
  tfidfRank: number,
  totalKeywords: number,
  sectionCount: number
): { level: string; confidence: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  // 1. Context-based proficiency signals
  for (const { pattern, level, weight } of PROFICIENCY_SIGNALS) {
    if (pattern.test(context)) {
      signals.push(`context-${level}`);
      score += weight;
      break; // take highest match
    }
  }

  // 2. Frequency-based signal (mentioned many times → more proficient)
  if (frequency >= 5) {
    signals.push("high-frequency(5+)");
    score += 0.7;
  } else if (frequency >= 3) {
    signals.push("medium-frequency(3-4)");
    score += 0.4;
  } else if (frequency >= 2) {
    signals.push("low-frequency(2)");
    score += 0.2;
  }

  // 3. TF-IDF rank signal (higher rank → more important in the document)
  const rankPercentile = tfidfRank / Math.max(1, totalKeywords);
  if (rankPercentile <= 0.1) {
    signals.push("top-10%-tfidf");
    score += 0.6;
  } else if (rankPercentile <= 0.25) {
    signals.push("top-25%-tfidf");
    score += 0.4;
  } else if (rankPercentile <= 0.5) {
    signals.push("top-50%-tfidf");
    score += 0.2;
  }

  // 4. Multi-section presence (appears in both skills and experience → more usage)
  if (sectionCount >= 3) {
    signals.push("multi-section(3+)");
    score += 0.5;
  } else if (sectionCount >= 2) {
    signals.push("multi-section(2)");
    score += 0.3;
  }

  // Determine proficiency level from aggregate score
  let level: string;
  if (score >= 1.8) level = "expert";
  else if (score >= 1.2) level = "advanced";
  else if (score >= 0.6) level = "intermediate";
  else level = "beginner";

  // Confidence in the estimate
  const confidence = Math.min(1, signals.length / 4);

  return { level, confidence, signals };
}

export const mcpExtractSkillsStructuredTool = {
  name: "extract_skills_structured",
  description:
    "Extract and categorize skills from resume text using algorithmic analysis only (no AI). Combines NER entity classification (with disambiguation), TF-IDF keyword ranking, section detection, and frequency-based proficiency estimation. Returns skills organized by 13 categories (programming_language, framework, database, devops_cloud, ml_ai, design, methodology, tool, soft_skill, testing, security, web_frontend, mobile, other) with estimated proficiency levels and supporting evidence. Far more structured than extract_keywords — use this when you need categorized, proficiency-rated skill output.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
      requiredSkills: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional list of skills to specifically check for (returns match/miss status for each)",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: { resumeText: string; requiredSkills?: string[] }) => {
    const text = args.resumeText;

    // Step 1: NER classification for skill entities
    const classification = classifyEntities(text);
    const skillEntities = classification.entities.filter(
      (e) => e.type === "SKILL"
    );

    // Step 2: TF-IDF keyword analysis
    const keywords = extractKeywords(text);
    const keywordMap = new Map(
      keywords.keywords.map((k, i) => [k.term.toLowerCase(), { rank: i, score: k.score, frequency: k.frequency }])
    );

    // Step 3: Section detection for context enrichment
    const sections = detectSections(text);
    const sectionTexts = sections.map((s) => ({
      name: s.name,
      content: s.content.toLowerCase(),
    }));

    // Step 4: Build structured skill inventory
    const processedSkills = new Map<
      string,
      {
        name: string;
        category: string;
        proficiency: string;
        proficiencyConfidence: number;
        proficiencySignals: string[];
        tfidfScore: number;
        tfidfRank: number;
        frequency: number;
        nerConfidence: number;
        disambiguation?: string;
        sections: string[];
        context: string;
      }
    >();

    for (const entity of skillEntities) {
      const normalized = entity.text.toLowerCase().trim();
      if (processedSkills.has(normalized)) continue;

      const kw = keywordMap.get(normalized);
      const frequency = kw?.frequency ?? 1;
      const tfidfRank = kw?.rank ?? keywords.keywords.length;
      const tfidfScore = kw?.score ?? 0;

      // Determine which sections contain this skill
      const skillSections = sectionTexts
        .filter((s) => s.content.includes(normalized))
        .map((s) => s.name);

      const category = categorizeSkill(entity.text);
      const proficiency = estimateProficiency(
        entity.text,
        entity.context,
        frequency,
        tfidfRank,
        keywords.keywords.length,
        skillSections.length
      );

      processedSkills.set(normalized, {
        name: entity.text,
        category,
        proficiency: proficiency.level,
        proficiencyConfidence: Math.round(proficiency.confidence * 100) / 100,
        proficiencySignals: proficiency.signals,
        tfidfScore: Math.round(tfidfScore * 1000) / 1000,
        tfidfRank: tfidfRank + 1, // 1-indexed
        frequency,
        nerConfidence: Math.round(entity.confidence * 100) / 100,
        ...(entity.disambiguation ? { disambiguation: entity.disambiguation } : {}),
        sections: skillSections,
        context: entity.context,
      });
    }

    // Also capture TF-IDF keywords that look like skills but weren't caught by NER
    for (const kw of keywords.keywords.slice(0, 50)) {
      const normalized = kw.term.toLowerCase();
      if (processedSkills.has(normalized)) continue;

      const category = categorizeSkill(kw.term);
      if (category === "other") continue; // skip non-skill keywords

      const skillSections = sectionTexts
        .filter((s) => s.content.includes(normalized))
        .map((s) => s.name);

      const proficiency = estimateProficiency(
        kw.term,
        "", // no NER context available
        kw.frequency,
        keywords.keywords.indexOf(kw),
        keywords.keywords.length,
        skillSections.length
      );

      processedSkills.set(normalized, {
        name: kw.term,
        category,
        proficiency: proficiency.level,
        proficiencyConfidence: Math.round(proficiency.confidence * 100) / 100,
        proficiencySignals: proficiency.signals,
        tfidfScore: Math.round(kw.score * 1000) / 1000,
        tfidfRank: keywords.keywords.indexOf(kw) + 1,
        frequency: kw.frequency,
        nerConfidence: 0, // not from NER
        sections: skillSections,
        context: "",
      });
    }

    // Step 5: Group by category
    const byCategory: Record<string, Array<(typeof processedSkills extends Map<string, infer V> ? V : never)>> = {};
    for (const skill of processedSkills.values()) {
      if (!byCategory[skill.category]) byCategory[skill.category] = [];
      byCategory[skill.category].push(skill);
    }

    // Sort within each category by TF-IDF rank
    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].sort((a, b) => a.tfidfRank - b.tfidfRank);
    }

    // Step 6: Required skills gap analysis
    let requiredSkillsAnalysis = undefined;
    if (args.requiredSkills && args.requiredSkills.length > 0) {
      const allSkillNames = new Set(
        [...processedSkills.values()].map((s) => s.name.toLowerCase())
      );

      requiredSkillsAnalysis = args.requiredSkills.map((reqSkill) => {
        const normalized = reqSkill.toLowerCase();
        // Fuzzy match: check if any skill contains the required skill or vice versa
        const match = [...allSkillNames].find(
          (s) => s.includes(normalized) || normalized.includes(s)
        );
        const skillData = match ? processedSkills.get(match) : undefined;

        return {
          required: reqSkill,
          found: !!match,
          matchedAs: match ?? null,
          proficiency: skillData?.proficiency ?? null,
          tfidfRank: skillData?.tfidfRank ?? null,
        };
      });
    }

    // Step 7: Summary statistics
    const allSkills = [...processedSkills.values()];
    const proficiencyDistribution = {
      expert: allSkills.filter((s) => s.proficiency === "expert").length,
      advanced: allSkills.filter((s) => s.proficiency === "advanced").length,
      intermediate: allSkills.filter((s) => s.proficiency === "intermediate")
        .length,
      beginner: allSkills.filter((s) => s.proficiency === "beginner").length,
    };

    const categoryDistribution: Record<string, number> = {};
    for (const cat of Object.keys(byCategory)) {
      categoryDistribution[cat] = byCategory[cat].length;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            totalSkills: processedSkills.size,
            skills: byCategory,
            proficiencyDistribution,
            categoryDistribution,
            ...(requiredSkillsAnalysis
              ? {
                  requiredSkillsMatch: {
                    total: args.requiredSkills!.length,
                    matched: requiredSkillsAnalysis.filter((r) => r.found)
                      .length,
                    missing: requiredSkillsAnalysis.filter((r) => !r.found)
                      .length,
                    matchRate: Math.round(
                      (requiredSkillsAnalysis.filter((r) => r.found).length /
                        args.requiredSkills!.length) *
                        100
                    ),
                    details: requiredSkillsAnalysis,
                  },
                }
              : {}),
            topSkillsByTfidf: allSkills
              .sort((a, b) => a.tfidfRank - b.tfidfRank)
              .slice(0, 15)
              .map((s) => ({
                name: s.name,
                category: s.category,
                proficiency: s.proficiency,
                tfidfRank: s.tfidfRank,
              })),
            skillsSectionContent:
              sections
                .find((s) => s.name === "skills")
                ?.content.slice(0, 1000) ?? null,
          }),
        },
      ],
    };
  },
};
