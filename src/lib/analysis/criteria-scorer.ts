/**
 * Criteria-based candidate assessment scorer.
 *
 * Evaluates a parsed resume against recruiter-defined AssessmentCriteria,
 * producing per-axis scores and a weighted overall score with pass/review/reject decision.
 */

import type { Resume } from "@/lib/schemas/resume";
import type { AssessmentCriteria } from "@/lib/schemas/criteria";
import { calculateSimilarity, scoreSkillMatch } from "@/lib/analysis";

// ---- Public types ----

export interface AxisScore {
  axis: string;
  score: number; // 0-100
  weight: number;
  enabled: boolean;
  details: Record<string, unknown>;
}

export interface AssessmentResult {
  overallScore: number; // 0-100 weighted
  decision: "pass" | "review" | "reject";
  axes: AxisScore[];
  summary: string;
}

// ---- Helpers ----

const DEGREE_RANK: Record<string, number> = {
  none: 0,
  associate: 1,
  bachelor: 2,
  master: 3,
  phd: 4,
};

function normDeg(raw: string): string {
  const l = raw.toLowerCase();
  if (/ph\.?d|doctor/i.test(l)) return "phd";
  if (/master|m\.?s\.?|m\.?b\.?a\.?|m\.?eng/i.test(l)) return "master";
  if (/bachelor|b\.?s\.?|b\.?a\.?|b\.?eng/i.test(l)) return "bachelor";
  if (/associate/i.test(l)) return "associate";
  return "none";
}

function fuzzyMatch(candidate: string, target: string): boolean {
  const c = candidate.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  return c.includes(t) || t.includes(c);
}

function fuzzyMatchAny(candidate: string, targets: string[]): boolean {
  return targets.some((t) => fuzzyMatch(candidate, t));
}

// ---- Axis scorers ----

