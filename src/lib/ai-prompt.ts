/**
 * Build a prompt for AI to solve a question, and generate URLs
 * to open ChatGPT / Claude / Gemini web with the prompt pre-filled.
 */

interface QuestionForPrompt {
  stem: string;
  type: string;
  options: { label: string; text: string }[];
  explanation?: string;
}

export function buildAiPrompt(q: QuestionForPrompt): string {
  const typeLabel = q.type === "MULTI" ? "多選題" : q.type === "SCENARIO" ? "情境題" : "單選題";
  const optionsText = q.options
    .map((o) => `${o.label}. ${o.text}`)
    .join("\n");

  return `請幫我解這道${typeLabel}，並詳細說明解題思路：

題目：
${q.stem}

選項：
${optionsText}

請回答：
1. 正確答案是哪個選項（${q.type === "MULTI" ? "可能有多個正確答案" : "只有一個正確答案"}）
2. 為什麼這個選項是正確的
3. 其他選項為什麼不對
4. 相關的延伸知識或考試重點`;
}

export function getAiWebUrls(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return {
    chatgpt: `https://chatgpt.com/?q=${encoded}`,
    claude: `https://claude.ai/new?q=${encoded}`,
    gemini: `https://gemini.google.com/app?q=${encoded}`,
  };
}
