/**
 * Standalone REST API route for resume analysis.
 *
 * This is the frontend-facing endpoint — completely independent of MCP.
 * The same underlying analysis logic is also available via:
 *   - MCP over stdio (npx mcp-stdio)
 *   - MCP over HTTP (/api/mcp)
 *
 * 100% algorithmic — no AI API keys required.
 */

import { NextRequest, NextResponse } from "next/server";
import { type FileType, parseResume } from "@/lib/parser";

export const maxDuration = 60;

type Aspect = "keywords" | "patterns" | "similarity" | "entities" | "skills" | "experience" | "all";
const VALID_ASPECTS: Aspect[] = ["keywords", "patterns", "similarity", "entities", "skills", "experience", "all"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      resumeText,
      content,
      fileType,
      aspects,
      jobDescription,
      requiredSkills,
      topKeywords,
      minEntityConfidence,
      entityTypes,
    } = body as {
      resumeText?: string;
      content?: string;
      fileType?: FileType;
      aspects?: Aspect[];
      jobDescription?: string;
      requiredSkills?: string[];
      topKeywords?: number;
      minEntityConfidence?: number;
      entityTypes?: string[];
    };

    // Resolve raw text
    let rawText: string;
    if (resumeText) {
      rawText = resumeText;
    } else if (content && fileType) {
      const parsed = await parseResume(content, fileType);
      rawText = parsed.text;
    } else {
      return NextResponse.json(
        { error: "Provide either resumeText or (content + fileType)" },
        { status: 400 }
      );
    }

    // Validate aspects
    const requestedAspects = aspects?.length ? aspects : (["all"] as Aspect[]);
    const invalid = requestedAspects.filter((a) => !VALID_ASPECTS.includes(a));
    if (invalid.length) {
      return NextResponse.json(
        { error: `Invalid aspects: ${invalid.join(", ")}. Valid: ${VALID_ASPECTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Import the handler directly to reuse all analysis logic
    const { mcpAnalyzeResumeTool } = await import("@/lib/tools/mcp/analyze-resume");
    const mcpResult = await mcpAnalyzeResumeTool.handler({
      resumeText: rawText,
      aspects: requestedAspects,
      jobDescription,
      requiredSkills,
      topKeywords,
      minEntityConfidence,
      entityTypes,
    });

    // MCP tools wrap results in { content: [{ type: "text", text: JSON }] }
    // Unwrap for the REST API
    const textContent = mcpResult.content?.[0];
    if (textContent?.type === "text") {
      return NextResponse.json(JSON.parse(textContent.text));
    }

    return NextResponse.json({ error: "Unexpected analysis result format" }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
