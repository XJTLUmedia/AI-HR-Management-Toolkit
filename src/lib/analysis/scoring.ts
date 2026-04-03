/**
 * Cosine similarity, Jaccard index, and scoring algorithms
 * for resume-to-job matching and skill assessment.
 */

import { tokenize, termFrequency } from "./keyword-extractor";

export interface SimilarityResult {
  cosine: number;
  jaccard: number;
  keywordOverlap: KeywordOverlap;
  weightedScore: number;
}

export interface KeywordOverlap {
  matched: string[];
  missing: string[];
  extra: string[];
  matchRate: number;
}

/**
 * Calculate cosine similarity between two text documents
 */
export function cosineSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  const freqA = termFrequency(tokensA);
  const freqB = termFrequency(tokensB);

  // Build vocabulary
  const vocab = new Set([...freqA.keys(), ...freqB.keys()]);

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const term of vocab) {
    const a = freqA.get(term) || 0;
    const b = freqB.get(term) || 0;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Calculate Jaccard similarity (intersection over union of term sets)
 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Analyze keyword overlap between resume and job description
 */
export function analyzeKeywordOverlap(
  resumeText: string,
  jobText: string
): KeywordOverlap {
  const resumeTerms = new Set(tokenize(resumeText));
  const jobTerms = new Set(tokenize(jobText));

  const matched = [...jobTerms].filter((t) => resumeTerms.has(t));
  const missing = [...jobTerms].filter((t) => !resumeTerms.has(t));
  const extra = [...resumeTerms].filter((t) => !jobTerms.has(t));

  return {
    matched,
    missing,
    extra,
    matchRate: jobTerms.size === 0 ? 0 : matched.length / jobTerms.size,
  };
}

/**
 * Comprehensive similarity analysis combining multiple algorithms
 */
export function calculateSimilarity(
  resumeText: string,
  jobDescription: string
): SimilarityResult {
  const cosine = cosineSimilarity(resumeText, jobDescription);
  const jaccard = jaccardSimilarity(resumeText, jobDescription);
  const keywordOverlap = analyzeKeywordOverlap(resumeText, jobDescription);

  // Weighted score: 40% cosine, 30% Jaccard, 30% keyword match rate
  const weightedScore =
    cosine * 0.4 + jaccard * 0.3 + keywordOverlap.matchRate * 0.3;

  return { cosine, jaccard, keywordOverlap, weightedScore };
}

/**
 * Score a candidate's skill match against requirements.
 * Returns a 0-100 score.
 */
export function scoreSkillMatch(
  candidateSkills: string[],
  requiredSkills: string[]
): {
  score: number;
  matched: string[];
  missing: string[];
} {
  const normalizedCandidate = new Set(
    candidateSkills.map((s) => s.toLowerCase().trim())
  );
  const normalizedRequired = requiredSkills.map((s) => s.toLowerCase().trim());

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of normalizedRequired) {
    // Fuzzy match: check if any candidate skill contains the required skill or vice versa
    const found = [...normalizedCandidate].some(
      (cs) => cs.includes(skill) || skill.includes(cs)
    );
    if (found) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const score =
    normalizedRequired.length === 0
      ? 0
      : Math.round((matched.length / normalizedRequired.length) * 100);

  return { score, matched, missing };
}
