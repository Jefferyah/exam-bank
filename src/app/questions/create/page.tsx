"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";

interface Option {
  label: string;
  text: string;
}

interface QuestionBank {
  id: string;
  name: string;
}

export default function CreateQuestionPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
      <CreateQuestionContent />
    </Suspense>
  );
}

function CreateQuestionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const editId = searchParams.get("edit");

  const [stem, setStem] = useState("");
  const [type, setType] = useState<"SINGLE" | "MULTI" | "SCENARIO">("SINGLE");
  const [options, setOptions] = useState<Option[]>([
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ]);
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [wrongExplanations, setWrongExplanations] = useState<Record<string, string>>({});
  const [extendedKnowledge, setExtendedKnowledge] = useState("");
  const [questionBankId, setQuestionBankId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);

  // Fetch question banks on mount
  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("/api/question-banks");
        if (res.ok) {
          const data = await res.json();
          setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
        }
      } catch (err) {
        console.error("Failed to fetch question banks:", err);
      }
    }
    fetchBanks();
  }, []);

  // Load question data if editing
  useEffect(() => {
    if (!editId) return;

    async function loadQuestion() {
      try {
        const res = await fetch(`/api/questions/${editId}`);
        if (res.ok) {
          const q = await res.json();
          setStem(q.stem);
          setType(q.type);
          setOptions(q.options);
          setAnswer(q.answer);
          setExplanation(q.explanation);
          setWrongExplanations(q.wrongOptionExplanations || {});
          setExtendedKnowledge(q.extendedKnowledge || "");
          setQuestionBankId(q.questionBankId || "");
          setCategory(q.category || "");
          setChapter(q.chapter || "");
          setDifficulty(q.difficulty);
          setTagsInput(Array.isArray(q.tags) ? q.tags.join(", ") : "");
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadQuestion();
  }, [editId]);

  function addOption() {
    const nextLabel = String.fromCharCode(65 + options.length);
    if (options.length >= 8) return;
    setOptions([...options, { label: nextLabel, text: "" }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index).map((opt, i) => ({
      ...opt,
      label: String.fromCharCode(65 + i),
    }));
    setOptions(newOptions);
  }

  function updateOptionText(index: number, text: string) {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text };
    setOptions(newOptions);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stem || !questionBankId || !answer || !explanation) {
      setError("請填寫所有必要欄位（題幹、題庫、答案、解析）");
      return;
    }

    setSubmitting(true);
    setError("");

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const body = {
      stem,
      type,
      options,
      answer,
      explanation,
      wrongOptionExplanations: Object.keys(wrongExplanations).length > 0 ? wrongExplanations : null,
      extendedKnowledge: extendedKnowledge || null,
      questionBankId,
      category: category || null,
      chapter: chapter || null,
      difficulty,
      tags,
    };

    try {
      const url = editId ? `/api/questions/${editId}` : "/api/questions";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/questions/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "儲存失敗");
      }
    } catch {
      setError("儲存失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/questions" className="text-gray-400 hover:text-gray-700 transition-colors">
          &larr; 返回題庫
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{editId ? "編輯題目" : "新增題目"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stem */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">題幹</h2>
          <textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder="輸入題目（支援長題幹/情境題）..."
            className="w-full h-40 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            required
          />
        </div>

        {/* Type & Question Bank */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">題型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "SINGLE" | "MULTI" | "SCENARIO")}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="SINGLE">單選題 (SINGLE)</option>
                <option value="MULTI">多選題 (MULTI)</option>
                <option value="SCENARIO">情境題 (SCENARIO)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所屬題庫</label>
              <select
                value={questionBankId}
                onChange={(e) => setQuestionBankId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">選擇題庫</option>
                {questionBanks.map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例如: 網路安全、資料庫管理"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">章節</label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="例如: Chapter 3"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              難度: {difficulty} - {DIFFICULTY_LABELS[difficulty]}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">標籤（以逗號分隔）</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例如: CIA, Risk Management, Access Control"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Options builder */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">選項</h2>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= 8}
              className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed rounded-full text-sm font-medium shadow-sm transition-colors"
            >
              + 新增選項
            </button>
          </div>
          <div className="space-y-3">
            {options.map((opt, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-10 flex items-center justify-center font-bold text-blue-500">
                  {opt.label}.
                </span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOptionText(i, e.target.value)}
                  placeholder={`選項 ${opt.label} 內容`}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  className="flex-shrink-0 px-2 py-2 text-red-400 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Answer */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">答案</h2>
          {type === "MULTI" ? (
            <div className="flex flex-wrap gap-3">
              {options.map((opt) => (
                <label key={opt.label} className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    checked={answer.includes(opt.label)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAnswer((prev) => {
                          const labels = prev.split(",").filter(Boolean);
                          labels.push(opt.label);
                          return labels.sort().join(",");
                        });
                      } else {
                        setAnswer((prev) =>
                          prev.split(",").filter((l) => l !== opt.label).join(",")
                        );
                      }
                    }}
                    className="accent-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {options.map((opt) => (
                <label key={opt.label} className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="answer"
                    value={opt.label}
                    checked={answer === opt.label}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="accent-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">目前答案：{answer || "尚未選擇"}</p>
        </div>

        {/* Explanation */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">解析</h2>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="輸入答案解析..."
            className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            required
          />
        </div>

        {/* Wrong option explanations */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">各錯誤選項說明</h2>
          <div className="space-y-3">
            {options.filter((opt) => !answer.includes(opt.label)).map((opt) => (
              <div key={opt.label}>
                <label className="block text-sm text-gray-500 mb-1">選項 {opt.label} 為何錯誤</label>
                <input
                  type="text"
                  value={wrongExplanations[opt.label] || ""}
                  onChange={(e) =>
                    setWrongExplanations({ ...wrongExplanations, [opt.label]: e.target.value })
                  }
                  placeholder={`說明選項 ${opt.label} 為何不正確...`}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Extended knowledge */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">延伸知識</h2>
          <textarea
            value={extendedKnowledge}
            onChange={(e) => setExtendedKnowledge(e.target.value)}
            placeholder="輸入相關的延伸知識..."
            className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
        </div>

        {/* Error & Submit */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/questions"
            className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full font-medium transition-colors"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-full font-medium shadow-sm transition-colors"
          >
            {submitting ? "儲存中..." : editId ? "更新題目" : "建立題目"}
          </button>
        </div>
      </form>
    </div>
  );
}
