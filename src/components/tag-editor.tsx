"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TagEditorProps {
  questionId: string;
  initialTags: string[];
  onTagsChange?: (tags: string[]) => void;
  compact?: boolean; // smaller variant for exam view
}

export function TagEditor({ questionId, initialTags, onTagsChange, compact }: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all tags for autocomplete when editing starts
  useEffect(() => {
    if (!editing || allTags.length > 0) return;
    fetch("/api/tags")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.tags) setAllTags(data.tags); })
      .catch(() => {});
  }, [editing, allTags.length]);

  // Update suggestions as user types
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = input.toLowerCase();
    const filtered = allTags.filter(
      (t) => t.toLowerCase().includes(lower) && !tags.includes(t)
    );
    setSuggestions(filtered.slice(0, 5));
  }, [input, allTags, tags]);

  async function saveTags(newTags: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        setTags(newTags);
        onTagsChange?.(newTags);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const newTags = [...tags, trimmed];
    setTags(newTags);
    setInput("");
    setSuggestions([]);
    saveTags(newTags);
  }

  function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    saveTags(newTags);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Escape") {
      setEditing(false);
      setInput("");
      setSuggestions([]);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"
            )}
          >
            {tag}
          </span>
        ))}
        <button
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors",
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
          )}
        >
          <svg className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          標籤
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={cn(
        "flex flex-wrap items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-2",
        saving && "opacity-60"
      )}>
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs"
            )}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-red-500 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow clicking suggestions
            setTimeout(() => {
              if (input.trim()) addTag(input);
              setEditing(false);
              setSuggestions([]);
            }, 200);
          }}
          placeholder="輸入標籤後按 Enter..."
          className={cn(
            "flex-1 min-w-[100px] bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400",
            compact ? "text-[11px]" : "text-sm"
          )}
        />
      </div>
      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
