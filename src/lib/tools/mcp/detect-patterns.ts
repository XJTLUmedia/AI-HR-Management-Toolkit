import {
  extractMetrics,
  extractDates,
  detectSections,
  estimateYearsOfExperience,
  classifyEntities,
  extractKeywords,
} from "@/lib/analysis";

// Seniority keywords for career progression detection
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

function detectSeniority(text: string): { level: number; label: string } | null {
  for (const { pattern, level, label } of SENIORITY_MAP.slice().reverse()) {
    if (pattern.test(text)) return { level, label };
  }
  return null;
}

export const mcpDetectPatternsTool = {
  name: "detect_patterns",
  description:
    "Detect and structure date ranges, metrics, sections, and work experience from resume text. Returns structured experience entries with titles, organizations, technologies, and achievements extracted algorithmically using NER, date patterns, and TF-IDF. Also detects career progression trajectory. No AI calls.",
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
    const metrics = extractMetrics(args.resumeText);
    const dates = extractDates(args.resumeText);
    const sections = detectSections(args.resumeText);
    const estimatedYears = estimateYearsOfExperience(args.resumeText);
    const experienceSection = sections.find((s) => s.name === "experience");

    // NER classification for structured experience entries
    const classification = classifyEntities(args.resumeText);
    const jobTitles = classification.entities.filter((e) => e.type === "JOB_TITLE");
    const organizations = classification.entities.filter((e) => e.type === "ORGANIZATION");
    const skills = classification.entities.filter((e) => e.type === "SKILL");

    // Build structured experience entries by mapping date ranges to nearby entities
    const structuredEntries = dates.ranges.map((range) => {
      const rangeIdx = args.resumeText.indexOf(range.raw);
      const nearbyText = rangeIdx >= 0
        ? args.resumeText.slice(
            Math.max(0, rangeIdx - 300),
            rangeIdx + range.raw.length + 500
          )
        : "";

      const title = jobTitles.find((jt) =>
        nearbyText.toLowerCase().includes(jt.text.toLowerCase())
      );
      const org = organizations.find((o) =>
        nearbyText.toLowerCase().includes(o.text.toLowerCase())
      );
      const nearbySkills = skills
        .filter((s) => nearbyText.toLowerCase().includes(s.text.toLowerCase()))
        .map((s) => s.text);
      const nearbyMetrics = extractMetrics(nearbyText);
      const seniority = title ? detectSeniority(title.text) : null;

      // Extract bullet-point achievements from nearby text
      const achievementMatches = nearbyText.match(/(?:^|\n)\s*[•\-\*▪●]\s*(.+)/g) || [];
      const achievements = achievementMatches
        .map((a) => a.replace(/^\s*[•\-\*▪●]\s*/, "").trim())
        .filter((a) => a.length > 15)
        .slice(0, 5);

      return {
        dateRange: { raw: range.raw, start: range.start, end: range.end },
        title: title?.text ?? null,
        titleConfidence: title ? Math.round(title.confidence * 100) / 100 : null,
        organization: org?.text ?? null,
        seniority: seniority,
        technologies: [...new Set(nearbySkills)].slice(0, 10),
        metrics: {
          percentages: nearbyMetrics.percentages,
          dollarAmounts: nearbyMetrics.dollarAmounts,
          teamSizes: nearbyMetrics.teamSizes,
        },
        achievements,
      };
    });

    // Career progression analysis
    const seniorityEntries = structuredEntries
      .filter((e) => e.seniority)
      .sort((a, b) => {
        const aYear = a.dateRange.start ? new Date(a.dateRange.start).getFullYear() : 0;
        const bYear = b.dateRange.start ? new Date(b.dateRange.start).getFullYear() : 0;
        return aYear - bYear;
      });

    let progressionTrend: string;
    if (seniorityEntries.length < 2) {
      progressionTrend = "insufficient_data";
    } else {
      const firstLevel = seniorityEntries[0].seniority!.level;
      const lastLevel = seniorityEntries[seniorityEntries.length - 1].seniority!.level;
      if (lastLevel > firstLevel) progressionTrend = "upward";
      else if (lastLevel < firstLevel) progressionTrend = "lateral_or_transition";
      else progressionTrend = "stable";
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            estimatedYearsOfExperience: estimatedYears,
            // Structured experience entries (algorithmically built)
            experienceEntries: structuredEntries,
            // Career progression
            careerProgression: {
              trend: progressionTrend,
              seniorityTimeline: seniorityEntries.map((e) => ({
                title: e.title,
                level: e.seniority!.label,
                dateRange: e.dateRange.raw,
              })),
              currentLevel: seniorityEntries.length > 0
                ? seniorityEntries[seniorityEntries.length - 1].seniority!.label
                : null,
            },
            // Raw pattern data (still available for advanced use)
            dateRanges: dates.ranges.map((r) => ({ raw: r.raw, start: r.start, end: r.end })),
            standaloneDates: dates.standalone,
            metrics: {
              percentages: metrics.percentages,
              dollarAmounts: metrics.dollarAmounts,
              teamSizes: metrics.teamSizes,
            },
            sections: sections.map((s) => ({
              name: s.name,
              contentPreview: s.content.slice(0, 300),
            })),
          }),
        },
      ],
    };
  },
};
