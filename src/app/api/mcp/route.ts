import { createResumeParserMcpServer } from "@/lib/mcp-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

async function handleMcpRequest(req: Request): Promise<Response> {
  try {
    const server = createResumeParserMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless for Vercel serverless
    });

    await server.connect(transport);

    return transport.handleRequest(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: Request) {
  const accept = req.headers.get("accept") || "";
  // Browser visit — return server info instead of crashing
  if (!accept.includes("text/event-stream") && !accept.includes("application/json")) {
    return new Response(
      JSON.stringify({
        name: "ai-hr-management-toolkit",
        version: "3.1.1",
        protocol: "MCP (Model Context Protocol)",
        transport: "Streamable HTTP",
        tools: 21,
        description:
          "AI HR Management Toolkit MCP server. Connect via an MCP client (Claude Desktop, Cursor, VS Code Copilot) or use: npx @modelcontextprotocol/inspector https://ai-hr-management-toolkit.vercel.app/api/mcp",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
