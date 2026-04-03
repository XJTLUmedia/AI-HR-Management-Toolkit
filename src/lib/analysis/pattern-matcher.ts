/**
 * Regex-based pattern matching for structured data extraction from resume text.
 * Extracts metrics, dates, contact info, and other patterns algorithmically.
 */

export interface ExtractedMetrics {
  percentages: string[];
  dollarAmounts: string[];
  numbers: string[];
  timeframes: string[];
  teamSizes: string[];
}

export interface ExtractedDates {
  ranges: Array<{ raw: string; start: string; end: string | null }>;
  standalone: string[];
}

export interface ExtractedContact {
  emails: string[];
  phones: string[];
  urls: string[];
  linkedinUrls: string[];
  githubUrls: string[];
}

export interface SectionBoundary {
  name: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

/**
 * Extract quantifiable metrics from text
 */
export function extractMetrics(text: string): ExtractedMetrics {
  const percentages = [
    ...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g),
  ].map((m) => m[0]);

  const dollarAmounts = [
    ...text.matchAll(/\$\s*[\d,]+(?:\.\d+)?(?:\s*(?:M|K|B|million|billion|thousand))?/gi),
  ].map((m) => m[0]);

  const numbers = [
    ...text.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:\+|x|times|fold)\b/gi),
  ].map((m) => m[0]);

  const timeframes = [
    ...text.matchAll(/\b\d+\s*(?:\+\s*)?(?:years?|months?|weeks?|days?)\b/gi),
  ].map((m) => m[0]);

  const teamSizes = [
    ...text.matchAll(/(?:team\s+of\s+|led\s+|managed\s+|supervised\s+)(\d+)/gi),
  ].map((m) => m[0]);

  return { percentages, dollarAmounts, numbers, timeframes, teamSizes };
}

/**
 * Extract date ranges (e.g., "Jan 2020 - Present", "2019-2021")
 */
export function extractDates(text: string): ExtractedDates {
  const monthPattern =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

  // Date ranges: "Month Year - Month Year" or "Month Year - Present"
  const rangeRegex = new RegExp(
    `(${monthPattern}\\s+\\d{4})\\s*[-–—]\\s*(${monthPattern}\\s+\\d{4}|Present|Current|Now)`,
    "gi"
  );
  const ranges: ExtractedDates["ranges"] = [];
  for (const m of text.matchAll(rangeRegex)) {
    ranges.push({ raw: m[0], start: m[1], end: m[2] });
  }

  // Year ranges: "2019 - 2021"
  const yearRangeRegex = /\b(20\d{2})\s*[-–—]\s*(20\d{2}|Present|Current|Now)\b/gi;
  for (const m of text.matchAll(yearRangeRegex)) {
    if (!ranges.some((r) => r.raw.includes(m[0]))) {
      ranges.push({ raw: m[0], start: m[1], end: m[2] });
    }
  }

  // Standalone dates
  const standaloneRegex = new RegExp(
    `\\b${monthPattern}\\s+\\d{4}\\b`,
    "gi"
  );
  const standalone = [...text.matchAll(standaloneRegex)]
    .map((m) => m[0])
    .filter((d) => !ranges.some((r) => r.raw.includes(d)));

  return { ranges, standalone };
}

/**
 * Extract contact information using patterns
 */
export function extractContact(text: string): ExtractedContact {
  const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map(
    (m) => m[0]
  );

  const phones = [
    ...text.matchAll(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
    ),
  ].map((m) => m[0]);

  const urls = [
    ...text.matchAll(
      /https?:\/\/[^\s,;)}\]>'"]+/gi
    ),
  ].map((m) => m[0]);

  const linkedinUrls = urls.filter((u) =>
    u.toLowerCase().includes("linkedin.com")
  );
  const githubUrls = urls.filter((u) =>
    u.toLowerCase().includes("github.com")
  );

  return { emails, phones, urls, linkedinUrls, githubUrls };
}

/**
 * Detect resume sections using common headings
 */
export function detectSections(text: string): SectionBoundary[] {
  const sectionPatterns = [
    { name: "summary", pattern: /\b(?:summary|profile|objective|about\s+me)\b/i },
    { name: "experience", pattern: /\b(?:experience|employment|work\s+history|professional\s+experience)\b/i },
    { name: "education", pattern: /\b(?:education|academic|qualifications|degree)\b/i },
    { name: "skills", pattern: /\b(?:skills|technical\s+skills|competencies|technologies|expertise)\b/i },
    { name: "certifications", pattern: /\b(?:certifications?|licenses?|credentials?)\b/i },
    { name: "projects", pattern: /\b(?:projects?|portfolio)\b/i },
    { name: "languages", pattern: /\b(?:languages?)\b/i },
    { name: "awards", pattern: /\b(?:awards?|honors?|achievements?)\b/i },
    { name: "publications", pattern: /\b(?:publications?|papers?|research)\b/i },
    { name: "volunteer", pattern: /\b(?:volunteer|community|extracurricular)\b/i },
  ];

  const lines = text.split("\n");
  const sectionStarts: Array<{ name: string; lineIndex: number; charIndex: number }> = [];

  let charOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Section headings are typically short lines (< 60 chars)
    if (line.length > 0 && line.length < 60) {
      for (const sp of sectionPatterns) {
        if (sp.pattern.test(line)) {
          sectionStarts.push({
            name: sp.name,
            lineIndex: i,
            charIndex: charOffset,
          });
          break;
        }
      }
    }
    charOffset += lines[i].length + 1;
  }

  const sections: SectionBoundary[] = [];
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const endIndex =
      i + 1 < sectionStarts.length
        ? sectionStarts[i + 1].charIndex
        : text.length;

    sections.push({
      name: start.name,
      startIndex: start.charIndex,
      endIndex,
      content: text.slice(start.charIndex, endIndex).trim(),
    });
  }

  return sections;
}

/**
 * Calculate total years of experience from date ranges
 */
export function estimateYearsOfExperience(text: string): number {
  const dates = extractDates(text);
  let totalMonths = 0;

  for (const range of dates.ranges) {
    const startDate = parseApproximateDate(range.start);
    const endDate =
      range.end && /present|current|now/i.test(range.end)
        ? new Date()
        : parseApproximateDate(range.end || "");

    if (startDate && endDate) {
      const months =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      if (months > 0 && months < 360) {
        totalMonths += months;
      }
    }
  }

  return Math.round((totalMonths / 12) * 10) / 10;
}

function parseApproximateDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const monthMap: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };

  // "January 2020", "Jan 2020"
  const monthYear = dateStr.match(/(\w+)\s+(\d{4})/);
  if (monthYear) {
    const month = monthMap[monthYear[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(monthYear[2]), month);
    }
  }

  // Just year: "2020"
  const yearOnly = dateStr.match(/\b(20\d{2})\b/);
  if (yearOnly) {
    return new Date(parseInt(yearOnly[1]), 0);
  }

  return null;
}
