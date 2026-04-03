/**
 * MCP Tool: extract_experience_structured
 *
 * Algorithmic work experience extraction using date patterns, metrics,
 * NER classification, section parsing, and heuristic structuring.
 *
 * 100% algorithmic — no AI calls. This fills the gap where the non-MCP
 * extract_experience tool uses AI for structuring, but this version does
 * it entirely through code using patterns and heuristics.
 */

import {
  classifyEntities,
  extractKeywords,
  extractMetrics,
  extractDates,
  detectSections,
  estimateYearsOfExperience,
  type ClassifiedEntity,
} from "@/lib/analysis";

interface StructuredExperience {
  title: string | null;
  organization: string | null;
  dateRange: { raw: string; start: string; end: string | null } | null;
  durationEstimate: string | null;
  metrics: string[];
  technologies: string[];
  keyAchievements: string[];
  rawContent: string;
  confidence: number;
}

/**
 * Estimate duration from a date range string
 */
function estimateDuration(range: {
  start: string;
  end: string | null;
}): string | null {
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

/**
 * Split experience section content into individual role blocks
 * Uses date ranges as primary boundaries, then blank line heuristics
 */
function splitExperienceBlocks(sectionContent: string): string[] {
  const lines = sectionContent.split("\n");
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  const dateLinePattern =
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\s*[-–—]|(?:20\d{2}|19\d{2})\s*[-–—]\s*(?:20\d{2}|19\d{2}|Present|Current)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this line starts a new date range (potential new role)
    if (i > 0 && dateLinePattern.test(line) && currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n").trim());
      currentBlock = [];
    }

    // Also split on multiple blank lines (common resume formatting)
    if (
      line === "" &&
      i > 0 &&
      lines[i - 1]?.trim() === "" &&
      currentBlock.length > 0
    ) {
      blocks.push(currentBlock.join("\n").trim());
      currentBlock = [];
      continue;
    }

    if (line) currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n").trim());
  }

  return blocks.filter((b) => b.length > 20); // filter trivial blocks
}

/**
 * Extract achievement lines from a text block (lines starting with bullets, •, -, *)
 */
function extractAchievements(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•\-*▪▸►●○◦‣⁃]/.test(l) || /^\d+[.)]\s/.test(l))
    .map((l) => l.replace(/^[•\-*▪▸►●○◦‣⁃\d.)\s]+/, "").trim())
    .filter((l) => l.length > 10);
}

