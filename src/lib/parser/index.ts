import { parsePdf } from "./pdf";
import { parseDocx } from "./docx";
import { parseText } from "./text";
import { parseMarkdown } from "./markdown";
import { parseUrl } from "./url";

export type FileType = "pdf" | "docx" | "txt" | "md" | "url";

export async function parseResume(
  content: string,
  fileType: FileType
): Promise<{ text: string; pageCount?: number }> {
  if (fileType === "url") {
    return parseUrl(content);
  }

  const buffer = Buffer.from(content, "base64");

  switch (fileType) {
    case "pdf":
      return parsePdf(buffer);
    case "docx": {
      const result = await parseDocx(buffer);
      return { text: result.text };
    }
    case "txt":
      return parseText(buffer);
    case "md":
      return parseMarkdown(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