function scoreEducation(
  resume: Resume,
  c: AssessmentCriteria["education"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Education", score: 0, weight: c.weight, enabled: false, details: {} };

  let score = 0;
  const details: Record<string, unknown> = {};

  // Degree level
  const degrees = resume.education.map((e) => normDeg(e.degree ?? ""));
  const maxDegree = degrees.reduce(
    (max, d) => (DEGREE_RANK[d] > DEGREE_RANK[max] ? d : max),
    "none"
  );
  const meetsMin = DEGREE_RANK[maxDegree] >= DEGREE_RANK[c.minimumDegreeLevel];
  details.highestDegree = maxDegree;
  details.meetsMinimumDegree = meetsMin;
  if (meetsMin) score += 40;

  // Preferred fields
  if (c.preferredFields.length > 0) {
    const fieldHits = resume.education.filter((e) =>
      fuzzyMatchAny(e.field ?? "", c.preferredFields)
    );
    const fieldRate = fieldHits.length / Math.max(1, c.preferredFields.length);
    score += Math.round(Math.min(1, fieldRate) * 30);
    details.fieldMatches = fieldHits.map((e) => e.field);
  } else {
    score += 30; // no field filter → full marks
  }

  // Target universities
  if (c.targetUniversities.length > 0) {
    const uniHits = resume.education.filter((e) =>
      fuzzyMatchAny(e.institution, c.targetUniversities)
    );
    if (uniHits.length > 0) {
      score += 30;
      details.universityMatches = uniHits.map((e) => e.institution);
    }
  } else if (c.acceptAnyAccredited) {
    score += resume.education.length > 0 ? 30 : 0;
  }

  return { axis: "Education", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

function scoreExperience(
  resume: Resume,
  c: AssessmentCriteria["experience"],
  estimatedYears: number
): AxisScore {
  if (!c.enabled)
    return { axis: "Experience", score: 0, weight: c.weight, enabled: false, details: {} };

  let score = 0;
  const details: Record<string, unknown> = { estimatedYears };

  // Years check
  if (estimatedYears >= c.minimumYears) {
    score += 35;
    details.meetsMinimumYears = true;
  } else {
    const ratio = c.minimumYears > 0 ? estimatedYears / c.minimumYears : 0;
    score += Math.round(ratio * 35);
    details.meetsMinimumYears = false;
  }

  // Preferred range bonus
  if (c.preferredYearsRange) {
    if (
      estimatedYears >= c.preferredYearsRange.min &&
      estimatedYears <= c.preferredYearsRange.max
    ) {
      score += 15;
      details.inPreferredRange = true;
    }
  } else {
    score += 15;
  }

  // Industry match
  if (c.requiredIndustries.length > 0) {
    const expText = resume.experience.map((e) => `${e.company} ${e.title} ${e.description ?? ""}`).join(" ");
    const matched = c.requiredIndustries.filter((ind) =>
      expText.toLowerCase().includes(ind.toLowerCase())
    );
    const rate = matched.length / c.requiredIndustries.length;
    score += Math.round(rate * 25);
    details.industryMatches = matched;
    details.industryMissing = c.requiredIndustries.filter((i) => !matched.includes(i));
  } else {
    score += 25;
  }

  // Company match
  if (c.preferredCompanies.length > 0) {
    const companyHits = resume.experience.filter((e) =>
      fuzzyMatchAny(e.company, c.preferredCompanies)
    );
    if (companyHits.length > 0) {
      score += 25;
      details.companyMatches = companyHits.map((e) => e.company);
    }
  } else {
    score += 25;
  }

  return { axis: "Experience", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

function scoreSkills(
  resume: Resume,
  c: AssessmentCriteria["skills"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Skills", score: 0, weight: c.weight, enabled: false, details: {} };

  const candidateSkillNames = resume.skills.map((s) => s.name);
  const requiredNames = c.requiredSkills.map((s) => s.name);
  const match = scoreSkillMatch(candidateSkillNames, requiredNames);

  let score = 0;
  const details: Record<string, unknown> = {
    matchedRequired: match.matched,
    missingRequired: match.missing,
    requiredMatchRate: match.score,
  };

  // Required skills (70% of axis)
  score += Math.round((match.score / 100) * 70);

  // Nice-to-have skills (30% of axis)
  if (c.niceToHaveSkills.length > 0) {
    const niceMatch = scoreSkillMatch(candidateSkillNames, c.niceToHaveSkills);
    score += Math.round((niceMatch.score / 100) * 30);
    details.matchedNiceToHave = niceMatch.matched;
  } else {
    score += 30;
  }

  return { axis: "Skills", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

function scoreCertifications(
  resume: Resume,
  c: AssessmentCriteria["certifications"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Certifications", score: 0, weight: c.weight, enabled: false, details: {} };

  const candidateCerts = (resume.certifications ?? []).map((cert) => cert.name);
  let score = 0;
  const details: Record<string, unknown> = {};

  // Required certs (60%)
  if (c.requiredCertifications.length > 0) {
    const match = scoreSkillMatch(candidateCerts, c.requiredCertifications);
    score += Math.round((match.score / 100) * 60);
    details.matchedRequired = match.matched;
    details.missingRequired = match.missing;
  } else {
    score += 60;
  }

  // Preferred certs (40%)
  if (c.preferredCertifications.length > 0) {
    const match = scoreSkillMatch(candidateCerts, c.preferredCertifications);
    score += Math.round((match.score / 100) * 40);
    details.matchedPreferred = match.matched;
  } else {
    score += 40;
  }

  return { axis: "Certifications", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

function scoreKnowledgeStack(
  resume: Resume,
  c: AssessmentCriteria["knowledgeStack"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Knowledge Stack", score: 0, weight: c.weight, enabled: false, details: {} };

  const allSkills = resume.skills.map((s) => s.name);
  const allTech = resume.experience.flatMap((e) => e.technologies ?? []);
  const candidate = [...new Set([...allSkills, ...allTech])];

  const allRequired = [
    ...c.requiredLanguages,
    ...c.requiredFrameworks,
    ...c.requiredTools,
    ...c.requiredDatabases,
    ...c.requiredPlatforms,
  ];

  if (allRequired.length === 0) {
    return { axis: "Knowledge Stack", score: 100, weight: c.weight, enabled: true, details: { noRequirements: true } };
  }

  const match = scoreSkillMatch(candidate, allRequired);
  const details: Record<string, unknown> = {
    matched: match.matched,
    missing: match.missing,
    matchRate: match.score,
  };

  return { axis: "Knowledge Stack", score: match.score, weight: c.weight, enabled: true, details };
}

function scoreCompetitions(
  resume: Resume,
  c: AssessmentCriteria["competitions"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Competitions", score: 0, weight: c.weight, enabled: false, details: {} };

  let score = 0;
  const details: Record<string, unknown> = {};
  const fullText = [
    resume.summary ?? "",
    ...resume.experience.map((e) => `${e.description ?? ""} ${(e.highlights ?? []).join(" ")}`),
    ...(resume.projects ?? []).map((p) => `${p.name} ${p.description ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();

  // Valued competitions
  if (c.valuedCompetitions.length > 0) {
    const found = c.valuedCompetitions.filter((comp) =>
      fullText.includes(comp.toLowerCase())
    );
    const rate = found.length / c.valuedCompetitions.length;
    score += Math.round(rate * 40);
    details.competitionsFound = found;
  } else {
    score += 40;
  }

  // Publications
  if (c.requirePublications) {
    const hasPub = /publication|paper|journal|conference|presented|published/i.test(fullText);
    if (hasPub) score += 20;
    details.hasPublications = hasPub;
  } else {
    score += 20;
  }

  // Patents
  if (c.requirePatents) {
    const hasPat = /patent/i.test(fullText);
    if (hasPat) score += 20;
    details.hasPatents = hasPat;
  } else {
    score += 20;
  }

  // Open source
  if (c.requireOpenSource) {
    const hasOS = /open[\s-]?source|github|contributor|maintained/i.test(fullText);
    if (hasOS) score += 20;
    details.hasOpenSource = hasOS;
  } else {
    score += 20;
  }

  return { axis: "Competitions", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

function scoreJobQualification(
  resume: Resume,
  c: AssessmentCriteria["jobQualification"]
): AxisScore {
  if (!c.enabled)
    return { axis: "Job Qualification", score: 0, weight: c.weight, enabled: false, details: {} };

  let score = 0;
  const details: Record<string, unknown> = {};

  const resumeText = [
    resume.summary ?? "",
    ...resume.skills.map((s) => s.name),
    ...resume.experience.map((e) => `${e.title} ${e.company} ${e.description ?? ""} ${(e.highlights ?? []).join(" ")}`),
  ].join(" ");

  // JD text matching (50%)
  if (c.jobDescription.trim()) {
    const sim = calculateSimilarity(resumeText, c.jobDescription);
    score += Math.round(sim.weightedScore * 50);
    details.jdMatchScore = Math.round(sim.weightedScore * 100);
    details.matchedKeywords = sim.keywordOverlap.matched.slice(0, 15);
    details.missingKeywords = sim.keywordOverlap.missing.slice(0, 15);
  } else {
    score += 50;
  }

  // Soft skills (25%)
  if (c.softSkillsRequired.length > 0) {
    const resumeSkillNames = resume.skills.map((s) => s.name);
    const match = scoreSkillMatch(resumeSkillNames, c.softSkillsRequired);
    score += Math.round((match.score / 100) * 25);
    details.softSkillMatched = match.matched;
    details.softSkillMissing = match.missing;
  } else {
    score += 25;
  }

  // Culture keywords (15%)
  if (c.companyCultureKeywords.length > 0) {
    const lower = resumeText.toLowerCase();
    const found = c.companyCultureKeywords.filter((kw) =>
      lower.includes(kw.toLowerCase())
    );
    const rate = found.length / c.companyCultureKeywords.length;
    score += Math.round(rate * 15);
    details.cultureKeywordsFound = found;
  } else {
    score += 15;
  }

  // Leadership (10%)
  if (c.leadershipRequired) {
    const lower = resumeText.toLowerCase();
    const hasLeadership = /\b(led|managed|supervised|director|head|vp|chief|mentor|team\s+lead)\b/i.test(lower);
    if (hasLeadership) score += 10;
    details.hasLeadershipSignals = hasLeadership;
  } else {
    score += 10;
  }

  return { axis: "Job Qualification", score: Math.min(100, score), weight: c.weight, enabled: true, details };
}

// ---- Main entry ----

export function assessCandidate(
  resume: Resume,
  criteria: AssessmentCriteria,
  estimatedYears: number = 0
): AssessmentResult {
  const axes: AxisScore[] = [
    scoreEducation(resume, criteria.education),
    scoreExperience(resume, criteria.experience, estimatedYears),
    scoreSkills(resume, criteria.skills),
    scoreCertifications(resume, criteria.certifications),
    scoreKnowledgeStack(resume, criteria.knowledgeStack),
    scoreCompetitions(resume, criteria.competitions),
    scoreJobQualification(resume, criteria.jobQualification),
  ];

  // Weighted score (only from enabled axes)
  const enabledAxes = axes.filter((a) => a.enabled);
  const totalWeight = enabledAxes.reduce((sum, a) => sum + a.weight, 0);

  const overallScore =
    totalWeight > 0
      ? Math.round(
          enabledAxes.reduce((sum, a) => sum + (a.score * a.weight) / totalWeight, 0)
        )
      : 0;

  // Decision
  const t = criteria.thresholds;
  let decision: AssessmentResult["decision"] = "review";
  if (overallScore >= t.autoPassPercent) decision = "pass";
  else if (overallScore < t.autoRejectBelowPercent) decision = "reject";

  // Summary
  const topStrengths = enabledAxes
    .filter((a) => a.score >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((a) => a.axis);
  const topWeaknesses = enabledAxes
    .filter((a) => a.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((a) => a.axis);

  const summary = [
    `Overall: ${overallScore}/100 → ${decision.toUpperCase()}.`,
    topStrengths.length > 0 ? `Strengths: ${topStrengths.join(", ")}.` : "",
    topWeaknesses.length > 0 ? `Gaps: ${topWeaknesses.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { overallScore, decision, axes, summary };
}
