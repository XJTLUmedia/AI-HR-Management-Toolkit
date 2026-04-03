import { parseResume, type FileType } from "@/lib/parser";
import { ResumeSchema } from "@/lib/schemas/resume";
import { AssessmentCriteriaSchema } from "@/lib/schemas/criteria";
import { generateStructuredObject } from "@/lib/structured-output";
import {
  assessCandidate,
  estimateYearsOfExperience,
  classifyEntities,
  extractKeywords,
  detectSections,
  extractContact,
  extractMetrics,
  type ClassifiedEntity,
} from "@/lib/analysis";
import type { AIProvider } from "@/lib/ai-model";

/**
 * Build a structured resume from raw text using only algorithmic analysis
 * (NER + TF-IDF + pattern matching). No AI calls required.
 */
function buildStructuredResumeFromAnalysis(text: string) {
  const classification = classifyEntities(text);
  const entities = classification.entities;
  const keywords = extractKeywords(text);
  const sections = detectSections(text);
  const contact = extractContact(text);
  const metrics = extractMetrics(text);

  // Extract name from NER PERSON entities
  const personEntities = entities.filter((e: ClassifiedEntity) => e.type === "PERSON");
  const name = personEntities.length > 0 ? personEntities[0].text : "Unknown";

  // Extract skills from NER SKILL entities + TF-IDF
  type SkillCategory = "programming_language" | "framework" | "database" | "devops" | "soft_skill" | "tool" | "methodology" | "other";
  type SkillProficiency = "beginner" | "intermediate" | "advanced" | "expert";

  const skillEntities = entities.filter((e: ClassifiedEntity) => e.type === "SKILL");
  const skillSet = new Set<string>();
  const skills: Array<{ name: string; category?: SkillCategory; proficiency?: SkillProficiency }> = [];

  for (const e of skillEntities) {
    const normalized = e.text.toLowerCase();
    if (skillSet.has(normalized)) continue;
    skillSet.add(normalized);

    // Estimate proficiency from frequency
    const kwEntry = keywords.keywords.find(
      (k) => k.term.toLowerCase() === normalized
    );
    const frequency = kwEntry?.frequency ?? 1;
    let proficiency: SkillProficiency = "beginner";
    if (frequency >= 5) proficiency = "expert";
    else if (frequency >= 3) proficiency = "advanced";
    else if (frequency >= 2) proficiency = "intermediate";

    skills.push({ name: e.text, proficiency });
  }

  // Also capture high-TF-IDF terms that look like skills
  for (const kw of keywords.keywords.slice(0, 30)) {
    if (skillSet.has(kw.term.toLowerCase())) continue;
    if (/^[a-z\+\#\.]+$/i.test(kw.term) && kw.term.length <= 20) {
      skillSet.add(kw.term.toLowerCase());
      skills.push({ name: kw.term, proficiency: "intermediate" as SkillProficiency });
    }
  }

  // Build experience from NER JOB_TITLE + ORGANIZATION entities
  const jobTitles = entities.filter((e: ClassifiedEntity) => e.type === "JOB_TITLE");
  const orgs = entities.filter((e: ClassifiedEntity) => e.type === "ORGANIZATION");
  const experience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }> = [];

  for (let i = 0; i < Math.max(jobTitles.length, orgs.length); i++) {
    experience.push({
      company: orgs[i]?.text ?? "Unknown",
      title: jobTitles[i]?.text ?? "Unknown",
    });
  }

  // Build education from NER EDUCATION_DEGREE entities
  const eduEntities = entities.filter((e: ClassifiedEntity) => e.type === "EDUCATION_DEGREE");
  const education: Array<{
    institution: string;
    degree?: string;
    field?: string;
  }> = [];

  for (let i = 0; i < eduEntities.length; i++) {
    education.push({
      institution: eduEntities[i]?.text ?? "Unknown",
    });
  }

  // Build certifications from NER CERTIFICATION entities
  const certEntities = entities.filter((e: ClassifiedEntity) => e.type === "CERTIFICATION");
  const certifications = certEntities.map((e) => ({
    name: e.text,
    issuer: "Unknown",
  }));

  // Build summary from summary section or first 500 chars
  const summarySection = sections.find((s) => s.name === "summary");
  const summary = summarySection?.content.slice(0, 500) ?? text.slice(0, 500);

  return {
    contact: {
      name,
      email: contact.emails[0],
      phone: contact.phones[0],
      location: undefined,
    },
    summary,
    skills,
    experience,
    education,
    certifications,
    projects: [],
  };
}

