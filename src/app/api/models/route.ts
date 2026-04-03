import { NextRequest, NextResponse } from "next/server";
import { fetchModelsForProvider, PROVIDERS, type AIProvider } from "@/lib/ai-model";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") as AIProvider | null;
  const apiKey = req.headers.get("x-api-key") || "";

  if (!provider || !PROVIDERS[provider]) {
    return NextResponse.json(
      { error: "Invalid or missing provider parameter" },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key is required to fetch live models" },
      { status: 401 }
    );
  }

  try {
    const models = await fetchModelsForProvider(provider, apiKey);
    return NextResponse.json({
      provider,
      models,
      defaultModel: models[0] ?? null,
      isFallback: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch models",
      },
      { status: 502 }
    );
  }
}
