/**
 * TF-IDF based keyword extraction engine.
 * Used for algorithmic resume analysis before LLM refinement.
 */

// Common English stop words to filter out
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "was", "are", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "need", "dare", "ought", "used", "up", "out",
  "as", "it", "its", "he", "she", "they", "them", "his", "her", "their", "we",
  "our", "your", "my", "this", "that", "these", "those", "i", "me", "you",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very", "just",
  "about", "above", "after", "again", "all", "also", "am", "any", "because",
  "before", "between", "both", "each", "few", "further", "get", "got",
  "here", "how", "into", "more", "most", "new", "now", "only", "other",
  "over", "own", "same", "such", "through", "under", "until", "what",
  "when", "where", "which", "while", "who", "whom", "why", "work", "worked",
  "working", "company", "team", "using", "used", "also", "well", "including",
]);

export interface TfIdfResult {
  term: string;
  tf: number;
  idf: number;
  tfidf: number;
}

export interface KeywordExtractionResult {
  keywords: Array<{ term: string; score: number; frequency: number }>;
  bigrams: Array<{ term: string; score: number; frequency: number }>;
  trigrams: Array<{ term: string; score: number; frequency: number }>;
  totalTerms: number;
  uniqueTerms: number;
}

/**
 * Tokenize text into normalized terms
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Calculate term frequency for a document
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/**
 * Calculate TF-IDF scores using a reference corpus of common resume terms.
 * Since we operate on single documents, we use a synthetic IDF based on
 * how "specific" a term is (technical terms get higher IDF).
 */
export function calculateTfIdf(tokens: string[]): TfIdfResult[] {
  const tf = termFrequency(tokens);
  const totalTokens = tokens.length;
  const results: TfIdfResult[] = [];

  for (const [term, count] of tf) {
    const tfScore = count / totalTokens;
    // Heuristic IDF: longer & less common words are more specific
    const idfScore = Math.log(1 + 10 / (1 + getCorpusFrequency(term)));
    results.push({
      term,
      tf: tfScore,
      idf: idfScore,
      tfidf: tfScore * idfScore,
    });
  }

  return results.sort((a, b) => b.tfidf - a.tfidf);
}

/**
 * Extract n-grams from tokens
 */
export function extractNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(" ");
    ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
  }
  return ngrams;
}

/**
 * Full keyword extraction pipeline
 */
export function extractKeywords(text: string): KeywordExtractionResult {
  const tokens = tokenize(text);
  const tfidfResults = calculateTfIdf(tokens);

  const bigrams = extractNgrams(tokens, 2);
  const trigrams = extractNgrams(tokens, 3);

  return {
    keywords: tfidfResults.slice(0, 50).map((r) => ({
      term: r.term,
      score: r.tfidf,
      frequency: Math.round(r.tf * tokens.length),
    })),
    bigrams: Array.from(bigrams.entries())
      .map(([term, freq]) => ({ term, score: freq / tokens.length, frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 30),
    trigrams: Array.from(trigrams.entries())
      .map(([term, freq]) => ({ term, score: freq / tokens.length, frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20),
    totalTerms: tokens.length,
    uniqueTerms: new Set(tokens).size,
  };
}

// Synthetic corpus frequency — common resume words get low IDF (less important)
const COMMON_RESUME_WORDS = new Set([
  "experience", "responsible", "developed", "managed", "project", "system",
  "data", "software", "design", "development", "application", "business",
  "process", "service", "support", "management", "performance", "solution",
  "client", "customer", "requirements", "technical", "skills", "technology",
  "implemented", "created", "built", "led", "delivered", "improved",
  "analyzed", "maintained", "environment", "platform", "information",
]);

function getCorpusFrequency(term: string): number {
  if (COMMON_RESUME_WORDS.has(term)) return 8;
  if (term.length <= 3) return 6;
  if (term.length <= 5) return 3;
  return 1; // rare/specific terms get high IDF
}
