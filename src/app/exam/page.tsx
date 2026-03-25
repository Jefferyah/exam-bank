"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DOMAINS, DomainKey } from "@/lib/utils";

export default function ExamSetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mode, setMode] = useState<"PRACTICE" | "MOCK">("PRACTICE");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [difficultyRange, setDifficultyRange] = useState<number[]>([1, 2, 3, 4, 5]);
  const [count, setCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const domainKeys = Object.keys(DOMAINS) as DomainKey[];

  function toggleDomain(key: string) {
    setSelectedDomains((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
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
        domains: selectedDomains.length > 0 ? selectedDomains : undefined,
        difficulty: difficultyRange.length > 0 && difficultyRange.length < 5 ? difficultyRange : undefined,
        count,
        mode,
        timeLimit: mode === "MOCK" ? timeLimit * 60 : undefined,
        wrongOnly,
        favoriteOnly,
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
      <h1 className="text-2xl font-bold">測驗設定</h1>

      {/* Mode selector */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">測驗模式</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode("PRACTICE")}
            className={`p-4 rounded-lg border-2 transition-colors text-left ${
              mode === "PRACTICE"
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-600 hover:border-slate-500"
            }`}
          >
            <p className="font-semibold">練習模式</p>
            <p className="text-sm text-slate-400 mt-1">可隨時查看答案，無時間限制</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("MOCK")}
            className={`p-4 rounded-lg border-2 transition-colors text-left ${
              mode === "MOCK"
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-600 hover:border-slate-500"
            }`}
          >
            <p className="font-semibold">模擬考模式</p>
            <p className="text-sm text-slate-400 mt-1">計時作答，交卷後顯示結果</p>
          </button>
        </div>
      </div>

      {/* Domain selection */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">選擇 Domain</h2>
        <p className="text-sm text-slate-400">不選則包含全部 Domain</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {domainKeys.map((key) => (
            <label
              key={key}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedDomains.includes(key)
                  ? "bg-indigo-500/10 ring-1 ring-indigo-500"
                  : "bg-slate-700/50 hover:bg-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedDomains.includes(key)}
                onChange={() => toggleDomain(key)}
                className="accent-indigo-500 mt-0.5"
              />
              <span className="text-sm">{DOMAINS[key]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">難度範圍</h2>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDifficulty(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                difficultyRange.includes(d)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              {"★".repeat(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Count and Time */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">題目數量</label>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 20)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {mode === "MOCK" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">時間限制（分鐘）</label>
              <input
                type="number"
                min={1}
                max={360}
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Special options */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">特殊選項</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={wrongOnly}
            onChange={(e) => setWrongOnly(e.target.checked)}
            className="accent-indigo-500"
          />
          <span>只出錯題</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
            className="accent-indigo-500"
          />
          <span>只出收藏題</span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={creating}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg text-lg font-bold transition-colors"
      >
        {creating ? "建立中..." : "開始測驗"}
      </button>
    </div>
  );
}
