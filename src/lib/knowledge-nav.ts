/**
 * Knowledge entry navigation — stores a list of tags
 * in sessionStorage so the tag detail page can show prev/next buttons.
 */

const STORAGE_KEY = "knowledgeNavTags";
const PREVIEW_KEY = "knowledgeEditorPreview";

export interface KnowledgeNavContext {
  tags: string[];
}

/** Save tag navigation list to sessionStorage */
export function setKnowledgeNavList(tags: string[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

/** Get current navigation context */
export function getKnowledgeNav(): KnowledgeNavContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const tags = JSON.parse(raw);
    if (!Array.isArray(tags) || tags.length === 0) return null;
    return { tags };
  } catch {
    return null;
  }
}

/** Save editor preview mode preference to localStorage (persists across sessions) */
export function setEditorPreview(mode: "edit" | "live" | "preview") {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREVIEW_KEY, mode);
}

/** Get editor preview mode preference */
export function getEditorPreview(): "edit" | "live" | "preview" {
  if (typeof window === "undefined") return "live";
  const val = localStorage.getItem(PREVIEW_KEY);
  if (val === "edit" || val === "live" || val === "preview") return val;
  return "live";
}
