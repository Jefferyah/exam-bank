"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

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
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load existing content
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/knowledge/${encodeURIComponent(tag)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setContent(data.content || "");
          if (data.updatedAt) setLastSaved(data.updatedAt);
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
          preview="live"
          visibleDragbar={false}
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

      {/* Tip */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        支援 Markdown 語法，輸入後自動儲存 · 可直接貼上或拖放圖片
      </p>
    </div>
  );
}