export const mcpAssessCandidateTool = {
  name: "assess_candidate",
  description:
    "Assess a resume against recruiter-defined criteria. Supports 8 criteria axes: Education, Experience, Skills, Certifications, Knowledge Stack, Competitions, Thresholds, and Job Qualification. Returns per-axis scores, weighted overall score, and a pass/review/reject decision.",
  inputSchema: {
    type: "object" as const,
    properties: {
      content: {
        type: "string",
        description:
          "Base64-encoded file content, or URL string when fileType is 'url', or plain resume text when fileType is 'txt'",
      },
      fileType: {
        type: "string",
        enum: ["pdf", "docx", "txt", "md", "url"],
        description: "File type",
      },
      criteria: {
        type: "object",
        description: `Assessment criteria object. Structure:
{
  name: string,
  education: { enabled, weight, minimumDegreeLevel, preferredFields, targetUniversities, acceptAnyAccredited },
  experience: { enabled, weight, minimumYears, preferredYearsRange, requiredIndustries, preferredCompanies, requiredJobTitles },
  skills: { enabled, weight, requiredSkills: [{name, required, minimumProficiency}], niceToHaveSkills, minimumSkillMatchPercent },
  certifications: { enabled, weight, requiredCertifications, preferredCertifications },
  knowledgeStack: { enabled, weight, requiredLanguages, requiredFrameworks, requiredTools, requiredDatabases, requiredPlatforms },
  competitions: { enabled, weight, valuedCompetitions, requirePublications, requirePatents, requireOpenSource },
  thresholds: { autoPassPercent, reviewRangePercent, autoRejectBelowPercent },
  jobQualification: { enabled, weight, jobDescription, companyCultureKeywords, softSkillsRequired, leadershipRequired }
}`,
      },
      provider: {
        type: "string",
        description: "AI provider (openai, anthropic, google, deepseek, etc.)",
      },
      apiKey: {
        type: "string",
        description: "API key for the AI provider",
      },
      model: {
        type: "string",
        description: "Model name",
      },
    },
    required: ["content", "fileType", "criteria"],
  },
  handler: async (args: {
    content: string;
    fileType: FileType;
    criteria: Record<string, unknown>;
    provider?: string;
    apiKey?: string;
    model?: string;
  }) => {
    const criteria = AssessmentCriteriaSchema.parse(args.criteria);

    const parsed = await parseResume(args.content, args.fileType);
    const text = parsed.text;

    // If AI provider is available, use AI to structure the resume
    let structured;
    if (args.provider && args.apiKey && args.model) {
      structured = await generateStructuredObject({
        config: {
          provider: args.provider as AIProvider,
          apiKey: args.apiKey,
          model: args.model,
        },
        schema: ResumeSchema,
        prompt: `Parse the following resume text into a structured format. Extract contact info, summary, skills with proficiency, experience, education, certifications, and projects.\n\nResume:\n${text}`,
      });
    } else {
      // Algorithmic fallback: build structured resume from NER + TF-IDF + pattern matching
      structured = buildStructuredResumeFromAnalysis(text);
    }

    const estimatedYears = estimateYearsOfExperience(text);
    const assessment = assessCandidate(structured, criteria, estimatedYears);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            assessment,
            criteriaUsed: { name: criteria.name, description: criteria.description },
            resumePreview: {
              name: structured.contact?.name,
              skillCount: structured.skills?.length ?? 0,
              experienceCount: structured.experience?.length ?? 0,
              estimatedYears,
            },
          }),
        },
      ],
    };
  },
};
