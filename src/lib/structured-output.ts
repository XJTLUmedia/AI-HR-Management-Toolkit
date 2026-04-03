import { generateText, Output } from "ai";
import { z } from "zod";
import { getModel, type AIProvider, type ModelConfig } from "@/lib/ai-model";

const MANUAL_JSON_PROVIDERS = new Set<AIProvider>([
  "deepseek",
  "glm",
  "qwen",
  "openrouter",
  "opencodezen",
]);

function usesManualJsonPrompt(provider: AIProvider): boolean {
  return MANUAL_JSON_PROVIDERS.has(provider);
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function extractBalancedJson(text: string): string {
  const normalized = stripMarkdownCodeFence(text);
  const startIndex = [...normalized].findIndex((char) => char === "{" || char === "[");

  if (startIndex === -1) {
    return normalized;
  }

  const opening = normalized[startIndex];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return normalized.slice(startIndex, index + 1);
      }
    }
  }

  return normalized;
}

function buildJsonOnlyPrompt(prompt: string, schema: z.ZodTypeAny): string {
  const schemaJson = JSON.stringify(z.toJSONSchema(schema), null, 2);

  return `${prompt}

Return only a valid JSON object. Do not include markdown fences, explanations, or extra text.
Use this JSON Schema exactly:
${schemaJson}`;
}

export async function generateStructuredObject<TSchema extends z.ZodTypeAny>({
  config,
  schema,
  prompt,
}: {
  config: Required<Pick<ModelConfig, "provider" | "apiKey" | "model">>;
  schema: TSchema;
  prompt: string;
}): Promise<z.infer<TSchema>> {
  const model = getModel(config);

  if (!usesManualJsonPrompt(config.provider)) {
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      prompt,
    });

    return output as z.infer<TSchema>;
  }

  const { output } = await generateText({
    model,
    output: Output.text(),
    prompt: buildJsonOnlyPrompt(prompt, schema),
  });

  const extractedJson = extractBalancedJson(output);
  const parsed = JSON.parse(extractedJson);
  return schema.parse(parsed);
}
