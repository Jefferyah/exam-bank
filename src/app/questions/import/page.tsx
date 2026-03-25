"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const SAMPLE_JSON = `[
  {
    "stem": "Which of the following is the MOST important consideration...",
    "type": "SINGLE",
    "options": [
      { "label": "A", "text": "Option A text" },
      { "label": "B", "text": "Option B text" },
      { "label": "C", "text": "Option C text" },
      { "label": "D", "text": "Option D text" }
    ],
    "answer": "B",
    "explanation": "Explanation text...",
    "wrongOptionExplanations": { "A": "Why A is wrong...", "C": "...", "D": "..." },
    "extendedKnowledge": "Additional info...",
    "domain": "SECURITY_AND_RISK_MANAGEMENT",
    "chapter": "Chapter 1",
    "difficulty": 3,
    "tags": ["risk", "governance"]
  }
]`;

interface PreviewQuestion {
  stem: string;
  type?: string;
  domain?: string;
  difficulty?: number;
  options?: { label: string; text: string }[];
}

export default function ImportPage() {
  const { data: session } = useSession();
  const [fileContent, setFileContent] = useState("");
  const [preview, setPreview] = useState<PreviewQuestion[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileContent(text);
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setParseError("JSON 必須是陣列格式");
          return;
        }
        setPreview(parsed);
      } catch {
        setParseError("JSON 格式錯誤，請檢查檔案內容");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      const res = await fetch("/api/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: fileContent,
      });

      const data = await res.json();
      if (res.ok) {
        setResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] });
      } else {
        setResult({ imported: 0, skipped: 0, errors: [data.error || "匯入失敗"] });
      }
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ["匯入失敗，請重試"] });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/import-export");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exam-bank-export.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/questions" className="text-slate-400 hover:text-white">&larr; 返回題庫</Link>
        <h1 className="text-2xl font-bold">匯入/匯出題目</h1>
      </div>

      {/* Upload area */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">匯入題目 (JSON)</h2>
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
          >
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p>點擊選擇 JSON 檔案</p>
              <p className="text-sm text-slate-500">支援 .json 格式</p>
            </div>
          </label>
        </div>

        {parseError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{parseError}</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">預覽匯入題目 ({preview.length} 題)</h2>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {preview.map((q, i) => (
              <div key={i} className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-sm font-medium line-clamp-2">{q.stem}</p>
                <div className="flex gap-2 mt-2 text-xs text-slate-400">
                  <span>{q.type || "SINGLE"}</span>
                  <span>|</span>
                  <span>{q.domain || "N/A"}</span>
                  <span>|</span>
                  <span>難度 {q.difficulty || 3}</span>
                  <span>|</span>
                  <span>{q.options?.length || 0} 選項</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {importing ? "匯入中..." : `確認匯入 ${preview.length} 題`}
          </button>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold">匯入結果</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-400">{result.imported}</p>
              <p className="text-sm text-slate-400">成功匯入</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-400">{result.skipped}</p>
              <p className="text-sm text-slate-400">已跳過</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-sm text-red-400 space-y-1">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">匯出全部題目</h2>
        <p className="text-sm text-slate-400">將所有題目匯出為 JSON 檔案</p>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
        >
          匯出 JSON
        </button>
      </div>

      {/* Sample format */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">JSON 格式範例</h2>
        <pre className="bg-slate-900 p-4 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre">
          {SAMPLE_JSON}
        </pre>
      </div>
    </div>
  );
}
