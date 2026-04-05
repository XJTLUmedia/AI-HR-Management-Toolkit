/**
 * Standalone REST API route for parsing health monitoring.
 *
 * This is the frontend-facing endpoint — completely independent of MCP.
 * The same underlying health logic is also available via:
 *   - MCP over stdio (npx mcp-stdio)
 *   - MCP over HTTP (/api/mcp)
 *
 * Supports: drift detection, review queue, corrections, learned patterns, baseline calibration.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

type HealthAction =
  | "check_drift"
  | "current_stats"
  | "review_queue"
  | "submit_correction"
  | "feedback_stats"
  | "learned_patterns"
  | "calibrate_baseline";

const VALID_ACTIONS: HealthAction[] = [
  "check_drift", "current_stats", "review_queue",
  "submit_correction", "feedback_stats", "learned_patterns",
  "calibrate_baseline",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, correction, limit, patternFilter, patternId } = body as {
      action?: string;
      correction?: {
        parseId: string;
        field: string;
        parsedValue: string;
        correctedValue: string;
        rawContext: string;
        errorType: string;
        fileType?: string;
      };
      limit?: number;
      patternFilter?: string;
      patternId?: string;
    };

    if (!action || !VALID_ACTIONS.includes(action as HealthAction)) {
      return NextResponse.json(
        { error: `Invalid or missing action. Valid: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Import the handler directly to reuse all health logic
    const { mcpParsingHealthTool } = await import("@/lib/tools/mcp/parsing-health");
    const mcpResult = mcpParsingHealthTool.handler({
      action: action as HealthAction,
      correction: correction as Parameters<typeof mcpParsingHealthTool.handler>[0]["correction"],
      limit,
      patternFilter: patternFilter as "all" | "unincorporated" | "confirmed" | undefined,
      patternId,
    });

    // MCP tools wrap results in { content: [{ type: "text", text: JSON }] }
    // Unwrap for the REST API
    const textContent = mcpResult.content?.[0];
    if (textContent?.type === "text") {
      return NextResponse.json(JSON.parse(textContent.text));
    }

    return NextResponse.json({ error: "Unexpected result format" }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Health check failed" },
      { status: 500 }
    );
  }
}
