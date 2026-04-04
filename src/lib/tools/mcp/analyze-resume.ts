/**
 * MCP Tool: analyze_resume
 *
 * Unified resume analysis tool that consolidates 7 previously separate tools
 * into a single entry point with selectable analysis aspects.
 *
 * Replaces:
 *   - extract_keywords         → aspects: ["keywords"]
 *   - detect_patterns          → aspects: ["patterns"]
 *   - compute_similarity       → aspects: ["similarity"] (requires jobDescription)
 *   - classify_entities        → aspects: ["entities"]
 *   - extract_skills_structured → aspects: ["skills"]
 *   - extract_experience_structured → aspects: ["experience"]
 *   - analyze_resume_comprehensive  → aspects: ["all"] (default)
 *
 * 100% algorithmic — no AI calls. Runs the full 5-node pipeline and returns
 * only the requested analysis aspects, avoiding redundant computation for
 * partial requests while still supporting the full comprehensive mode.
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

// ─── Aspect type ────────────────────────────────────────────────────────────
type Aspect = "keywords" | "patterns" | "similarity" | "entities" | "skills" | "experience" | "all";
const VALID_ASPECTS: Aspect[] = ["keywords", "patterns", "similarity", "entities", "skills", "experience", "all"];

// ─── Skill category patterns ────────────────────────────────────────────────
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

// ─── Seniority detection ────────────────────────────────────────────────────
const SENIORITY_MAP: Array<{ pattern: RegExp; level: number; label: string }> = [
  { pattern: /\b(?:intern|trainee)\b/i, level: 1, label: "intern" },
  { pattern: /\b(?:junior|associate|entry[\s-]level)\b/i, level: 2, label: "junior" },
  { pattern: /\b(?:mid[\s-]level|intermediate)\b/i, level: 3, label: "mid" },
  { pattern: /\b(?:senior|sr\.?|lead)\b/i, level: 4, label: "senior" },
  { pattern: /\b(?:staff|principal|distinguished)\b/i, level: 5, label: "staff" },
  { pattern: /\b(?:director|head\s+of)\b/i, level: 6, label: "director" },
  { pattern: /\b(?:vp|vice\s+president)\b/i, level: 7, label: "vp" },
  { pattern: /\b(?:cto|ceo|cfo|coo|c[\s-]?level)\b/i, level: 8, label: "c-level" },
];

// ─── Proficiency estimation ─────────────────────────────────────────────────
const PROFICIENCY_SIGNALS: Array<{
  pattern: RegExp;
  level: "expert" | "advanced" | "intermediate" | "beginner";
  weight: number;
}> = [
  { pattern: /\b(?:expert|master(?:y|ed)?|authority|thought\s*leader|architect(?:ed)?|pioneer(?:ed)?|10\+?\s*years?)\b/i, level: "expert", weight: 1.0 },
  { pattern: /\b(?:designed?\s+(?:and\s+)?(?:built|implemented|architected)|led\s+(?:the\s+)?(?:design|architecture|development\s+of))\b/i, level: "expert", weight: 0.9 },
  { pattern: /\b(?:advanced|proficient|extensive|strong|senior|deep\s*knowledge|5\+?\s*years?)\b/i, level: "advanced", weight: 0.8 },
  { pattern: /\b(?:optimized|scaled|mentored|led|managed|refactored)\b/i, level: "advanced", weight: 0.7 },
  { pattern: /\b(?:intermediate|moderate|working\s*knowledge|competent|3\+?\s*years?|developed|implemented|built)\b/i, level: "intermediate", weight: 0.5 },
  { pattern: /\b(?:beginner|basic|familiar|exposure|coursework|learning|studied|introductory|1\s*year)\b/i, level: "beginner", weight: 0.3 },
];

// ─── Helper functions ───────────────────────────────────────────────────────

function categorizeSkill(skillText: string): string {
  const lower = skillText.toLowerCase();
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(lower)) return category;
  }
  return "other";
}

function detectSeniority(text: string): { level: number; label: string } | null {
  for (const { pattern, level, label } of SENIORITY_MAP.slice().reverse()) {
    if (pattern.test(text)) return { level, label };
  }
  return null;
}

function estimateProficiency(
  skillText: string,
  context: string,
  frequency: number,
  tfidfRank: number,
  totalKeywords: number,
  sectionCount: number,
): { level: string; confidence: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  for (const { pattern, level, weight } of PROFICIENCY_SIGNALS) {
    if (pattern.test(context)) {
      signals.push(`context-${level}`);
      score += weight;
      break;
    }
  }

  if (frequency >= 5) { signals.push("high-frequency(5+)"); score += 0.7; }
  else if (frequency >= 3) { signals.push("medium-frequency(3-4)"); score += 0.4; }
  else if (frequency >= 2) { signals.push("low-frequency(2)"); score += 0.2; }

  const rankPercentile = tfidfRank / Math.max(1, totalKeywords);
  if (rankPercentile <= 0.1) { signals.push("top-10%-tfidf"); score += 0.6; }
  else if (rankPercentile <= 0.25) { signals.push("top-25%-tfidf"); score += 0.4; }
  else if (rankPercentile <= 0.5) { signals.push("top-50%-tfidf"); score += 0.2; }

  if (sectionCount >= 3) { signals.push("multi-section(3+)"); score += 0.5; }
  else if (sectionCount >= 2) { signals.push("multi-section(2)"); score += 0.3; }

  let level: string;
  if (score >= 1.8) level = "expert";
  else if (score >= 1.2) level = "advanced";
  else if (score >= 0.6) level = "intermediate";
  else level = "beginner";

  return { level, confidence: Math.min(1, signals.length / 4), signals };
}

function splitExperienceBlocks(sectionContent: string): string[] {
  const lines = sectionContent.split("\n");
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  const dateLinePattern =
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\s*[-–—]|(?:20\d{2}|19\d{2})\s*[-–—]\s*(?:20\d{2}|19\d{2}|Present|Current)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i > 0 && dateLinePattern.test(line) && currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n").trim());
      currentBlock = [];
    }
    if (line === "" && i > 0 && lines[i - 1]?.trim() === "" && currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n").trim());
      currentBlock = [];
      continue;
    }
    if (line) currentBlock.push(line);
  }
  if (currentBlock.length > 0) blocks.push(currentBlock.join("\n").trim());
  return blocks.filter((b) => b.length > 20);
}

function extractAchievements(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•\-*▪▸►●○◦‣⁃]/.test(l) || /^\d+[.)]\s/.test(l))
    .map((l) => l.replace(/^[•\-*▪▸►●○◦‣⁃\d.)\s]+/, "").trim())
    .filter((l) => l.length > 10);
}

function estimateDuration(range: { start: string; end: string | null }): string | null {
  const parseDate = (s: string): Date | null => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const startDate = parseDate(range.start);
  const endStr = range.end?.toLowerCase();
  const endDate =
    !endStr || endStr === "present" || endStr === "current" || endStr === "now"
      ? new Date()
      : parseDate(range.end!);
  if (!startDate || !endDate) return null;
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  if (months < 1) return "< 1 month";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${rem} month${rem === 1 ? "" : "s"}`;
}

// ─── Aspect builders ────────────────────────────────────────────────────────

function buildKeywordsAspect(
  rawText: string,
  keywords: ReturnType<typeof extractKeywords>,
  classification: ReturnType<typeof classifyEntities>,
  topN: number,
) {
  const entityLookup = new Map<string, { type: string; confidence: number }>();
  for (const e of classification.entities) {
    const key = e.text.toLowerCase();
    if (!entityLookup.has(key) || e.confidence > (entityLookup.get(key)?.confidence ?? 0)) {
      entityLookup.set(key, { type: e.type, confidence: e.confidence });
    }
  }

  const enrichedKeywords = keywords.keywords.slice(0, topN).map((k) => {
    const entity = entityLookup.get(k.term.toLowerCase());
    const category = categorizeSkill(k.term);
    return {
      term: k.term,
      score: Math.round(k.score * 1000) / 1000,
      frequency: k.frequency,
      entityType: entity?.type ?? null,
      entityConfidence: entity ? Math.round(entity.confidence * 100) / 100 : null,
      skillCategory: category !== "other" ? category : null,
    };
  });

  const byCategory: Record<string, string[]> = {};
  for (const kw of enrichedKeywords) {
    if (kw.skillCategory) {
      if (!byCategory[kw.skillCategory]) byCategory[kw.skillCategory] = [];
      byCategory[kw.skillCategory].push(kw.term);
    }
  }

  return { totalTerms: keywords.totalTerms, keywords: enrichedKeywords, byCategory };
}

function buildEntitiesAspect(
  classification: ReturnType<typeof classifyEntities>,
  minConfidence: number,
  entityTypes?: string[],
) {
  let entities = classification.entities;
  if (minConfidence > 0) entities = entities.filter((e) => e.confidence >= minConfidence);
  if (entityTypes?.length) {
    const typeSet = new Set(entityTypes.map((t) => t.toUpperCase()));
    entities = entities.filter((e) => typeSet.has(e.type));
  }

  const grouped: Record<string, Array<{ text: string; confidence: number; context: string; disambiguation?: string }>> = {};
  for (const e of entities) {
    if (!grouped[e.type]) grouped[e.type] = [];
    grouped[e.type].push({
      text: e.text,
      confidence: Math.round(e.confidence * 100) / 100,
      context: e.context,
      ...(e.disambiguation ? { disambiguation: e.disambiguation } : {}),
    });
  }

  const highConfidence = entities.filter((e) => e.confidence >= 0.8).length;
  const mediumConfidence = entities.filter((e) => e.confidence >= 0.6 && e.confidence < 0.8).length;
  const lowConfidence = entities.filter((e) => e.confidence < 0.6).length;

  return {
    totalEntities: entities.length,
    byType: grouped,
    confidenceDistribution: { high: highConfidence, medium: mediumConfidence, low: lowConfidence },
    averageConfidence: entities.length > 0
      ? Math.round((entities.reduce((s, e) => s + e.confidence, 0) / entities.length) * 100) / 100
      : 0,
    ambiguous: classification.entities.filter((e) => e.disambiguation).length,
  };
}

function buildSkillsAspect(
  rawText: string,
  classification: ReturnType<typeof classifyEntities>,
  keywords: ReturnType<typeof extractKeywords>,
  sections: ReturnType<typeof detectSections>,
  requiredSkills?: string[],
) {
  const skillEntities = classification.entities.filter((e) => e.type === "SKILL");
  const keywordMap = new Map(
    keywords.keywords.map((k, i) => [k.term.toLowerCase(), { rank: i, score: k.score, frequency: k.frequency }]),
  );
  const sectionTexts = sections.map((s) => ({ name: s.name, content: s.content.toLowerCase() }));

  const processedSkills = new Map<string, {
    name: string; category: string; proficiency: string; proficiencyConfidence: number;
    proficiencySignals: string[]; tfidfScore: number; tfidfRank: number; frequency: number;
    nerConfidence: number; disambiguation?: string; sections: string[]; context: string;
  }>();

  for (const entity of skillEntities) {
    const normalized = entity.text.toLowerCase().trim();
    if (processedSkills.has(normalized)) continue;
    const kw = keywordMap.get(normalized);
    const frequency = kw?.frequency ?? 1;
    const tfidfRank = kw?.rank ?? keywords.keywords.length;
    const tfidfScore = kw?.score ?? 0;
    const skillSections = sectionTexts.filter((s) => s.content.includes(normalized)).map((s) => s.name);
    const category = categorizeSkill(entity.text);
    const proficiency = estimateProficiency(entity.text, entity.context, frequency, tfidfRank, keywords.keywords.length, skillSections.length);

    processedSkills.set(normalized, {
      name: entity.text, category,
      proficiency: proficiency.level,
      proficiencyConfidence: Math.round(proficiency.confidence * 100) / 100,
      proficiencySignals: proficiency.signals,
      tfidfScore: Math.round(tfidfScore * 1000) / 1000,
      tfidfRank: tfidfRank + 1, frequency,
      nerConfidence: Math.round(entity.confidence * 100) / 100,
      ...(entity.disambiguation ? { disambiguation: entity.disambiguation } : {}),
      sections: skillSections, context: entity.context,
    });
  }

  // TF-IDF skill augmentation
  for (const kw of keywords.keywords.slice(0, 50)) {
    const normalized = kw.term.toLowerCase();
    if (processedSkills.has(normalized)) continue;
    const category = categorizeSkill(kw.term);
    if (category === "other") continue;
    const skillSections = sectionTexts.filter((s) => s.content.includes(normalized)).map((s) => s.name);
    const proficiency = estimateProficiency(kw.term, "", kw.frequency, keywords.keywords.indexOf(kw), keywords.keywords.length, skillSections.length);
    processedSkills.set(normalized, {
      name: kw.term, category,
      proficiency: proficiency.level,
      proficiencyConfidence: Math.round(proficiency.confidence * 100) / 100,
      proficiencySignals: proficiency.signals,
      tfidfScore: Math.round(kw.score * 1000) / 1000,
      tfidfRank: keywords.keywords.indexOf(kw) + 1,
      frequency: kw.frequency, nerConfidence: 0, sections: skillSections, context: "",
    });
  }

  // Group by category
  const byCategory: Record<string, Array<typeof processedSkills extends Map<string, infer V> ? V : never>> = {};
  for (const skill of processedSkills.values()) {
    if (!byCategory[skill.category]) byCategory[skill.category] = [];
    byCategory[skill.category].push(skill);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => a.tfidfRank - b.tfidfRank);
  }

  const allSkills = [...processedSkills.values()];
  const proficiencyDistribution = {
    expert: allSkills.filter((s) => s.proficiency === "expert").length,
    advanced: allSkills.filter((s) => s.proficiency === "advanced").length,
    intermediate: allSkills.filter((s) => s.proficiency === "intermediate").length,
    beginner: allSkills.filter((s) => s.proficiency === "beginner").length,
  };

  // Required skills check
  let requiredSkillsMatch = undefined;
  if (requiredSkills?.length) {
    const allNames = new Set([...processedSkills.values()].map((s) => s.name.toLowerCase()));
    const details = requiredSkills.map((req) => {
      const normalized = req.toLowerCase();
      const match = [...allNames].find((s) => s.includes(normalized) || normalized.includes(s));
      const data = match ? processedSkills.get(match) : undefined;
      return { required: req, found: !!match, matchedAs: match ?? null, proficiency: data?.proficiency ?? null, tfidfRank: data?.tfidfRank ?? null };
    });
    requiredSkillsMatch = {
      total: requiredSkills.length,
      matched: details.filter((d) => d.found).length,
      missing: details.filter((d) => !d.found).length,
      matchRate: Math.round((details.filter((d) => d.found).length / requiredSkills.length) * 100),
      details,
    };
  }

  return {
    totalSkills: processedSkills.size,
    skills: byCategory,
    proficiencyDistribution,
    topSkillsByTfidf: allSkills.sort((a, b) => a.tfidfRank - b.tfidfRank).slice(0, 15).map((s) => ({
      name: s.name, category: s.category, proficiency: s.proficiency, tfidfRank: s.tfidfRank,
    })),
    ...(requiredSkillsMatch ? { requiredSkillsMatch } : {}),
  };
}

function buildExperienceAspect(
  rawText: string,
  classification: ReturnType<typeof classifyEntities>,
  keywords: ReturnType<typeof extractKeywords>,
  dates: ReturnType<typeof extractDates>,
  metrics: ReturnType<typeof extractMetrics>,
  sections: ReturnType<typeof detectSections>,
) {
  const estimatedYears = estimateYearsOfExperience(rawText);
  const jobTitles = classification.entities.filter((e) => e.type === "JOB_TITLE");
  const organizations = classification.entities.filter((e) => e.type === "ORGANIZATION");
  const skillEntities = classification.entities.filter((e) => e.type === "SKILL");
  const experienceSection = sections.find((s) => s.name === "experience");

  interface ExperienceEntry {
    title: string | null;
    organization: string | null;
    dateRange: { raw: string; start: string; end: string | null } | null;
    durationEstimate: string | null;
    seniority: { level: number; label: string } | null;
    metrics: string[];
    technologies: string[];
    achievements: string[];
    confidence: number;
  }

  const experiences: ExperienceEntry[] = [];

  if (experienceSection) {
    const blocks = splitExperienceBlocks(experienceSection.content);
    for (const block of blocks) {
      const blockDates = extractDates(block);
      const dateRange = blockDates.ranges[0] ?? null;
      const blockJobTitles = jobTitles.filter((jt) => block.toLowerCase().includes(jt.text.toLowerCase()));
      const title = blockJobTitles.sort((a, b) => b.confidence - a.confidence)[0]?.text ?? null;
      const blockOrgs = organizations.filter((org) => block.toLowerCase().includes(org.text.toLowerCase()));
      const org = blockOrgs.sort((a, b) => b.confidence - a.confidence)[0]?.text ?? null;
      const blockMetrics = extractMetrics(block);
      const allMetrics = [...blockMetrics.percentages, ...blockMetrics.dollarAmounts, ...blockMetrics.teamSizes, ...blockMetrics.numbers];
      const blockSkills = skillEntities.filter((s) => block.toLowerCase().includes(s.text.toLowerCase())).map((s) => s.text);
      const achievements = extractAchievements(block);
      const seniority = title ? detectSeniority(title) : null;

      experiences.push({
        title, organization: org,
        dateRange: dateRange ? { raw: dateRange.raw, start: dateRange.start, end: dateRange.end } : null,
        durationEstimate: dateRange ? estimateDuration(dateRange) : null,
        seniority, metrics: allMetrics.slice(0, 10),
        technologies: [...new Set(blockSkills)].slice(0, 10),
        achievements: achievements.slice(0, 5),
        confidence: (title ? 0.4 : 0) + (org ? 0.3 : 0) + (dateRange ? 0.3 : 0),
      });
    }
  }

  // Fallback: build from date ranges if no experience section found
  if (experiences.length === 0 && dates.ranges.length > 0) {
    for (const range of dates.ranges) {
      const rangeIdx = rawText.indexOf(range.raw);
      const nearbyText = rangeIdx >= 0
        ? rawText.slice(Math.max(0, rangeIdx - 300), rangeIdx + range.raw.length + 500)
        : "";
      const title = jobTitles.find((jt) => nearbyText.toLowerCase().includes(jt.text.toLowerCase()));
      const org = organizations.find((o) => nearbyText.toLowerCase().includes(o.text.toLowerCase()));
      const nearbySkills = skillEntities.filter((s) => nearbyText.toLowerCase().includes(s.text.toLowerCase())).map((s) => s.text);
      const nearbyMetrics = extractMetrics(nearbyText);
      const seniority = title ? detectSeniority(title.text) : null;
      const achievementMatches = nearbyText.match(/(?:^|\n)\s*[•\-\*▪●]\s*(.+)/g) || [];
      const achievements = achievementMatches.map((a) => a.replace(/^\s*[•\-\*▪●]\s*/, "").trim()).filter((a) => a.length > 15).slice(0, 5);

      experiences.push({
        title: title?.text ?? null, organization: org?.text ?? null,
        dateRange: { raw: range.raw, start: range.start, end: range.end },
        durationEstimate: estimateDuration(range), seniority,
        metrics: [...nearbyMetrics.percentages, ...nearbyMetrics.dollarAmounts, ...nearbyMetrics.teamSizes].slice(0, 10),
        technologies: [...new Set(nearbySkills)].slice(0, 10),
        achievements,
        confidence: (title ? 0.3 : 0) + (org ? 0.3 : 0) + 0.2,
      });
    }
  }

  // Career progression
  const seniorityEntries = experiences.filter((e) => e.seniority).sort((a, b) => {
    const aYear = a.dateRange?.start ? new Date(a.dateRange.start).getFullYear() : 0;
    const bYear = b.dateRange?.start ? new Date(b.dateRange.start).getFullYear() : 0;
    return aYear - bYear;
  });

  let progressionTrend: string;
  if (seniorityEntries.length < 2) progressionTrend = "insufficient_data";
  else {
    const first = seniorityEntries[0].seniority!.level;
    const last = seniorityEntries[seniorityEntries.length - 1].seniority!.level;
    progressionTrend = last > first ? "upward" : last < first ? "lateral_or_transition" : "stable";
  }

  return {
    estimatedYearsOfExperience: estimatedYears,
    entries: experiences,
    careerProgression: {
      trend: progressionTrend,
      seniorityTimeline: seniorityEntries.map((e) => ({
        title: e.title, level: e.seniority!.label,
        dateRange: e.dateRange?.raw ?? null,
      })),
      currentLevel: seniorityEntries.length > 0 ? seniorityEntries[seniorityEntries.length - 1].seniority!.label : null,
    },
    jobTitles: jobTitles.map((jt) => jt.text),
    organizations: organizations.map((o) => o.text),
  };
}

