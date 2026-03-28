"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";
import { getKnowledgeNav, getEditorPreview, setEditorPreview } from "@/lib/knowledge-nav";
import type { Element, Root, RootContent } from "hast";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

/** Phase 1: rehypeRewrite — transform [[tag]] text into clickable links */
function rehypeWikiLinks(node: Root | RootContent, _index?: number, parent?: Root | Element) {
  if (node.type !== "text" || !parent || !("children" in parent)) return;
  const regex = /\[\[([^\]]+)\]\]/g;
  if (!regex.test(node.value)) return;
  regex.lastIndex = 0;

  const children: RootContent[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(node.value)) !== null) {
    if (match.index > lastIndex) {
      children.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
    }
    const linkedTag = match[1].trim();
    children.push({
      type: "element",
      tagName: "a",
      properties: {
        href: `/knowledge/${encodeURIComponent(linkedTag)}`,
        className: "wiki-link",
        "data-wiki-tag": linkedTag,
      },
      children: [{ type: "text", value: linkedTag }],
    } as unknown as RootContent);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < node.value.length) {
    children.push({ type: "text", value: node.value.slice(lastIndex) });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pChildren = parent.children as any[];
  const idx = pChildren.indexOf(node);
  if (idx >= 0) {
    pChildren.splice(idx, 1, ...children);
  }
}

