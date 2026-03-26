/**
 * Build a prompt for AI to solve a question, and generate URLs
 * to open ChatGPT / Claude / Gemini web with the prompt pre-filled.
 *
 * Custom template variables:
 *   {{題型}}   — 單選題 / 多選題 / 情境題
 *   {{題目}}   — 題幹內容
 *   {{選項}}   — 所有選項（A. xxx\nB. xxx\n...）
 *   {{作答規則}} — 「只有一個正確答案」或「可能有多個正確答案」
 */

interface QuestionForPrompt {
  stem: string;
  type: string;
  options: { label: string; text: string }[];
  explanation?: string;
}

export const DEFAULT_AI_PROMPT = `你是一位專業的考試輔導老師，請用繁體中文解答以下{{題型}}。

【題目】
{{題目}}

【選項】
{{選項}}

（本題{{作答規則}}）

請依照以下格式回答：

## 正確答案
直接給出正確選項代號

## 解題思路
用 2-3 句話說明為什麼選這個答案，從題目關鍵字出發，逐步推導

## 各選項分析
逐一說明每個選項對或錯的原因，每個選項用一句話

## 易混淆重點
指出這題最容易選錯的陷阱選項，說明為什麼容易搞混

## 延伸知識
補充 1-2 個跟這題相關的重要考點或概念，幫助舉一反三`;

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
    .replace(/\{\{作答規則\}\}/g, answerHint)
    .replace(/\{\{答案提示\}\}/g, answerHint); // backward compat for old custom prompts
}

export function getAiWebUrls(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return {
    chatgpt: `https://chatgpt.com/?q=${encoded}`,
    claude: `https://claude.ai/new?q=${encoded}`,
    gemini: `https://gemini.google.com/app?q=${encoded}`,
  };
}
