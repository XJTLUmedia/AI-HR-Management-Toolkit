import * as cheerio from "cheerio";

export async function parseUrl(url: string): Promise<{ text: string }> {
  const validUrl = new URL(url); // throws if invalid
  if (!["http:", "https:"].includes(validUrl.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ResumeParser/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, iframe, noscript, svg").remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $(".sidebar, .nav, .footer, .header, .menu, .ad, .advertisement").remove();

  let text: string;
  const isLinkedIn = validUrl.hostname.includes("linkedin.com");

  if (isLinkedIn) {
    text = extractLinkedInProfile($);
  } else {
    text = extractGenericResume($);
  }

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text || text.length < 50) {
    throw new Error(
      "Could not extract meaningful content from this URL. The page may require authentication or use client-side rendering."
    );
  }

  return { text };
}

function extractLinkedInProfile($: cheerio.CheerioAPI): string {
  const sections: string[] = [];

  // Profile name and headline
  const name = $("h1").first().text().trim();
  const headline = $(".text-body-medium").first().text().trim() ||
    $('[data-generated-suggestion-target]').first().text().trim();
  if (name) sections.push(`Name: ${name}`);
  if (headline) sections.push(`Headline: ${headline}`);

  // About/Summary
  const about = $("#about").parent().find(".display-flex .visually-hidden").text().trim() ||
    $('section:contains("About")').find("span.visually-hidden").text().trim();
  if (about) sections.push(`\nSummary:\n${about}`);

  // Experience section
  const experienceItems: string[] = [];
  $('section:contains("Experience")').find("li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 10) experienceItems.push(text);
  });
  if (experienceItems.length) {
    sections.push(`\nExperience:\n${experienceItems.join("\n")}`);
  }

  // Education section
  const educationItems: string[] = [];
  $('section:contains("Education")').find("li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 10) educationItems.push(text);
  });
  if (educationItems.length) {
    sections.push(`\nEducation:\n${educationItems.join("\n")}`);
  }

  // Skills section
  const skills: string[] = [];
  $('section:contains("Skills")').find("li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 2 && text.length < 100) skills.push(text);
  });
  if (skills.length) {
    sections.push(`\nSkills:\n${skills.join(", ")}`);
  }

  // Fallback: just get all visible text from the main content
  if (sections.length < 3) {
    const mainContent = $("main").text() || $("body").text();
    return mainContent.replace(/\s+/g, " ").trim();
  }

  return sections.join("\n");
}

function extractGenericResume($: cheerio.CheerioAPI): string {
  // Try common resume container selectors
  const selectors = [
    "main",
    "article",
    '[role="main"]',
    ".resume",
    ".cv",
    ".profile",
    ".content",
    "#content",
    "#main",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return el.text().trim();
    }
  }

  // Fallback: body text
  return $("body").text().trim();
}
