/**
 * Sanitization Node — Text cleaning and artifact removal.
 *
 * Resolves Gemini's "Format Volatility" truth: input arrives in multiple binary
 * encodings, demanding distinct cleaning before analysis. Also addresses the
 * "Information Density" truth: resumes have high noise-to-signal ratio.
 */

export interface SanitizationResult {
  cleanText: string;
  metrics: {
    originalLength: number;
    cleanedLength: number;
    charsRemoved: number;
    artifactsFound: string[];
    nonAsciiRemoved: number;
    duplicateLinesRemoved: number;
  };
}

// Common PDF extraction artifacts
const PDF_ARTIFACTS = [
  /\f/g, // form feed
  /\x00/g, // null bytes
  /\uFFFD/g, // replacement character
  /\u00AD/g, // soft hyphen
  /[\u200B-\u200F\u2028-\u202F\uFEFF]/g, // zero-width and invisible chars
];

// Header/footer patterns commonly repeated across pages
const PAGE_NOISE_PATTERNS = [
  /^page\s+\d+\s*(of\s+\d+)?$/gim,
  /^\d+\s*$/gm, // standalone page numbers
  /^[-–—]{3,}\s*$/gm, // horizontal rules
  /^[_]{5,}\s*$/gm, // underline separators
  /^\s*confidential\s*$/gim,
  /^\s*curriculum\s+vitae\s*$/gim,
];

/**
 * Sanitize resume text: remove artifacts, normalize whitespace,
 * strip noise, deduplicate repeated lines (page headers/footers).
 */
export function sanitizeText(rawText: string): SanitizationResult {
  const originalLength = rawText.length;
  const artifactsFound: string[] = [];
  let text = rawText;

  // 1. Remove binary/encoding artifacts
  let nonAsciiRemoved = 0;
  for (const pattern of PDF_ARTIFACTS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      nonAsciiRemoved += matches.length;
      artifactsFound.push(`encoding artifacts (${matches.length})`);
    }
    text = text.replace(pattern, " ");
  }

  // 2. Remove page noise (page numbers, separators)
  for (const pattern of PAGE_NOISE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      artifactsFound.push(`page noise: "${matches[0].trim()}" (${matches.length}x)`);
    }
    text = text.replace(pattern, "");
  }

  // 3. Deduplicate repeated lines (page headers/footers appear on every page)
  const lines = text.split("\n");
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 80) {
      lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
    }
  }

  let duplicateLinesRemoved = 0;
  const seenDuplicates = new Set<string>();
  const dedupedLines = lines.filter((line) => {
    const trimmed = line.trim();
    const count = lineCounts.get(trimmed) || 0;
    // If a short line appears 3+ times, it's likely a header/footer — keep first only
    if (count >= 3 && trimmed.length < 80) {
      if (seenDuplicates.has(trimmed)) {
        duplicateLinesRemoved++;
        return false;
      }
      seenDuplicates.add(trimmed);
    }
    return true;
  });

  if (duplicateLinesRemoved > 0) {
    artifactsFound.push(`repeated headers/footers (${duplicateLinesRemoved} lines)`);
  }

  text = dedupedLines.join("\n");

  // 4. Normalize whitespace
  text = text
    .replace(/\r\n/g, "\n") // normalize line endings
    .replace(/\t/g, " ") // tabs to spaces
    .replace(/ {2,}/g, " ") // collapse multiple spaces
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();

  return {
    cleanText: text,
    metrics: {
      originalLength,
      cleanedLength: text.length,
      charsRemoved: originalLength - text.length,
      artifactsFound,
      nonAsciiRemoved,
      duplicateLinesRemoved,
    },
  };
}
