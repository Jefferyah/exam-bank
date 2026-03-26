"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DifficultyStars } from "@/components/icons";

interface QuestionBank {
  id: string;
  name: string;
  _count: { questions: number };
}

export default function ExamSetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mode, setMode] = useState<"PRACTICE" | "MOCK">("PRACTICE");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [difficultyRange, setDifficultyRange] = useState<number[]>([1, 2, 3, 4, 5]);
  const [count, setCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [notedOnly, setNotedOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("/api/question-banks");
        if (res.ok) {
          const data = await res.json();
          setQuestionBanks(data.questionBanks);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBanks(false);
      }
    }
    fetchBanks();
  }, []);

  function toggleBank(id: string) {
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }

  function toggleDifficulty(d: number) {
    setDifficultyRange((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  async function handleStart() {
    if (!session) {
      router.push("/login");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const body = {
        title: `${mode === "PRACTICE" ? "練習" : "模擬考"} - ${new Date().toLocaleDateString("zh-TW")}`,
        questionBankIds: selectedBankIds.length > 0 ? selectedBankIds : undefined,
        difficulty: difficultyRange.length > 0 && difficultyRange.length < 5 ? difficultyRange : undefined,
        count,
        mode,
        timeLimit: mode === "MOCK" ? timeLimit * 60 : undefined,
        wrongOnly,
        favoriteOnly,
        notedOnly,
      };

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/exam/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "建立測驗失敗");
      }
    } catch {
      setError("建立測驗失敗，請重試");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">測驗設定</h1>

      {/* Mode selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">測驗模式</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode("PRACTICE")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              mode === "PRACTICE"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "border-gray-100 hover:border-gray-200 hover:shadow-md bg-white"
            }`}
          >
            <p className="font-semibold text-gray-900">練習模式</p>
            <p className="text-sm text-gray-600 mt-1">可隨時查看答案，無時間限制</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("MOCK")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              mode === "MOCK"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "border-gray-100 hover:border-gray-200 hover:shadow-md bg-white"
            }`}
          >
            <p className="font-semibold text-gray-900">模擬考模式</p>
            <p className="text-sm text-gray-600 mt-1">計時作答，交卷後顯示結果</p>
          </button>
        </div>
      </div>

      {/* Question bank selection */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">選擇題庫</h2>
        <p className="text-sm text-gray-600">不選則包含所有題庫</p>
        {loadingBanks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : questionBanks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>尚無題庫</p>
            <p className="text-sm mt-1">請先到題庫頁面匯入或新增題目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {questionBanks.map((bank) => (
              <label
                key={bank.id}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  selectedBankIds.includes(bank.id)
                    ? "bg-blue-50 ring-1 ring-blue-400"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedBankIds.includes(bank.id)}
                  onChange={() => toggleBank(bank.id)}
                  className="accent-blue-500 mt-0.5"
                />
                <span className="text-sm text-gray-900 min-w-0 truncate">
                  {bank.name}
                  <span className="text-gray-400 ml-2">({bank._count.questions} 題)</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">難度範圍</h2>
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDifficulty(d)}
              className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                difficultyRange.includes(d)
                  ? "bg-blue-50 border-blue-200 shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
              }`}
            >
              <DifficultyStars value={d} />
            </button>
          ))}
        </div>
      </div>

      {/* Count and Time */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">題目數量</label>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 20)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {mode === "MOCK" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">時間限制（分鐘）</label>
              <input
                type="number"
                min={1}
                max={360}
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Special options */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">特殊選項</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={wrongOnly}
            onChange={(e) => setWrongOnly(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-gray-700">只出錯題</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-gray-700">只出收藏題</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notedOnly}
            onChange={(e) => setNotedOnly(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-gray-700">只出筆記題</span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={creating}
        className="w-full py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-full text-lg font-bold transition-all"
      >
        {creating ? "建立中..." : "開始測驗"}
      </button>
    </div>
  );
}
