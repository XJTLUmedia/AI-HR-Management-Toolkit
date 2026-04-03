import {
  extractKeywords,
  detectSections,
  classifyEntities,
} from "@/lib/analysis";

// Skill category patterns for algorithmic classification
const SKILL_CATEGORIES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|php|kotlin|scala|perl|haskell|elixir|dart|bash|shell|sql|rust|go|swift|objective[\s-]?c|lua|r)\b/i, category: "programming_language" },
  { pattern: /\b(?:react|angular|vue|svelte|next\.?js|nuxt|django|flask|spring|express|fastapi|rails|laravel|\.net|nest\.?js|gin|echo|fiber)\b/i, category: "framework" },
  { pattern: /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|neo4j|firebase|supabase|cockroachdb)\b/i, category: "database" },
  { pattern: /\b(?:docker|kubernetes|aws|azure|gcp|terraform|ansible|jenkins|ci\/cd|github\s*actions|vercel|netlify|heroku|cloudflare)\b/i, category: "devops_cloud" },
  { pattern: /\b(?:machine\s*learning|deep\s*learning|nlp|tensorflow|pytorch|scikit[\s-]learn|keras|llm|langchain|openai|hugging\s*face)\b/i, category: "ml_ai" },
  { pattern: /\b(?:figma|sketch|adobe\s*xd|photoshop|illustrator|ux\s*design|ui\s*design)\b/i, category: "design" },
  { pattern: /\b(?:agile|scrum|kanban|tdd|bdd|devops|lean|xp)\b/i, category: "methodology" },
  { pattern: /\b(?:git|jira|confluence|slack|notion|postman|swagger|graphql|rest\s*api|grpc|kafka|webpack|vite|storybook)\b/i, category: "tool" },
  { pattern: /\b(?:jest|mocha|cypress|playwright|selenium|pytest|junit|rspec)\b/i, category: "testing" },
  { pattern: /\b(?:oauth|jwt|ssl|tls|owasp|sso|rbac|encryption)\b/i, category: "security" },
];

function categorizeKeyword(term: string): string {
  for (const { pattern, category } of SKILL_CATEGORIES) {
    if (pattern.test(term)) return category;
  }
  return "other";
}

export const mcpExtractKeywordsTool = {
  name: "extract_keywords",
  description:
    "Extract keywords from resume text using TF-IDF analysis, then overlay entity classification (NER) and skill categorization. Returns ranked keywords enriched with entity type, skill category, and confidence scores. No AI calls — all computation is algorithmic.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
      topN: {
        type: "number",
        description: "Number of top keywords to return (default: 40)",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: { resumeText: string; topN?: number }) => {
    const topN = args.topN ?? 40;
    const keywords = extractKeywords(args.resumeText);
    const sections = detectSections(args.resumeText);
    const skillsSection = sections.find((s) => s.name === "skills");

    // NER overlay: classify entities and build a lookup
    const classification = classifyEntities(args.resumeText);
    const entityLookup = new Map<string, { type: string; confidence: number }>();
    for (const e of classification.entities) {
      const key = e.text.toLowerCase();
      if (!entityLookup.has(key) || e.confidence > (entityLookup.get(key)?.confidence ?? 0)) {
        entityLookup.set(key, { type: e.type, confidence: e.confidence });
      }
    }

    // Enrich keywords with entity type + skill category
    const enrichedKeywords = keywords.keywords.slice(0, topN).map((k) => {
      const entity = entityLookup.get(k.term.toLowerCase());
      const category = categorizeKeyword(k.term);
      return {
        term: k.term,
        score: Math.round(k.score * 1000) / 1000,
        frequency: k.frequency,
        entityType: entity?.type ?? null,
        entityConfidence: entity ? Math.round(entity.confidence * 100) / 100 : null,
        skillCategory: category !== "other" ? category : null,
      };
    });

    // Group keywords by skill category (only categorized ones)
    const byCategory: Record<string, string[]> = {};
    for (const kw of enrichedKeywords) {
      if (kw.skillCategory) {
        if (!byCategory[kw.skillCategory]) byCategory[kw.skillCategory] = [];
        byCategory[kw.skillCategory].push(kw.term);
      }
    }

    // Group keywords by entity type (from NER)
    const byEntityType: Record<string, string[]> = {};
    for (const kw of enrichedKeywords) {
      if (kw.entityType) {
        if (!byEntityType[kw.entityType]) byEntityType[kw.entityType] = [];
        byEntityType[kw.entityType].push(kw.term);
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            keywords: enrichedKeywords,
            bigrams: keywords.bigrams.slice(0, 20).map((b) => ({
              term: b.term,
              score: Math.round(b.score * 1000) / 1000,
              frequency: b.frequency,
            })),
            totalTerms: keywords.totalTerms,
            uniqueTerms: keywords.uniqueTerms,
            // Pre-computed groupings
            bySkillCategory: byCategory,
            byEntityType: byEntityType,
            // Section info
            skillsSectionDetected: !!skillsSection,
            skillsSectionContent: skillsSection?.content.slice(0, 1000) || null,
            detectedSections: sections.map((s) => s.name),
          }),
        },
      ],
    };
  },
};
