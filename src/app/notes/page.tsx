"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DOMAINS, cn, DomainKey } from "@/lib/utils";

interface Note {
  id: string;
  content: string;
  questionId: string;
  createdAt: string;
  updatedAt: string;
  question: {
    id: string;
    stem: string;
    domain: string;
    difficulty: number;
    type: string;
  };
}

export default function NotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "domain">("date");

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    async function fetchNotes() {
      try {
        const res = await fetch("/api/notes?limit=100");
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchNotes();
  }, [session]);

  async function handleSave(noteId: string, questionId: string) {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content: editContent }),
      });
      if (res.ok) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId ? { ...n, content: editContent, updatedAt: new Date().toISOString() } : n
          )
        );
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm("確定要刪除此筆記嗎？")) return;
    try {
      const res = await fetch(`/api/notes?id=${noteId}`, { method: "DELETE" });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filteredNotes = notes
    .filter((n) => {
      if (!search) return true;
      const lower = search.toLowerCase();
      return (
        n.content.toLowerCase().includes(lower) ||
        n.question.stem.toLowerCase().includes(lower)
      );
    })
    .sort((a, b) => {
      if (sortBy === "domain") {
        return a.question.domain.localeCompare(b.question.domain);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p>請先登入以查看筆記</p>
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">我的筆記</h1>

      {/* Search and sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋筆記..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "date" | "domain")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="date">依日期排序</option>
          <option value="domain">依 Domain 排序</option>
        </select>
      </div>

      <p className="text-sm text-slate-400">共 {filteredNotes.length} 則筆記</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg">{search ? "找不到符合的筆記" : "尚無筆記"}</p>
          <p className="text-sm mt-1">在題目詳情頁中可以新增筆記</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <div key={note.id} className="bg-slate-800 rounded-lg p-5">
              {/* Question preview */}
              <Link
                href={`/questions/${note.questionId}`}
                className="text-sm text-slate-400 hover:text-indigo-300 line-clamp-1 transition-colors"
              >
                {note.question.stem}
              </Link>
              <div className="flex items-center gap-2 mt-1 mb-3">
                <span className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 text-xs rounded-full">
                  {DOMAINS[note.question.domain as DomainKey] || note.question.domain}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(note.updatedAt).toLocaleDateString("zh-TW")}
                </span>
              </div>

              {/* Note content */}
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(note.id, note.questionId)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm transition-colors"
                    >
                      {saving ? "儲存中..." : "儲存"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-slate-200 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs transition-colors"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
