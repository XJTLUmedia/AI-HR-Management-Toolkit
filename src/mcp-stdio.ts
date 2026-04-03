import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createResumeParserMcpServer } from "./lib/mcp-server";

async function main() {
  const server = createResumeParserMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
