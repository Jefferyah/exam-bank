import { GoogleGenerativeAI } from "@google/generative-ai";
import { AiSolveResult, QuestionOption } from "@/types";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set — Gemini AI will fail at runtime");
}
const genAI = new GoogleGenerativeAI(apiKey || "placeholder");

export async function solveWithGemini(
  stem: string,
  options: QuestionOption[],
  type: string
): Promise<AiSolveResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const optionsText = options.map((o) => `${o.label}. ${o.text}`).join("\n");

  const prompt = `You are a CISSP exam expert. Analyze this question and provide your answer.

Question: ${stem}

Options:
${optionsText}

Question type: ${type === "MULTI" ? "Multiple choice (select all that apply)" : "Single choice"}

Respond ONLY in valid JSON format:
{
  "answer": "the correct option letter(s)",
  "confidence": 0.0-1.0,
  "reasoning": "step-by-step reasoning in Traditional Chinese",
  "explanation": "detailed explanation in Traditional Chinese",
  "keyPoints": ["key point 1", "key point 2"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Gemini response");
  return JSON.parse(jsonMatch[0]);
}