export default function KnowledgeEntryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { theme } = useTheme();
  const tag = decodeURIComponent(params.tag as string);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"edit" | "live" | "preview">("live");
  const [navTags, setNavTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const [acQuery, setAcQuery] = useState<string | null>(null); // autocomplete query, null = hidden
  const [acIndex, setAcIndex] = useState(0);
  const [acPos, setAcPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const acCursorRef = useRef<number>(0); // store cursor position for autocomplete
  const acInteractingRef = useRef(false); // track if user is interacting with dropdown

  // Load editor preview preference & nav context
  useEffect(() => {
    setPreviewMode(getEditorPreview());
    const nav = getKnowledgeNav();
    if (nav) setNavTags(nav.tags);
  }, []);

  const currentIndex = navTags.indexOf(tag);
  const prevTag = currentIndex > 0 ? navTags[currentIndex - 1] : null;
  const nextTag = currentIndex >= 0 && currentIndex < navTags.length - 1 ? navTags[currentIndex + 1] : null;

  const handlePreviewChange = (mode: "edit" | "live" | "preview") => {
    setPreviewMode(mode);
    setEditorPreview(mode);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load all tags for autocomplete
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/knowledge")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tags) setAllTags(data.tags.map((t: { tag: string }) => t.tag));
      })
      .catch(() => {});
  }, [status]);

  // Load existing content
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/knowledge/${encodeURIComponent(tag)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setContent(data.content || "");
          if (data.updatedAt) setLastSaved(data.updatedAt);
          if (data.backlinks) setBacklinks(data.backlinks);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, tag]);

  const saveContent = useCallback(
    async (text: string) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/knowledge/${encodeURIComponent(tag)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setLastSaved(data.updatedAt);
        }
      } catch {
        // silently fail
      } finally {
        setSaving(false);
      }
    },
    [tag]
  );

  // Auto-save with debounce
  const handleChange = useCallback(
    (val: string | undefined) => {
      const text = val || "";
      setContent(text);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveContent(text), 1500);
    },
    [saveContent]
  );

  // Upload image and return markdown string
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "圖片上傳失敗");
        return null;
      }
      const { url } = await res.json();
      return `![image](${url})`;
    } catch {
      alert("圖片上傳失敗");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  // Handle paste event — intercept images from clipboard
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const md = await uploadImage(file);
          if (md) {
            // Insert at cursor position
            const textarea = document.querySelector(
              ".w-md-editor-text-input"
            ) as HTMLTextAreaElement | null;
            if (textarea) {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const before = content.substring(0, start);
              const after = content.substring(end);
              const newContent = before + md + "\n" + after;
              handleChange(newContent);
            } else {
              handleChange(content + "\n" + md + "\n");
            }
          }
          return; // only handle first image
        }
      }
    },
    [content, handleChange, uploadImage]
  );

  // Handle drop event — intercept dropped image files
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          const md = await uploadImage(file);
          if (md) {
            handleChange(content + "\n" + md + "\n");
          }
          return;
        }
      }
    },
    [content, handleChange, uploadImage]
  );

  // Phase 2: Autocomplete — detect [[ and show suggestions
  const getTextarea = useCallback(() => {
    return editorRef.current?.querySelector(".w-md-editor-text-input") as HTMLTextAreaElement | null;
  }, []);

  const handleAutocompleteInput = useCallback(() => {
    if (acInteractingRef.current) return; // don't update while interacting with dropdown
    const textarea = getTextarea();
    if (!textarea) return;
    const pos = textarea.selectionStart;
    acCursorRef.current = pos;
    const textBefore = textarea.value.substring(0, pos);
    const match = textBefore.match(/\[\[([^\]]*?)$/);
    if (match) {
      setAcQuery(match[1]);
      setAcIndex(0);
      const linesBefore = textBefore.split("\n");
      const lineHeight = 22;
      const charWidth = 8;
      const currentLine = linesBefore.length;
      const currentCol = linesBefore[linesBefore.length - 1].length;
      const rect = textarea.getBoundingClientRect();
      const scrollTop = textarea.scrollTop;
      setAcPos({
        top: rect.top + currentLine * lineHeight - scrollTop + 4,
        left: rect.left + Math.min(currentCol * charWidth, rect.width - 200),
      });
    } else {
      setAcQuery(null);
    }
  }, [getTextarea]);

  const insertWikiLink = useCallback((selectedTag: string) => {
    acInteractingRef.current = false;
    const textarea = getTextarea();
    if (!textarea) return;
    // Use stored cursor position (more reliable than reading from textarea after blur)
    const pos = acCursorRef.current || textarea.selectionStart;
    const fullText = textarea.value;
    const textBefore = fullText.substring(0, pos);
    const textAfter = fullText.substring(pos);
    const match = textBefore.match(/\[\[([^\]]*?)$/);
    if (!match) return;
    const start = textBefore.length - match[0].length;
    const newText = textBefore.substring(0, start) + `[[${selectedTag}]]` + textAfter;
    handleChange(newText);
    setAcQuery(null);
    requestAnimationFrame(() => {
      const ta = getTextarea();
      if (ta) {
        const newPos = start + selectedTag.length + 4;
        ta.selectionStart = ta.selectionEnd = newPos;
        ta.focus();
      }
    });
  }, [getTextarea, handleChange]);

  const acFiltered = acQuery !== null
    ? allTags.filter((t) => t.toLowerCase().includes(acQuery.toLowerCase()) && t !== tag).slice(0, 8)
    : [];

  // Attach input/keydown listeners to the textarea
  useEffect(() => {
    const textarea = getTextarea();
    if (!textarea) return;

    const onInput = () => handleAutocompleteInput();
    const onKeyDown = (e: KeyboardEvent) => {
      if (acQuery === null || acFiltered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcIndex((i) => Math.min(i + 1, acFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (acFiltered.length > 0) {
          e.preventDefault();
          insertWikiLink(acFiltered[acIndex]);
        }
      } else if (e.key === "Escape") {
        setAcQuery(null);
      }
    };

    textarea.addEventListener("input", onInput);
    textarea.addEventListener("keydown", onKeyDown);
    return () => {
      textarea.removeEventListener("input", onInput);
      textarea.removeEventListener("keydown", onKeyDown);
    };
  }, [getTextarea, handleAutocompleteInput, acQuery, acFiltered, acIndex, insertWikiLink]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-[500px] bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/knowledge")}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {tag}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <Link
              href={`/questions?tags=${encodeURIComponent(tag)}`}
              className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              查看相關題目 →
            </Link>
            {lastSaved && (
              <span className="text-xs text-gray-400">
                上次儲存：
                {new Date(lastSaved).toLocaleString("zh-TW")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-gray-400 animate-pulse">
              儲存中...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="text-xs text-emerald-500">已儲存</span>
          )}
        </div>
      </div>

      {/* Markdown Editor */}
      <div
        ref={editorRef}
        data-color-mode={theme === "dark" ? "dark" : "light"}
        className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative"
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <MDEditor
          value={content}
          onChange={handleChange}
          height={550}
          preview={previewMode}
          visibleDragbar={false}
          previewOptions={{
            rehypeRewrite: rehypeWikiLinks,
          }}
        />
        {uploading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-2xl z-50">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              上傳圖片中...
            </div>
          </div>
        )}
      </div>

      {/* Phase 2: Autocomplete dropdown */}
      {acQuery !== null && acFiltered.length > 0 && (
        <div
          className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden min-w-[200px] max-w-[300px]"
          style={{ top: acPos.top, left: acPos.left }}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            acInteractingRef.current = true;
          }}
        >
          <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 uppercase tracking-wider">
            插入知識連結
          </div>
          {acFiltered.map((t, i) => (
            <button
              key={t}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                insertWikiLink(t);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                i === acIndex
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Editor mode toggle + tip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {([
            { key: "edit" as const, label: "編輯" },
            { key: "live" as const, label: "分割" },
            { key: "preview" as const, label: "預覽" },
          ]).map((m) => (
            <button
              key={m.key}
              onClick={() => handlePreviewChange(m.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                previewMode === m.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          自動儲存 · 可貼上或拖放圖片
        </p>
      </div>

      {/* Phase 3: Backlinks */}
      {backlinks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            被引用於
          </h3>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((bl) => (
              <Link
                key={bl}
                href={`/knowledge/${encodeURIComponent(bl)}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                {bl}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Prev / Next navigation */}
      {navTags.length > 1 && currentIndex >= 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-3 shadow-sm">
          <button
            onClick={() => prevTag && router.push(`/knowledge/${encodeURIComponent(prevTag)}`)}
            disabled={!prevTag}
            className={`flex items-center gap-2 text-sm transition-colors ${
              prevTag
                ? "text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="max-w-[120px] sm:max-w-[200px] truncate">{prevTag || "無"}</span>
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {currentIndex + 1} / {navTags.length}
          </span>
          <button
            onClick={() => nextTag && router.push(`/knowledge/${encodeURIComponent(nextTag)}`)}
            disabled={!nextTag}
            className={`flex items-center gap-2 text-sm transition-colors ${
              nextTag
                ? "text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            <span className="max-w-[120px] sm:max-w-[200px] truncate">{nextTag || "無"}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