function buildPatternsAspect(
  rawText: string,
  classification: ReturnType<typeof classifyEntities>,
  dates: ReturnType<typeof extractDates>,
  metrics: ReturnType<typeof extractMetrics>,
  sections: ReturnType<typeof detectSections>,
) {
  const estimatedYears = estimateYearsOfExperience(rawText);
  const jobTitles = classification.entities.filter((e) => e.type === "JOB_TITLE");
  const organizations = classification.entities.filter((e) => e.type === "ORGANIZATION");
  const skills = classification.entities.filter((e) => e.type === "SKILL");

  const structuredEntries = dates.ranges.map((range) => {
    const rangeIdx = rawText.indexOf(range.raw);
    const nearbyText = rangeIdx >= 0
      ? rawText.slice(Math.max(0, rangeIdx - 300), rangeIdx + range.raw.length + 500)
      : "";
    const title = jobTitles.find((jt) => nearbyText.toLowerCase().includes(jt.text.toLowerCase()));
    const org = organizations.find((o) => nearbyText.toLowerCase().includes(o.text.toLowerCase()));
    const nearbySkills = skills.filter((s) => nearbyText.toLowerCase().includes(s.text.toLowerCase())).map((s) => s.text);
    const nearbyMetrics = extractMetrics(nearbyText);
    const seniority = title ? detectSeniority(title.text) : null;
    const achievementMatches = nearbyText.match(/(?:^|\n)\s*[•\-\*▪●]\s*(.+)/g) || [];
    const achievements = achievementMatches.map((a) => a.replace(/^\s*[•\-\*▪●]\s*/, "").trim()).filter((a) => a.length > 15).slice(0, 5);

    return {
      dateRange: { raw: range.raw, start: range.start, end: range.end },
      title: title?.text ?? null,
      titleConfidence: title ? Math.round(title.confidence * 100) / 100 : null,
      organization: org?.text ?? null,
      seniority,
      technologies: [...new Set(nearbySkills)].slice(0, 10),
      metrics: { percentages: nearbyMetrics.percentages, dollarAmounts: nearbyMetrics.dollarAmounts, teamSizes: nearbyMetrics.teamSizes },
      achievements,
    };
  });

  // Career progression
  const seniorityEntries = structuredEntries.filter((e) => e.seniority).sort((a, b) => {
    const aYear = a.dateRange.start ? new Date(a.dateRange.start).getFullYear() : 0;
    const bYear = b.dateRange.start ? new Date(b.dateRange.start).getFullYear() : 0;
    return aYear - bYear;
  });
  let progressionTrend: string;
  if (seniorityEntries.length < 2) progressionTrend = "insufficient_data";
  else {
    const first = seniorityEntries[0].seniority!.level;
    const last = seniorityEntries[seniorityEntries.length - 1].seniority!.level;
    progressionTrend = last > first ? "upward" : last < first ? "lateral_or_transition" : "stable";
  }

  return {
    estimatedYearsOfExperience: estimatedYears,
    experienceEntries: structuredEntries,
    careerProgression: {
      trend: progressionTrend,
      seniorityTimeline: seniorityEntries.map((e) => ({ title: e.title, level: e.seniority!.label, dateRange: e.dateRange.raw })),
      currentLevel: seniorityEntries.length > 0 ? seniorityEntries[seniorityEntries.length - 1].seniority!.label : null,
    },
    dateRanges: dates.ranges.map((r) => ({ raw: r.raw, start: r.start, end: r.end })),
    standaloneDates: dates.standalone,
    metrics: { percentages: metrics.percentages, dollarAmounts: metrics.dollarAmounts, teamSizes: metrics.teamSizes },
    sections: sections.map((s) => ({ name: s.name, contentPreview: s.content.slice(0, 300) })),
  };
}

