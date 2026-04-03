import { z } from "zod";

export const SkillSchema = z.object({
  name: z.string(),
  category: z
    .enum([
      "programming_language",
      "framework",
      "database",
      "devops",
      "soft_skill",
      "tool",
      "methodology",
      "other",
    ])
    .optional(),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  context: z.string().optional(),
});

export const AchievementSchema = z.object({
  description: z.string(),
  metric: z.string().optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  achievements: z.array(AchievementSchema).optional(),
  technologies: z.array(z.string()).optional(),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
});

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  credentialUrl: z.string().optional(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
});

export const ContactInfoSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
  portfolio: z.string().optional(),
});

export const ResumeSchema = z.object({
  contact: ContactInfoSchema,
  summary: z.string().optional(),
  skills: z.array(SkillSchema),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
  languages: z.array(z.string()).optional(),
});

export const JobMatchSchema = z.object({
  overallScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  experienceMatch: z.string(),
  keywordAnalysis: z.object({
    matched: z.array(z.string()),
    missing: z.array(z.string()),
    score: z.number().min(0).max(100),
  }).optional(),
  recommendation: z.string(),
  improvementSuggestions: z.array(z.string()).optional(),
});

export const ResumeSummarySchema = z.object({
  professionalSummary: z.string(),
  topSkills: z.array(z.string()),
  yearsOfExperience: z.number().optional(),
  highlights: z.array(z.string()),
  keyAchievements: z.array(z.string()).optional(),
  suitableRoles: z.array(z.string()),
  strengthAreas: z.array(z.string()).optional(),
  improvementAreas: z.array(z.string()).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;
export type Achievement = z.infer<typeof AchievementSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ContactInfo = z.infer<typeof ContactInfoSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type JobMatch = z.infer<typeof JobMatchSchema>;
export type ResumeSummary = z.infer<typeof ResumeSummarySchema>;
