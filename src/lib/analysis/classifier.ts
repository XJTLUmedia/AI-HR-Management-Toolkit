/**
 * Classification Node — Named Entity Recognition with domain-aware disambiguation.
 *
 * Addresses Gemini's assumption audit:
 * - "Keyword extraction ≠ skill verification" → confidence scoring per entity
 * - "NLP context misclassification" → domain-specific disambiguation (Java language vs location)
 * - "Positional text" assumption → layout-agnostic entity detection via patterns, not position
 */

export interface ClassifiedEntity {
  text: string;
  type: EntityType;
  confidence: number; // 0-1
  context: string; // surrounding text snippet
  disambiguation?: string; // why this classification was chosen
}

export type EntityType =
  | "PERSON"
  | "ORGANIZATION"
  | "DATE"
  | "SKILL"
  | "LOCATION"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "EDUCATION_DEGREE"
  | "CERTIFICATION"
  | "JOB_TITLE"
  | "METRIC";

export interface ClassificationResult {
  entities: ClassifiedEntity[];
  summary: {
    totalEntities: number;
    byType: Record<string, number>;
    averageConfidence: number;
    ambiguousEntities: number;
    disambiguationApplied: number;
  };
}

// ---- Domain-specific disambiguation rules ----

// Terms that are BOTH tech skills AND something else (location, name, etc.)
const AMBIGUOUS_TERMS: Record<string, { skill: RegExp; notSkill: RegExp; disambiguation: string }> = {
  java: {
    skill: /\b(?:java\s*(?:se|ee|fx|script)?|jdk|jvm|spring|hibernate|maven|gradle)\b/i,
    notSkill: /\b(?:java\s+(?:island|sea|indonesia|coffee))\b/i,
    disambiguation: "Classified as SKILL: preceded/followed by technical context (frameworks, versions, JDK/JVM)",
  },
  python: {
    skill: /\b(?:python\s*[23]?(?:\.\d+)?|django|flask|pip|pytorch|numpy|pandas)\b/i,
    notSkill: /\b(?:python\s+(?:snake|monty|species))\b/i,
    disambiguation: "Classified as SKILL: appears in technical context with framework/library co-occurrences",
  },
  go: {
    skill: /\b(?:go\s*(?:lang|routines?|channels?|modules?)|golang)\b/i,
    notSkill: /\b(?:go\s+(?:to|ahead|back|forward|home))\b/i,
    disambiguation: "Classified as SKILL: matched 'golang' or Go-specific technical terms (goroutines, channels)",
  },
  swift: {
    skill: /\b(?:swift\s*(?:ui|[2-6])|ios.*swift|xcode.*swift|swift.*(?:protocol|struct|class))\b/i,
    notSkill: /\b(?:swift\s+(?:response|action|delivery))\b/i,
    disambiguation: "Classified as SKILL: co-occurs with iOS/Xcode/SwiftUI context",
  },
  rust: {
    skill: /\b(?:rust\s*(?:lang)?|cargo|tokio|async.*rust|rust.*(?:ownership|borrow))\b/i,
    notSkill: /\b(?:rust\s+(?:belt|bucket|stain|removal))\b/i,
    disambiguation: "Classified as SKILL: co-occurs with Cargo, Tokio, or Rust-specific concepts",
  },
  r: {
    skill: /\b(?:r\s+(?:studio|programming|language|package|cran|shiny|ggplot|dplyr|tidyverse))\b/i,
    notSkill: /(?:^|\s)r(?:\s|$)/i, // standalone 'r' is too ambiguous
    disambiguation: "Classified as SKILL: explicitly referenced with R ecosystem tools (RStudio, CRAN, tidyverse)",
  },
  c: {
    skill: /\b(?:c\s*(?:\+\+|#|\/c\+\+)|ansi\s+c|c\s+programming|gcc|clang)\b/i,
    notSkill: /(?:^|\s)c(?:\s|$)/i, // standalone 'c' is too ambiguous
    disambiguation: "Classified as SKILL: identified as C/C++/C# with compiler or language qualifier",
  },
};

// Known technical skill patterns (high confidence)
const SKILL_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|php|kotlin|scala|perl|haskell|elixir|clojure|dart)\b/i, category: "programming_language" },
  { pattern: /\b(?:react|angular|vue|svelte|next\.?js|nuxt|django|flask|spring|express|fastapi|rails|laravel|\.net)\b/i, category: "framework" },
  { pattern: /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|sql\s*server)\b/i, category: "database" },
  { pattern: /\b(?:docker|kubernetes|aws|azure|gcp|terraform|ansible|jenkins|ci\/cd|github\s*actions|gitlab\s*ci)\b/i, category: "devops" },
  { pattern: /\b(?:machine\s*learning|deep\s*learning|nlp|computer\s*vision|tensorflow|pytorch|scikit[\s-]learn|keras)\b/i, category: "ml_ai" },
  { pattern: /\b(?:figma|sketch|adobe\s*xd|photoshop|illustrator|after\s*effects|premiere)\b/i, category: "design" },
  { pattern: /\b(?:agile|scrum|kanban|waterfall|lean|six\s*sigma|devops|tdd|bdd|ci\/cd)\b/i, category: "methodology" },
  { pattern: /\b(?:git|jira|confluence|slack|notion|trello|asana|linear|vscode|vim|emacs)\b/i, category: "tool" },
];

