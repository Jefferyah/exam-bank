/**
 * Question navigation context — stores a list of question IDs
 * in sessionStorage so the detail page can show prev/next buttons.
 */

const STORAGE_KEY = "questionNavList";
const LABEL_KEY = "questionNavLabel";

export interface QuestionNavContext {
  ids: string[];
  label: string; // e.g. "錯題本", "收藏", "筆記", "DLP 相關題目"
}

/** Save question navigation list to sessionStorage */
export function setQuestionNavList(ids: string[], label: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  sessionStorage.setItem(LABEL_KEY, label);
}

/** Get current navigation context */
export function getQuestionNav(): QuestionNavContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const label = sessionStorage.getItem(LABEL_KEY) || "";
    if (!raw) return null;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return { ids, label };
  } catch {
    return null;
  }
}

/** Clear navigation context */
export function clearQuestionNav() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(LABEL_KEY);
}