function buildSimilarityAspect(
  rawText: string,
  jobDescription: string,
  keywords: ReturnType<typeof extractKeywords>,
  classification: ReturnType<typeof classifyEntities>,
) {
  const similarity = calculateSimilarity(rawText, jobDescription);
  const jobKeywords = extractKeywords(jobDescription);
  const jobSkillTerms = jobKeywords.keywords.slice(0, 25).map((k) => k.term);
  const resumeSkillTerms = keywords.keywords.slice(0, 40).map((k) => k.term);
  const skillMatch = scoreSkillMatch(resumeSkillTerms, jobSkillTerms);

  const weightedScore = Math.round(similarity.weightedScore * 100);
  let fitTier: string;
  let fitDescription: string;
  if (weightedScore >= 70) { fitTier = "strong_match"; fitDescription = "Candidate's profile strongly aligns with requirements"; }
  else if (weightedScore >= 50) { fitTier = "moderate_match"; fitDescription = "Candidate meets many requirements but has notable gaps"; }
  else if (weightedScore >= 30) { fitTier = "weak_match"; fitDescription = "Candidate has some relevant skills but significant gaps exist"; }
  else { fitTier = "poor_match"; fitDescription = "Candidate's profile does not align with role requirements"; }

  const categorizedMatched = skillMatch.matched.map((s) => ({ skill: s, category: categorizeSkill(s) }));
  const categorizedMissing = skillMatch.missing.map((s) => ({ skill: s, category: categorizeSkill(s) }));

  const gapsByCategory: Record<string, string[]> = {};
  for (const { skill, category } of categorizedMissing) {
    if (!gapsByCategory[category]) gapsByCategory[category] = [];
    gapsByCategory[category].push(skill);
  }

  const allJobCategorized = jobSkillTerms.map((t) => ({ skill: t, category: categorizeSkill(t) }));
  const categoryStats: Record<string, { total: number; matched: number; rate: number }> = {};
  for (const { category } of allJobCategorized) {
    if (!categoryStats[category]) categoryStats[category] = { total: 0, matched: 0, rate: 0 };
    categoryStats[category].total++;
  }
  for (const { category } of categorizedMatched) {
    if (categoryStats[category]) categoryStats[category].matched++;
  }
  for (const cat of Object.keys(categoryStats)) {
    categoryStats[cat].rate = Math.round((categoryStats[cat].matched / categoryStats[cat].total) * 100);
  }

  const recommendations: string[] = [];
  for (const [category, skills] of Object.entries(gapsByCategory)) {
    if (skills.length >= 3) recommendations.push(`Critical gap in ${category.replace(/_/g, " ")}: missing ${skills.join(", ")}`);
    else if (skills.length > 0) recommendations.push(`Minor gap in ${category.replace(/_/g, " ")}: missing ${skills.join(", ")}`);
  }

  // NER-based cross-validation
  const jobClassification = classifyEntities(jobDescription);
  const resumeSkillSet = new Set(classification.entities.filter((e) => e.type === "SKILL").map((e) => e.text.toLowerCase()));
  const jobSkillSet = new Set(jobClassification.entities.filter((e) => e.type === "SKILL").map((e) => e.text.toLowerCase()));
  const nerMatched = [...jobSkillSet].filter((s) => resumeSkillSet.has(s));
  const nerMissing = [...jobSkillSet].filter((s) => !resumeSkillSet.has(s));

  return {
    fitTier, fitDescription,
    scores: {
      weighted: weightedScore,
      cosineSimilarity: Math.round(similarity.cosine * 100),
      jaccardSimilarity: Math.round(similarity.jaccard * 100),
      keywordMatchRate: Math.round(similarity.keywordOverlap.matchRate * 100),
      skillMatchScore: skillMatch.score,
    },
    skillAnalysis: { matched: categorizedMatched, missing: categorizedMissing, gapsByCategory, categoryMatchRates: categoryStats },
    nerSkillOverlap: {
      matched: nerMatched, missing: nerMissing,
      matchRate: jobSkillSet.size > 0 ? Math.round((nerMatched.length / jobSkillSet.size) * 100) : 0,
    },
    keywordAnalysis: {
      matchedKeywords: similarity.keywordOverlap.matched.slice(0, 30),
      missingKeywords: similarity.keywordOverlap.missing.slice(0, 30),
    },
    recommendations,
  };
}

