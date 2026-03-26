/**
 * Build a prompt for AI to solve a question, and generate URLs
 * to open ChatGPT / Claude / Gemini web with the prompt pre-filled.
 *
 * Custom template variables:
 *   {{題型}}   — 單選題 / 多選題 / 情境題
 *   {{題目}}   — 題幹內容
 *   {{選項}}   — 所有選項（A. xxx\nB. xxx\n...）
 *   {{答案提示}} — 「只有一個正確答案」或「可能有多個正確答案」
 */

interface QuestionForPrompt {
  stem: string;
  type: string;
  options: { label: string; text: string }[];
  explanation?: string;
}

export const DEFAULT_AI_PROMPT = `請幫我解這道{{題型}}，並詳細說明解題思路：

題目：
{{題目}}

選項：
{{選項}}

請回答：
1. 正確答案是哪個選項（{{答案提示}}）
2. 為什麼這個選項是正確的
3. 其他選項為什麼不對
4. 相關的延伸知識或考試重點`;

export function buildAiPrompt(q: QuestionForPrompt, customTemplate?: string | null): string {
  const typeLabel = q.type === "MULTI" ? "多選題" : q.type === "SCENARIO" ? "情境題" : "單選題";
  const optionsText = q.options
    .map((o) => `${o.label}. ${o.text}`)
    .join("\n");
  const answerHint = q.type === "MULTI" ? "可能有多個正確答案" : "只有一個正確答案";

  const template = customTemplate?.trim() || DEFAULT_AI_PROMPT;

  return template
    .replace(/\{\{題型\}\}/g, typeLabel)
    .replace(/\{\{題目\}\}/g, q.stem)
    .replace(/\{\{選項\}\}/g, optionsText)
    .replace(/\{\{答案提示\}\}/g, answerHint);
}

export function getAiWebUrls(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return {
    chatgpt: `https://chatgpt.com/?q=${encoded}`,
    claude: `https://claude.ai/new?q=${encoded}`,
    gemini: `https://gemini.google.com/app?q=${encoded}`,
  };
}