// Job title patterns
const JOB_TITLE_PATTERNS = /\b(?:(?:senior|junior|lead|principal|staff|chief|head|vp|director|manager)\s+)?(?:software|frontend|backend|fullstack|full[\s-]stack|devops|data|ml|ai|cloud|mobile|ios|android|web|systems?|network|security|qa|test|product|project|program|ux|ui|design)\s*(?:engineer|developer|architect|analyst|scientist|manager|lead|specialist|consultant|designer|officer|administrator)\b/i;

// Education degree patterns
const DEGREE_PATTERNS = /\b(?:(?:bachelor|master|doctor|phd|associate)(?:'s)?(?:\s+(?:of|in)\s+(?:science|arts|engineering|business|computer|information|technology|mathematics|physics|chemistry|biology))?|b\.?s\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d\.?|b\.?a\.?|b\.?eng\.?|m\.?eng\.?)\b/i;

// Metric patterns (quantifiable achievements)
const METRIC_PATTERNS = /(?:\d+(?:\.\d+)?%|\$[\d,.]+(?:\s*[KMB])?|\b\d+x\b|\b\d+\+?\s*(?:users?|customers?|clients?|employees?|members?|people|developers?|engineers?))\b/i;

/**
 * Classify entities in resume text with confidence scoring and disambiguation.
 */
export function classifyEntities(text: string): ClassificationResult {
  const entities: ClassifiedEntity[] = [];
  const lines = text.split("\n");

  // Pass 1: High-confidence pattern-based extraction
  extractEmails(text, entities);
  extractPhones(text, entities);
  extractUrls(text, entities);
  extractDegrees(text, entities);
  extractMetricsEntities(text, entities);
  extractJobTitles(text, entities);

  // Pass 2: Skill extraction with disambiguation
  extractSkillsWithDisambiguation(text, lines, entities);

  // Pass 3: Organization detection (companies near job titles/dates)
  extractOrganizations(text, lines, entities);

  // Deduplicate overlapping entities (keep highest confidence)
  const deduped = deduplicateEntities(entities);

  // Compute summary
  const byType: Record<string, number> = {};
  let totalConfidence = 0;
  let ambiguousCount = 0;
  let disambiguationCount = 0;

  for (const e of deduped) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    totalConfidence += e.confidence;
    if (e.confidence < 0.7) ambiguousCount++;
    if (e.disambiguation) disambiguationCount++;
  }

  return {
    entities: deduped,
    summary: {
      totalEntities: deduped.length,
      byType,
      averageConfidence: deduped.length > 0 ? totalConfidence / deduped.length : 0,
      ambiguousEntities: ambiguousCount,
      disambiguationApplied: disambiguationCount,
    },
  };
}

// ---- Extraction helpers ----

function getContext(text: string, match: RegExpMatchArray, radius = 40): string {
  const start = Math.max(0, (match.index ?? 0) - radius);
  const end = Math.min(text.length, (match.index ?? 0) + match[0].length + radius);
  return text.slice(start, end).replace(/\n/g, " ").trim();
}

function extractEmails(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    entities.push({
      text: m[0],
      type: "EMAIL",
      confidence: 0.95,
      context: getContext(text, m),
    });
  }
}

