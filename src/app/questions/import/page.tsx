"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SAMPLE_JSON = `{
  "questionBankName": "我的題庫名稱",
  "questionBankDescription": "題庫描述（選填）",
  "questions": [
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
      "category": "分類標籤（選填）",
      "chapter": "Chapter 1",
      "difficulty": 3,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

interface PreviewQuestion {
  stem: string;
  type?: string;
  category?: string;
  difficulty?: number;
  options?: { label: string; text: string }[];
}

interface QuestionBank {
  id: string;
  name: string;
}

export default function ImportPage() {
  const [fileContent, setFileContent] = useState("");
  const [importMode, setImportMode] = useState<"new" | "existing">("new");
  const [bankName, setBankName] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [preview, setPreview] = useState<PreviewQuestion[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[]; questionBankName?: string } | null>(null);

  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("/api/question-banks");
        if (!res.ok) return;
        const data = await res.json();
        setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
      } catch (err) {
        console.error("Failed to fetch question banks:", err);
      }
    }

    fetchBanks();
  }, []);

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

        // Support both formats: { questionBankName, questions: [...] } or [...]
        if (Array.isArray(parsed)) {
          setPreview(parsed);
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          setPreview(parsed.questions);
          if (parsed.questionBankName) setBankName(parsed.questionBankName);
          if (parsed.questionBankDescription) setBankDescription(parsed.questionBankDescription);
        } else {
          setParseError("JSON 格式不正確，請使用正確的匯入格式");
          return;
        }
      } catch {
        setParseError("JSON 格式錯誤，請檢查檔案內容");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (preview.length === 0) return;
    if (importMode === "new" && !bankName.trim()) {
      setParseError("請輸入題庫名稱");
      return;
    }
    if (importMode === "existing" && !selectedBankId) {
      setParseError("請選擇要加入的現有題庫");
      return;
    }

    setImporting(true);
    setResult(null);
    setParseError("");

    try {
      // Parse original content and rebuild with bank info
      const parsed = JSON.parse(fileContent);
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;

      const body = {
        questionBankId: importMode === "existing" ? selectedBankId : undefined,
        questionBankName: importMode === "new" ? bankName.trim() : undefined,
        questionBankDescription:
          importMode === "new" ? bankDescription.trim() || null : undefined,
        questions,
      };

      const res = await fetch("/api/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          imported: data.imported,
          skipped: data.skipped,
          errors: data.errors || [],
          questionBankName: data.questionBankName,
        });
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
        <Link href="/questions" className="text-gray-500 hover:text-gray-900">&larr; 返回題庫</Link>
        <h1 className="text-2xl font-bold text-gray-900">匯入/匯出題目</h1>
      </div>

      {/* Upload area */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">匯入題目 (JSON)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setImportMode("new")}
            className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
              importMode === "new"
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="font-medium text-gray-900">建立新題庫</p>
            <p className="text-sm text-gray-500 mt-1">把匯入內容放進全新的題庫</p>
          </button>
          <button
            type="button"
            onClick={() => setImportMode("existing")}
            className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
              importMode === "existing"
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="font-medium text-gray-900">加入現有題庫</p>
            <p className="text-sm text-gray-500 mt-1">把新題目追加到既有題庫中</p>
          </button>
        </div>

        {importMode === "new" ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">題庫名稱 *</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="為這個題庫命名，例如：CISSP 2024、AWS SAA、日文 N1 文法"
                className="w-full px-4 py-2 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">題庫描述（選填）</label>
              <input
                type="text"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="簡短描述這個題庫的內容"
                className="w-full px-4 py-2 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">選擇現有題庫 *</label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
            >
              <option value="">選擇題庫</option>
              {questionBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center" style={{ background: 'var(--accent-bg)' }}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-gray-400 hover:text-emerald-600 transition-colors"
          >
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600">點擊選擇 JSON 檔案</p>
              <p className="text-sm text-gray-400">支援 .json 格式</p>
            </div>
          </label>
        </div>

        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-500 text-sm">{parseError}</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">預覽匯入題目 ({preview.length} 題)</h2>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {preview.map((q, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.stem}</p>
                <div className="flex gap-2 mt-2 text-xs text-gray-400">
                  <span>{q.type || "SINGLE"}</span>
                  <span>|</span>
                  <span>{q.category || "無分類"}</span>
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
            disabled={
              importing ||
              (importMode === "new" ? !bankName.trim() : !selectedBankId)
            }
            className="w-full btn-nature py-2.5 font-medium disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {importing
              ? "匯入中..."
              : importMode === "new"
                ? `確認匯入 ${preview.length} 題到「${bankName || "..."}」`
                : `確認匯入 ${preview.length} 題到既有題庫`}
          </button>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">匯入結果</h2>
          {result.questionBankName && (
            <p className="text-sm text-gray-500">題庫：{result.questionBankName}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-500">{result.imported}</p>
              <p className="text-sm text-gray-500">成功匯入</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-500">{result.skipped}</p>
              <p className="text-sm text-gray-500">已跳過</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-sm text-red-500 space-y-1">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">匯出全部題目</h2>
        <p className="text-sm text-gray-500">將所有題目匯出為 JSON 檔案</p>
        <button
          onClick={handleExport}
          className="btn-nature px-4 py-2 text-sm font-medium"
        >
          匯出 JSON
        </button>
      </div>

      {/* Sample format */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">JSON 格式範例</h2>
        <p className="text-sm text-gray-500">
          匯入時需要提供題庫名稱。JSON 檔案可以包含 questionBankName 欄位，或在匯入時手動輸入。
        </p>
        <pre className="p-4 rounded-xl text-sm text-gray-600 overflow-x-auto whitespace-pre" style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}>
          {SAMPLE_JSON}
        </pre>
      </div>
    </div>
  );
}
