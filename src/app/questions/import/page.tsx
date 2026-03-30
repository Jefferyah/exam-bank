"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { groupBanksByCategory } from "@/lib/group-banks";
import CategorySelect from "@/components/category-select";

const SAMPLE_FORMAT_A = `[
  {
    "type": "mc",
    "chapter": "Chapter 1",
    "question": "Which of the following is NOT a common cloud service model?",
    "options": [
      "Software as a Service (SaaS)",
      "Programming as a Service (PraaS)",
      "Infrastructure as a Service (IaaS)",
      "Platform as a Service (PaaS)"
    ],
    "answer": "B",
    "explanation": "Programming as a Service is not a common model."
  }
]`;

const SAMPLE_FORMAT_B = `{
  "questionBankName": "我的題庫名稱",
  "questionBankDescription": "題庫描述（選填）",
  "questions": [
    {
      "stem": "Which of the following is the MOST important...",
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
  stem?: string;
  question?: string;
  type?: string;
  category?: string;
  chapter?: string;
  difficulty?: number;
  options?: unknown[];
}

interface QuestionBank {
  id: string;
  name: string;
  category?: string | null;
}

/** Extract display stem from either format */
function getStem(q: PreviewQuestion): string {
  return (q.stem || q.question || "(無題幹)") as string;
}

/** Get option count from either format */
function getOptionCount(q: PreviewQuestion): number {
  if (!q.options || !Array.isArray(q.options)) return 0;
  return q.options.length;
}

/** Detect format type for display */
function detectFormat(q: PreviewQuestion): string {
  if (q.question && !q.stem) return "外部格式";
  if (q.stem && !q.question) return "系統格式";
  return "自動偵測";
}

export default function ImportPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect non-admin users
  useEffect(() => {
    if (status === "loading") return;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || role !== "ADMIN") {
      router.replace("/questions");
    }
  }, [session, status, router]);

  const [fileContent, setFileContent] = useState("");
  const [importMode, setImportMode] = useState<"new" | "existing">("new");
  const [bankName, setBankName] = useState("");
  const [bankCategory, setBankCategory] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [hiddenBankIds, setHiddenBankIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewQuestion[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<"external" | "internal" | "">("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    questionBankName?: string;
  } | null>(null);
  const [sampleTab, setSampleTab] = useState<"A" | "B">("A");
  const [copied, setCopied] = useState(false);

  async function handleCopySample() {
    const text = sampleTab === "A" ? SAMPLE_FORMAT_A : SAMPLE_FORMAT_B;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  useEffect(() => {
    async function fetchBanks() {
      try {
        const [banksRes, hiddenRes] = await Promise.all([
          fetch("/api/question-banks"),
          fetch("/api/hidden-banks"),
        ]);
        if (banksRes.ok) {
          const data = await banksRes.json();
          setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
        }
        if (hiddenRes.ok) {
          const hiddenData = await hiddenRes.json();
          setHiddenBankIds(new Set(hiddenData.hiddenBankIds || []));
        }
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
    setDetectedFormat("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;

      setFileContent(text);
      try {
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Auto-fix common JSON issues
          let fixed = text;
          // 1. Remove backslash before smart/curly quotes (invalid JSON escape)
          fixed = fixed.replace(/\\[\u201c\u201d\u2018\u2019]/g, (m) => m.slice(1));
          // 2. Fix double-escaped quotes \\" → \"
          fixed = fixed.replace(/\\\\"/g, '\\"');
          // 3. Remove BOM if present
          fixed = fixed.replace(/^\uFEFF/, '');
          parsed = JSON.parse(fixed);
          setFileContent(fixed);
        }

        if (Array.isArray(parsed)) {
          // Plain array — check if it's external format (has "question" field)
          setPreview(parsed);
          if (parsed.length > 0 && parsed[0].question && !parsed[0].stem) {
            setDetectedFormat("external");
          } else {
            setDetectedFormat("internal");
          }
        } else if (parsed.questions && Array.isArray(parsed.questions)) {
          // Wrapped format { questionBankName, questions: [...] }
          setPreview(parsed.questions);
          if (parsed.questionBankName) setBankName(parsed.questionBankName);
          if (parsed.questionBankDescription)
            setBankDescription(parsed.questionBankDescription);
          setDetectedFormat("internal");
        } else {
          setParseError("JSON 格式不正確，請使用正確的匯入格式");
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setParseError(`JSON 格式錯誤：${msg || "請檢查檔案內容"}`);
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
      const parsed = JSON.parse(fileContent);
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;

      const body = {
        questionBankId: importMode === "existing" ? selectedBankId : undefined,
        questionBankName: importMode === "new" ? bankName.trim() : undefined,
        questionBankDescription:
          importMode === "new" ? bankDescription.trim() || null : undefined,
        questionBankCategory:
          importMode === "new" ? bankCategory.trim() || null : undefined,
        isPublic: importMode === "new" ? isPublic : undefined,
        questions,
      };

      const res = await fetch("/api/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        setResult({
          imported: 0,
          skipped: 0,
          errors: [`伺服器回應錯誤 (HTTP ${res.status})，可能是檔案過大或格式有誤`],
        });
        return;
      }

      if (res.ok) {
        setResult({
          imported: data.imported,
          skipped: data.skipped,
          errors: data.errors || [],
          questionBankName: data.questionBankName,
        });
      } else {
        setResult({
          imported: 0,
          skipped: 0,
          errors: [data.error || `匯入失敗 (HTTP ${res.status})`],
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      setResult({ imported: 0, skipped: 0, errors: [`匯入失敗：${msg}`] });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/import-export");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
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
        <Link
          href="/questions"
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> 返回題庫
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">匯入/匯出題目</h1>
      </div>

      {/* Upload area */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">匯入題目 (JSON)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setImportMode("new")}
            className={`rounded-2xl border px-4 py-3 text-left transition-all ${
              importMode === "new"
                ? "border-gray-900 bg-gray-50"
                : "border-gray-100 bg-white hover:bg-gray-50 shadow-sm"
            }`}
          >
            <p className="font-medium text-gray-900">建立新題庫</p>
            <p className="text-sm text-gray-600 mt-1">
              把匯入內容放進全新的題庫
            </p>
          </button>
          <button
            type="button"
            onClick={() => setImportMode("existing")}
            className={`rounded-2xl border px-4 py-3 text-left transition-all ${
              importMode === "existing"
                ? "border-gray-900 bg-gray-50"
                : "border-gray-100 bg-white hover:bg-gray-50 shadow-sm"
            }`}
          >
            <p className="font-medium text-gray-900">加入現有題庫</p>
            <p className="text-sm text-gray-600 mt-1">
              把新題目追加到既有題庫中
            </p>
          </button>
        </div>

        {importMode === "new" ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                題庫名稱 *
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="為這個題庫命名，例如：CISSP 2024、AWS SAA、日文 N1 文法"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                題庫分類（選填）
              </label>
              <CategorySelect
                value={bankCategory}
                onChange={setBankCategory}
                canCreate={true}
                placeholder="選擇分類（選填）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                題庫描述（選填）
              </label>
              <input
                type="text"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="簡短描述這個題庫的內容"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Public/Private toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                分享設定
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    !isPublic
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  僅自己使用
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    isPublic
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
                  公開分享
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {isPublic ? "所有使用者都能看到並練習這個題庫" : "只有你能看到這個題庫"}
              </p>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              選擇現有題庫 *
            </label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選擇題庫</option>
              {groupBanksByCategory(
                questionBanks.filter((bank) => !hiddenBankIds.has(bank.id))
              ).map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-2xl p-8 text-center">
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors"
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-gray-600">點擊選擇 JSON 檔案</p>
              <p className="text-sm text-gray-400">
                支援兩種格式：簡易格式（純陣列）或完整格式（含題庫名稱）
              </p>
            </div>
          </label>
        </div>

        {parseError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-red-600 text-sm">{parseError}</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              預覽匯入題目 ({preview.length} 題)

            </h2>
            {detectedFormat && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                {detectedFormat === "external"
                  ? "偵測到外部格式，將自動轉換"
                  : "系統格式"}
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {preview.map((q, i) => (
              <div
                key={i}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl"
              >
                <p
                  className="text-sm font-medium text-gray-900 line-clamp-2"
                  dangerouslySetInnerHTML={{
                    __html: getStem(q).replace(/<br\s*\/?>/gi, " "),
                  }}
                />
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                  <span>{q.type || "mc"}</span>
                  <span>|</span>
                  <span>{q.chapter || q.category || "無分類"}</span>
                  <span>|</span>
                  <span>難度 {q.difficulty || 3}</span>
                  <span>|</span>
                  <span>{getOptionCount(q)} 選項</span>
                  <span>|</span>
                  <span>{detectFormat(q)}</span>
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
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-full font-medium transition-all"
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
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">匯入結果</h2>
          {result.questionBankName && (
            <p className="text-sm text-gray-600">
              題庫：{result.questionBankName}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-500">
                {result.imported}
              </p>
              <p className="text-sm text-gray-600">成功匯入</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-500">
                {result.skipped}
              </p>
              <p className="text-sm text-gray-600">已跳過</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-sm text-red-600 space-y-1">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">匯出全部題目</h2>
        <p className="text-sm text-gray-600">將所有題目匯出為 JSON 檔案</p>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-medium transition-colors"
        >
          匯出 JSON
        </button>
      </div>

      {/* Sample formats */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          JSON 格式範例
        </h2>
        <p className="text-sm text-gray-600">
          系統支援兩種匯入格式，會自動偵測並轉換。
        </p>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => { setSampleTab("A"); setCopied(false); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              sampleTab === "A"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            格式 A：簡易格式（推薦）
          </button>
          <button
            onClick={() => { setSampleTab("B"); setCopied(false); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              sampleTab === "B"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            格式 B：完整格式
          </button>
        </div>

        {sampleTab === "A" ? (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-700 space-y-1">
              <p className="font-medium">簡易格式特點：</p>
              <ul className="list-disc list-inside text-blue-600 space-y-0.5">
                <li>
                  用 <code className="bg-blue-100 px-1 rounded">question</code>{" "}
                  取代{" "}
                  <code className="bg-blue-100 px-1 rounded">stem</code>
                </li>
                <li>
                  選項直接用字串陣列{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    [&quot;A&quot;, &quot;B&quot;, ...]
                  </code>
                  ，系統自動加 A/B/C/D 標籤
                </li>
                <li>
                  題型用{" "}
                  <code className="bg-blue-100 px-1 rounded">mc</code>
                  ，系統自動轉換為 SINGLE
                </li>
                <li>
                  缺少的欄位（難度、標籤等）自動給預設值
                </li>
              </ul>
            </div>
            <div className="relative">
              <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 pr-20 rounded-xl text-sm text-gray-600 overflow-x-auto whitespace-pre">
                {SAMPLE_FORMAT_A}
              </pre>
              <button
                onClick={handleCopySample}
                className="absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm"
              >
                {copied ? "✓ 已複製" : "複製範例"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-sm text-purple-700 space-y-1">
              <p className="font-medium">完整格式特點：</p>
              <ul className="list-disc list-inside text-purple-600 space-y-0.5">
                <li>
                  可在 JSON 內指定{" "}
                  <code className="bg-purple-100 px-1 rounded">
                    questionBankName
                  </code>
                </li>
                <li>
                  選項用物件{" "}
                  <code className="bg-purple-100 px-1 rounded">
                    {`{label, text}`}
                  </code>
                </li>
                <li>
                  支援{" "}
                  <code className="bg-purple-100 px-1 rounded">
                    wrongOptionExplanations
                  </code>
                  、
                  <code className="bg-purple-100 px-1 rounded">
                    extendedKnowledge
                  </code>
                </li>
                <li>可自訂 difficulty、tags、category</li>
              </ul>
            </div>
            <div className="relative">
              <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 pr-20 rounded-xl text-sm text-gray-600 overflow-x-auto whitespace-pre">
                {SAMPLE_FORMAT_B}
              </pre>
              <button
                onClick={handleCopySample}
                className="absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm"
              >
                {copied ? "✓ 已複製" : "複製範例"}
              </button>
            </div>
          </div>
        )}

        {/* Field mapping table */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            欄位對照表
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 text-gray-600 font-medium">
                    簡易格式
                  </th>
                  <th className="text-left py-2 pr-4 text-gray-600 font-medium">
                    完整格式
                  </th>
                  <th className="text-left py-2 text-gray-600 font-medium">
                    說明
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">question</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">stem</code>
                  </td>
                  <td className="py-1.5">題幹（必填）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">[&quot;str&quot;, ...]</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">
                      [{`{label, text}`}]
                    </code>
                  </td>
                  <td className="py-1.5">選項（必填）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">mc</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">SINGLE</code>
                  </td>
                  <td className="py-1.5">題型（自動轉換）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">answer</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">answer</code>
                  </td>
                  <td className="py-1.5">答案（必填，如 &quot;B&quot;）</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">explanation</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">explanation</code>
                  </td>
                  <td className="py-1.5">解析（必填）</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4">
                    <code className="text-blue-600">chapter</code>
                  </td>
                  <td className="py-1.5 pr-4">
                    <code className="text-purple-600">chapter</code>
                  </td>
                  <td className="py-1.5">章節（選填）</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