function extractPhones(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g)) {
    entities.push({
      text: m[0],
      type: "PHONE",
      confidence: 0.9,
      context: getContext(text, m),
    });
  }
}

function extractUrls(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(/https?:\/\/[^\s,;)}\]>'"]+/gi)) {
    entities.push({
      text: m[0],
      type: "URL",
      confidence: 0.95,
      context: getContext(text, m),
    });
  }
}

function extractDegrees(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(new RegExp(DEGREE_PATTERNS.source, "gi"))) {
    entities.push({
      text: m[0],
      type: "EDUCATION_DEGREE",
      confidence: 0.85,
      context: getContext(text, m),
    });
  }
}

function extractMetricsEntities(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(new RegExp(METRIC_PATTERNS.source, "gi"))) {
    entities.push({
      text: m[0],
      type: "METRIC",
      confidence: 0.8,
      context: getContext(text, m),
    });
  }
}

function extractJobTitles(text: string, entities: ClassifiedEntity[]) {
  for (const m of text.matchAll(new RegExp(JOB_TITLE_PATTERNS.source, "gi"))) {
    entities.push({
      text: m[0],
      type: "JOB_TITLE",
      confidence: 0.75,
      context: getContext(text, m),
    });
  }
}

function extractSkillsWithDisambiguation(
  text: string,
  _lines: string[],
  entities: ClassifiedEntity[]
) {
  // Check ambiguous terms first
  for (const [term, rules] of Object.entries(AMBIGUOUS_TERMS)) {
    const skillMatches = [...text.matchAll(new RegExp(`\\b${term}\\b`, "gi"))];
    if (skillMatches.length === 0) continue;

    const hasSkillContext = rules.skill.test(text);
    const hasNonSkillContext = rules.notSkill.test(text);

    for (const m of skillMatches) {
      if (hasSkillContext && !hasNonSkillContext) {
        entities.push({
          text: m[0],
          type: "SKILL",
          confidence: 0.85,
          context: getContext(text, m),
          disambiguation: rules.disambiguation,
        });
      } else if (hasNonSkillContext && !hasSkillContext) {
        // Not a skill in this context — skip or classify differently
        entities.push({
          text: m[0],
          type: "LOCATION",
          confidence: 0.5,
          context: getContext(text, m),
          disambiguation: `Ambiguous term "${term}" — classified as non-skill due to geographic/general context`,
        });
      } else {
        // Both contexts or neither — lower confidence
        entities.push({
          text: m[0],
          type: "SKILL",
          confidence: 0.6,
          context: getContext(text, m),
          disambiguation: `Ambiguous term "${term}" — defaulted to SKILL with reduced confidence`,
        });
      }
    }
  }

  // Check unambiguous skill patterns
  const alreadyClassified = new Set(entities.filter((e) => e.type === "SKILL").map((e) => e.text.toLowerCase()));

  for (const { pattern } of SKILL_PATTERNS) {
    for (const m of text.matchAll(new RegExp(pattern.source, "gi"))) {
      const normalized = m[0].toLowerCase();
      if (alreadyClassified.has(normalized)) continue;
      alreadyClassified.add(normalized);

      entities.push({
        text: m[0],
        type: "SKILL",
        confidence: 0.9,
        context: getContext(text, m),
      });
    }
  }
}

function extractOrganizations(
  text: string,
  _lines: string[],
  entities: ClassifiedEntity[]
) {
  // Detect organizations by proximity to date ranges and job titles
  // Pattern: "Company Name" followed by date range on same/next line
  const orgPattern = /^([A-Z][A-Za-z\s&.,'-]+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?|Group|Technologies|Solutions|Systems|Labs?|Studio|Agency))\b/gm;
  for (const m of text.matchAll(orgPattern)) {
    entities.push({
      text: m[1].trim(),
      type: "ORGANIZATION",
      confidence: 0.7,
      context: getContext(text, m),
    });
  }
}

function deduplicateEntities(entities: ClassifiedEntity[]): ClassifiedEntity[] {
  // Group by (text, type), keep highest confidence
  const seen = new Map<string, ClassifiedEntity>();
  for (const entity of entities) {
    const key = `${entity.text.toLowerCase()}::${entity.type}`;
    const existing = seen.get(key);
    if (!existing || entity.confidence > existing.confidence) {
      seen.set(key, entity);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}