export const mcpExtractExperienceStructuredTool = {
  name: "extract_experience_structured",
  description:
    "Extract and structure work experience from resume text using algorithmic analysis only (no AI). Uses date range detection, metric extraction, NER entity classification (job titles, organizations, skills), and heuristic block splitting to produce structured experience entries. Each entry includes detected title, organization, date range, duration estimate, associated metrics/achievements, and technologies. Returns structured data plus overall career statistics.",
  inputSchema: {
    type: "object" as const,
    properties: {
      resumeText: {
        type: "string",
        description: "The raw text content of a resume",
      },
    },
    required: ["resumeText"],
  },
  handler: async (args: { resumeText: string }) => {
    const text = args.resumeText;

    // Step 1: Core extractions
    const dates = extractDates(text);
    const metrics = extractMetrics(text);
    const sections = detectSections(text);
    const estimatedYears = estimateYearsOfExperience(text);
    const classification = classifyEntities(text);
    const keywords = extractKeywords(text);

    // Step 2: Identify experience section
    const experienceSection = sections.find((s) => s.name === "experience");

    // Step 3: Extract typed entities for cross-referencing
    const jobTitles = classification.entities.filter(
      (e) => e.type === "JOB_TITLE"
    );
    const organizations = classification.entities.filter(
      (e) => e.type === "ORGANIZATION"
    );
    const skillEntities = classification.entities.filter(
      (e) => e.type === "SKILL"
    );

    // Step 4: Structure experience entries
    const experiences: StructuredExperience[] = [];

    if (experienceSection) {
      const blocks = splitExperienceBlocks(experienceSection.content);

      for (const block of blocks) {
        // Find date range in this block
        const blockDates = extractDates(block);
        const dateRange = blockDates.ranges[0] ?? null;

        // Find job title in this block
        const blockJobTitles = jobTitles.filter((jt) =>
          block.toLowerCase().includes(jt.text.toLowerCase())
        );
        const title =
          blockJobTitles.sort((a, b) => b.confidence - a.confidence)[0]
            ?.text ?? null;

        // Find organization in this block
        const blockOrgs = organizations.filter((org) =>
          block.toLowerCase().includes(org.text.toLowerCase())
        );
        const org =
          blockOrgs.sort((a, b) => b.confidence - a.confidence)[0]?.text ??
          null;

        // Find metrics in this block
        const blockMetrics = extractMetrics(block);
        const allMetrics = [
          ...blockMetrics.percentages,
          ...blockMetrics.dollarAmounts,
          ...blockMetrics.teamSizes,
          ...blockMetrics.numbers,
        ];

        // Find technologies/skills in this block
        const blockSkills = skillEntities
          .filter((s) => block.toLowerCase().includes(s.text.toLowerCase()))
          .map((s) => s.text);
        const uniqueSkills = [...new Set(blockSkills)];

        // Extract bullet-point achievements
        const achievements = extractAchievements(block);

        // Duration estimate
        const duration = dateRange ? estimateDuration(dateRange) : null;

        // Confidence based on how much structure we found
        let confidence = 0.3; // base
        if (title) confidence += 0.2;
        if (org) confidence += 0.15;
        if (dateRange) confidence += 0.2;
        if (allMetrics.length > 0) confidence += 0.1;
        if (uniqueSkills.length > 0) confidence += 0.05;
        confidence = Math.min(1, confidence);

        experiences.push({
          title,
          organization: org,
          dateRange,
          durationEstimate: duration,
          metrics: allMetrics,
          technologies: uniqueSkills.slice(0, 15),
          keyAchievements: achievements.slice(0, 8),
          rawContent: block.slice(0, 500),
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    } else {
      // No experience section found — try to reconstruct from date ranges + job titles
      for (const range of dates.ranges) {
        // Find the nearest job title to this date range in the text
        const rangeIdx = text.indexOf(range.raw);
        if (rangeIdx === -1) continue;

        const nearbyText = text.slice(
          Math.max(0, rangeIdx - 300),
          rangeIdx + range.raw.length + 300
        );

        const nearbyTitles = jobTitles.filter((jt) =>
          nearbyText.toLowerCase().includes(jt.text.toLowerCase())
        );
        const nearbyOrgs = organizations.filter((org) =>
          nearbyText.toLowerCase().includes(org.text.toLowerCase())
        );
        const nearbySkills = skillEntities
          .filter((s) =>
            nearbyText.toLowerCase().includes(s.text.toLowerCase())
          )
          .map((s) => s.text);

        const blockMetrics = extractMetrics(nearbyText);

        experiences.push({
          title: nearbyTitles[0]?.text ?? null,
          organization: nearbyOrgs[0]?.text ?? null,
          dateRange: range,
          durationEstimate: estimateDuration(range),
          metrics: [
            ...blockMetrics.percentages,
            ...blockMetrics.dollarAmounts,
            ...blockMetrics.teamSizes,
          ],
          technologies: [...new Set(nearbySkills)].slice(0, 10),
          keyAchievements: extractAchievements(nearbyText).slice(0, 5),
          rawContent: nearbyText.slice(0, 300),
          confidence: 0.4,
        });
      }
    }

    // Step 5: Career timeline analysis
    const allTechnologies = [...new Set(experiences.flatMap((e) => e.technologies))];
    const allMetricsFlat = experiences.flatMap((e) => e.metrics);

    // Career progression detection: check if titles show seniority growth
    const titleProgression = experiences
      .filter((e) => e.title)
      .map((e) => e.title!);

    const seniorityKeywords = {
      intern: 1,
      junior: 2,
      associate: 3,
      mid: 4,
      senior: 5,
      staff: 6,
      principal: 7,
      lead: 6,
      manager: 7,
      director: 8,
      vp: 9,
      chief: 10,
      cto: 10,
      ceo: 10,
    };

    const seniorityScores = titleProgression.map((title) => {
      const lower = title.toLowerCase();
      for (const [keyword, score] of Object.entries(seniorityKeywords)) {
        if (lower.includes(keyword)) return { title, score };
      }
      return { title, score: 4 }; // default mid-level
    });

    const isGrowing =
      seniorityScores.length >= 2 &&
      seniorityScores[0].score >= seniorityScores[seniorityScores.length - 1].score;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            totalExperiences: experiences.length,
            estimatedYearsOfExperience: estimatedYears,
            experiences,
            careerAnalysis: {
              totalDateRangesFound: dates.ranges.length,
              totalMetricsFound: allMetricsFlat.length,
              uniqueTechnologies: allTechnologies.length,
              technologyStack: allTechnologies,
              careerProgression: {
                titles: titleProgression,
                seniorityTrend: isGrowing ? "growing" : "flat_or_declining",
                seniorityScores: seniorityScores,
              },
              metricsBreakdown: {
                percentages: metrics.percentages.length,
                dollarAmounts: metrics.dollarAmounts.length,
                teamSizes: metrics.teamSizes.length,
                numbers: metrics.numbers.length,
                timeframes: metrics.timeframes.length,
              },
            },
            experienceSectionDetected: !!experienceSection,
            allSectionsFound: sections.map((s) => s.name),
          }),
        },
      ],
    };
  },
};
