import Anthropic from "@anthropic-ai/sdk";
import { AiSolveResult, QuestionOption } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function solveWithClaude(
  stem: string,
  options: QuestionOption[],
  type: string
): Promise<AiSolveResult> {
  const optionsText = options.map((o) => `${o.label}. ${o.text}`).join("\n");
  const prompt = `You are a CISSP exam expert. Analyze this question and provide your answer.

Question: ${stem}

Options:
${optionsText}

Question type: ${type === "MULTI" ? "Multiple choice (select all that apply)" : "Single choice"}

Respond in JSON format:
{
  "answer": "the correct option letter(s)",
  "confidence": 0.0-1.0,
  "reasoning": "step-by-step reasoning in Traditional Chinese",
  "explanation": "detailed explanation in Traditional Chinese",
  "keyPoints": ["key point 1", "key point 2"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Claude response");
  return JSON.parse(jsonMatch[0]);
}
