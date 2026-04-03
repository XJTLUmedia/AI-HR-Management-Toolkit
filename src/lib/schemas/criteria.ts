import { z } from "zod";

// ---- Education Criteria ----
export const EducationCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(15),
  minimumDegreeLevel: z
    .enum(["none", "associate", "bachelor", "master", "phd"])
    .default("none"),
  preferredFields: z.array(z.string()).default([]),
  targetUniversities: z.array(z.string()).default([]),
  acceptAnyAccredited: z.boolean().default(true),
});

// ---- Experience Criteria ----
export const ExperienceCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(25),
  minimumYears: z.number().min(0).default(0),
  preferredYearsRange: z
    .object({ min: z.number(), max: z.number() })
    .optional(),
  requiredIndustries: z.array(z.string()).default([]),
  preferredCompanies: z.array(z.string()).default([]),
  requiredJobTitles: z.array(z.string()).default([]),
});

// ---- Skills Criteria ----
export const SkillCriterionSchema = z.object({
  name: z.string(),
  required: z.boolean().default(true),
  minimumProficiency: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .default("intermediate"),
});

export const SkillsCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(25),
  requiredSkills: z.array(SkillCriterionSchema).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  minimumSkillMatchPercent: z.number().min(0).max(100).default(60),
});

// ---- Certifications Criteria ----
export const CertificationsCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(10),
  requiredCertifications: z.array(z.string()).default([]),
  preferredCertifications: z.array(z.string()).default([]),
});

// ---- Knowledge Stack Criteria ----
export const KnowledgeStackCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(10),
  requiredLanguages: z.array(z.string()).default([]),
  requiredFrameworks: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
  requiredDatabases: z.array(z.string()).default([]),
  requiredPlatforms: z.array(z.string()).default([]),
});

// ---- Competitions / Achievements Criteria ----
export const CompetitionsCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(5),
  valuedCompetitions: z.array(z.string()).default([]),
  requirePublications: z.boolean().default(false),
  requirePatents: z.boolean().default(false),
  requireOpenSource: z.boolean().default(false),
});

// ---- Pass Threshold ----
export const ThresholdCriteriaSchema = z.object({
  autoPassPercent: z.number().min(0).max(100).default(80),
  reviewRangePercent: z
    .object({ min: z.number(), max: z.number() })
    .default({ min: 50, max: 79 }),
  autoRejectBelowPercent: z.number().min(0).max(100).default(50),
});

// ---- Job Qualification / Company Fit ----
export const JobQualificationCriteriaSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(10),
  jobDescription: z.string().default(""),
  companyCultureKeywords: z.array(z.string()).default([]),
  softSkillsRequired: z.array(z.string()).default([]),
  leadershipRequired: z.boolean().default(false),
});

// ---- Full Assessment Criteria ----
export const AssessmentCriteriaSchema = z.object({
  name: z.string().default("Default Assessment"),
  description: z.string().default(""),
  education: EducationCriteriaSchema.default(EducationCriteriaSchema.parse({})),
  experience: ExperienceCriteriaSchema.default(ExperienceCriteriaSchema.parse({})),
  skills: SkillsCriteriaSchema.default(SkillsCriteriaSchema.parse({})),
  certifications: CertificationsCriteriaSchema.default(CertificationsCriteriaSchema.parse({})),
  knowledgeStack: KnowledgeStackCriteriaSchema.default(KnowledgeStackCriteriaSchema.parse({})),
  competitions: CompetitionsCriteriaSchema.default(CompetitionsCriteriaSchema.parse({})),
  thresholds: ThresholdCriteriaSchema.default(ThresholdCriteriaSchema.parse({})),
  jobQualification: JobQualificationCriteriaSchema.default(JobQualificationCriteriaSchema.parse({})),
});

export type EducationCriteria = z.infer<typeof EducationCriteriaSchema>;
export type ExperienceCriteria = z.infer<typeof ExperienceCriteriaSchema>;
export type SkillCriterion = z.infer<typeof SkillCriterionSchema>;
export type SkillsCriteria = z.infer<typeof SkillsCriteriaSchema>;
export type CertificationsCriteria = z.infer<typeof CertificationsCriteriaSchema>;
export type KnowledgeStackCriteria = z.infer<typeof KnowledgeStackCriteriaSchema>;
export type CompetitionsCriteria = z.infer<typeof CompetitionsCriteriaSchema>;
export type ThresholdCriteria = z.infer<typeof ThresholdCriteriaSchema>;
export type JobQualificationCriteria = z.infer<typeof JobQualificationCriteriaSchema>;
export type AssessmentCriteria = z.infer<typeof AssessmentCriteriaSchema>;
