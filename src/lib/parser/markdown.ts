export async function parseMarkdown(buffer: Buffer): Promise<{ text: string }> {
  const raw = buffer.toString("utf-8").trim();
  if (!raw) {
    throw new Error("Empty markdown file");
  }
  // Strip markdown syntax to produce clean plain text for analysis
  const text = raw
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Convert links to text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove headers markers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, "$1")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove horizontal rules
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Clean up list markers
    .replace(/^[\s]*[-*+]\s+/gm, "• ")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text };
}