// ─── Main tool export ───────────────────────────────────────────────────────

export const mcpAnalyzeResumeTool = {
  name: "analyze_resume",
  description:
    `Unified resume analysis tool. Select which analysis aspects to run via the "aspects" parameter:
- "keywords"   — TF-IDF keyword extraction with NER overlay and skill categorization
- "entities"   — Named Entity Recognition (12 types with confidence and disambiguation)
- "skills"     — Categorized skill extraction with proficiency estimation (13 categories)
- "experience" — Structured work history with timeline, achievements, and career progression
- "patterns"   — Date ranges, metrics, seniority detection, and section analysis
- "similarity" — Job description matching with fit tier, gap analysis (requires jobDescription)
- "all"        — Full comprehensive analysis combining all aspects (default)
Accepts raw text or a file (base64-encoded PDF/DOCX/TXT/MD or URL). 100% algorithmic — no AI calls needed.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "Raw resume text. Provide either resumeText OR (content + fileType), not both.",
      },
      content: {
        type: "string",
        description: "Base64-encoded file content or URL. Use with fileType. Ignored if resumeText is provided.",
      },
      fileType: {
        type: "string",
        enum: ["pdf", "docx", "txt", "md", "url"],
        description: "File type when using content parameter.",
      },
      aspects: {
        type: "array",
        items: { type: "string", enum: ["keywords", "entities", "skills", "experience", "patterns", "similarity", "all"] },
        description: 'Which analysis aspects to include. Defaults to ["all"]. Use specific aspects for faster, focused results.',
      },
      jobDescription: {
        type: "string",
        description: "Job description for similarity scoring and skill gap analysis. Required when aspects includes 'similarity'.",
      },
      requiredSkills: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of skills to check for match/miss status.",
      },
      topKeywords: {
        type: "number",
        description: "Number of top keywords to return (default: 40). Only relevant for 'keywords' aspect.",
      },
      minEntityConfidence: {
        type: "number",
        description: "Minimum confidence (0-1) for entity inclusion. Only relevant for 'entities' aspect.",
      },
      entityTypes: {
        type: "array",
        items: { type: "string" },
        description: "Filter entities to specific types (e.g., ['SKILL', 'JOB_TITLE']). Only relevant for 'entities' aspect.",
      },
    },
    required: [],
  },

  handler: async (args: {
    resumeText?: string;
    content?: string;
    fileType?: FileType;
    aspects?: Aspect[];
    jobDescription?: string;
    requiredSkills?: string[];
    topKeywords?: number;
    minEntityConfidence?: number;
    entityTypes?: string[];
  }) => {
    // ── Resolve raw text ──
    let rawText: string;
    if (args.resumeText) {
      rawText = args.resumeText;
    } else if (args.content && args.fileType) {
      const parsed = await parseResume(args.content, args.fileType);
      rawText = parsed.text;
    } else {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide either resumeText or (content + fileType)" }) }],
      };
    }

    // ── Determine requested aspects ──
    const requestedAspects = args.aspects?.length ? args.aspects : (["all"] as Aspect[]);
    const invalid = requestedAspects.filter((a) => !VALID_ASPECTS.includes(a));
    if (invalid.length) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid aspects: ${invalid.join(", ")}. Valid: ${VALID_ASPECTS.join(", ")}` }) }],
      };
    }

    const wantsAll = requestedAspects.includes("all");
    const wants = (a: Aspect) => wantsAll || requestedAspects.includes(a);

    // ── Run shared pipeline computations (lazy — only what's needed) ──
    const needsClassification = wants("entities") || wants("skills") || wants("experience") || wants("patterns") || wants("similarity") || wants("keywords");
    const needsKeywords = wants("keywords") || wants("skills") || wants("similarity");
    const needsSections = wants("skills") || wants("experience") || wants("patterns") || wants("keywords");
    const needsDates = wants("experience") || wants("patterns");
    const needsMetrics = wants("experience") || wants("patterns");

    const pipeline = wantsAll ? runPipeline(rawText) : undefined;
    const classification = needsClassification
      ? (pipeline ? { entities: pipeline.classification.entities, summary: pipeline.classification.summary } : classifyEntities(rawText))
      : undefined;
    const keywords = needsKeywords ? extractKeywords(rawText) : undefined;
    const sections = needsSections ? detectSections(rawText) : undefined;
    const dates = needsDates ? extractDates(rawText) : undefined;
    const metrics = needsMetrics ? extractMetrics(rawText) : undefined;

    // ── Build result object ──
    const result: Record<string, unknown> = {};

    // Pipeline metadata (only in "all" mode)
    if (wantsAll && pipeline) {
      result.pipeline = {
        overallConfidence: pipeline.overallConfidence,
        totalDurationMs: Math.round(pipeline.totalDurationMs * 100) / 100,
        stages: pipeline.stages.map((s) => ({
          name: s.name, status: s.status,
          durationMs: Math.round(s.durationMs * 100) / 100,
          confidence: Math.round(s.confidence * 100) / 100,
          itemsProcessed: s.itemsProcessed,
        })),
      };
      result.contact = pipeline.patternMatching.contact;

      // Quality assessment (only with full pipeline)
      const EXPECTED_SECTIONS = ["summary", "experience", "education", "skills", "certifications", "projects"];
      const sectionsFound = pipeline.patternMatching.sections.map((s) => s.name);
      const sectionsMissing = EXPECTED_SECTIONS.filter((s) => !sectionsFound.includes(s));
      result.quality = {
        overallConfidence: Math.round(pipeline.overallConfidence * 100) / 100,
        sectionCompleteness: Math.round((sectionsFound.length / EXPECTED_SECTIONS.length) * 100),
        entityDensity: pipeline.classification.summary.totalEntities > 0
          ? Math.round((pipeline.classification.summary.totalEntities / Math.max(1, keywords!.totalTerms)) * 1000) / 10
          : 0,
        averageEntityConfidence: Math.round(pipeline.classification.summary.averageConfidence * 100),
        hasContactInfo: pipeline.patternMatching.contact.emails.length > 0 || pipeline.patternMatching.contact.phones.length > 0,
        hasMetrics: pipeline.patternMatching.metrics.percentages.length > 0 || pipeline.patternMatching.metrics.dollarAmounts.length > 0,
        sections: { found: sectionsFound, missing: sectionsMissing },
        issues: [
          ...(sectionsMissing.length > 0 ? [`Missing sections: ${sectionsMissing.join(", ")}`] : []),
          ...(pipeline.patternMatching.contact.emails.length === 0 ? ["No email detected"] : []),
          ...(pipeline.patternMatching.contact.phones.length === 0 ? ["No phone number detected"] : []),
          ...(pipeline.patternMatching.metrics.percentages.length === 0 && pipeline.patternMatching.metrics.dollarAmounts.length === 0 ? ["No quantifiable metrics/achievements found"] : []),
          ...(pipeline.classification.summary.ambiguousEntities > 3 ? [`${pipeline.classification.summary.ambiguousEntities} ambiguous entities detected`] : []),
        ],
      };
      result.metrics = pipeline.patternMatching.metrics;
    }

    if (wants("keywords") && keywords && classification) {
      result.keywords = buildKeywordsAspect(rawText, keywords, classification as ReturnType<typeof classifyEntities>, args.topKeywords ?? 40);
    }

    if (wants("entities") && classification) {
      result.entities = buildEntitiesAspect(classification as ReturnType<typeof classifyEntities>, args.minEntityConfidence ?? 0, args.entityTypes);
    }

    if (wants("skills") && classification && keywords && sections) {
      result.skills = buildSkillsAspect(rawText, classification as ReturnType<typeof classifyEntities>, keywords, sections, args.requiredSkills);
    }

    if (wants("experience") && classification && keywords && dates && metrics && sections) {
      result.experience = buildExperienceAspect(rawText, classification as ReturnType<typeof classifyEntities>, keywords, dates, metrics, sections);
    }

    if (wants("patterns") && classification && dates && metrics && sections) {
      result.patterns = buildPatternsAspect(rawText, classification as ReturnType<typeof classifyEntities>, dates, metrics, sections);
    }

    if (wants("similarity")) {
      if (!args.jobDescription) {
        result.similarity = { error: "jobDescription is required for similarity analysis" };
      } else if (keywords && classification) {
        result.similarity = buildSimilarityAspect(rawText, args.jobDescription, keywords, classification as ReturnType<typeof classifyEntities>);
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
