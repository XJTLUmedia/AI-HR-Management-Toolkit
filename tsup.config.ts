import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/mcp-stdio.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  dts: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.alias = { "@": "./src" };
  },
  external: [
    "@modelcontextprotocol/sdk",
    "pdf-parse",
    "mammoth",
    "cheerio",
    "exceljs",
    "jspdf",
    "jspdf-autotable",
    "nodemailer",
    "ai",
    "@ai-sdk/openai",
    "@ai-sdk/anthropic",
    "@ai-sdk/google",
    "zod",
  ],
});
