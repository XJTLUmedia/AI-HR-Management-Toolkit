import { streamText, UIMessage, convertToModelMessages } from "ai";
import { getModel, type AIProvider } from "@/lib/ai-model";

export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") || undefined;
  const provider = (req.headers.get("x-ai-provider") as AIProvider) || undefined;
  const model = req.headers.get("x-ai-model") || undefined;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key is required. Please configure your AI provider key in the UI." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!provider) {
    return new Response(
      JSON.stringify({ error: "AI provider is required. Please choose a provider in the UI." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!model) {
    return new Response(
      JSON.stringify({ error: "AI model is required. Fetch live models and select one in the UI." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, resumeText }: { messages: UIMessage[]; resumeText?: string } =
    await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const systemPrompt = resumeText
    ? `You are an expert resume analyst and career coach. The user has uploaded a resume with the following text content:

---RESUME START---
${resumeText}
---RESUME END---

Help the user analyze this resume from a recruiter's perspective. You can:
- Summarize the resume highlighting quantifiable achievements
- Extract and categorize skills with proficiency context
- Identify experience highlights and measurable impact
- Suggest improvements for ATS optimization and recruiter appeal
- Match against job descriptions with keyword analysis
- Identify missing certifications or skills for target roles
- Evaluate the strength of the professional summary
- Answer any questions about the resume content

Prioritize actionable, specific feedback. When suggesting improvements, explain what recruiters look for (achievements > responsibilities, quantified impact, tailored keywords).`
    : `You are an expert resume analyst and career coach. Help users with resume-related questions. Ask them to upload a resume if they haven't yet.`;

  const result = streamText({
    model: getModel({ provider, apiKey, model }),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
