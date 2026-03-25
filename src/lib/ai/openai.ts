import OpenAI from "openai";
import { AiSolveResult, QuestionOption } from "@/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function solveWithGPT(
  stem: string,
  options: QuestionOption[],
  type: string
): Promise<AiSolveResult> {
  const optionsText = options.map((o) => `${o.label}. ${o.text}`).join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a CISSP exam expert. Analyze questions and provide answers in JSON format.",
      },
      {
        role: "user",
        content: `Question: ${stem}\n\nOptions:\n${optionsText}\n\nType: ${type === "MULTI" ? "Multiple choice" : "Single choice"}\n\nRespond in JSON:\n{"answer": "letter(s)", "confidence": 0.0-1.0, "reasoning": "step-by-step in Traditional Chinese", "explanation": "detailed in Traditional Chinese", "keyPoints": ["point1", "point2"]}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0].message.content || "{}";
  return JSON.parse(text);
}
