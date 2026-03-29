"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DifficultyStars } from "@/components/icons";
import { groupBanksByCategory } from "@/lib/group-banks";

interface QuestionBank {
  id: string;
  name: string;
  category?: string | null;
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
  const [untriedOnly, setUntriedOnly] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [hiddenBankIds, setHiddenBankIds] = useState<Set<string>>(new Set());
  const [srsDueCount, setSrsDueCount] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allChapters, setAllChapters] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [banksRes, hiddenRes, srsRes, tagsRes] = await Promise.all([
          fetch("/api/question-banks"),
          fetch("/api/hidden-banks"),
          fetch("/api/review-cards?stats=true"),
          fetch("/api/tags"),
        ]);
        if (banksRes.ok) {
          const data = await banksRes.json();
          setQuestionBanks(data.questionBanks);
        }
        if (hiddenRes.ok) {
          const hiddenData = await hiddenRes.json();
          setHiddenBankIds(new Set(hiddenData.hiddenBankIds || []));
        }
        if (srsRes.ok) {
          const srsData = await srsRes.json();
          setSrsDueCount(srsData.stats?.dueToday || 0);
        }
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          setAllTags(tagsData.tags || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBanks(false);
      }
    }
    fetchData();
  }, []);

  // Re-fetch tags and chapters when selected banks change
  useEffect(() => {
    const params = selectedBankIds.length > 0
      ? `?bankIds=${selectedBankIds.join(",")}`
      : "";
    async function fetchFilters() {
      try {
        const [tagsRes, chaptersRes] = await Promise.all([
          fetch(`/api/tags${params}`),
          fetch(`/api/chapters${params}`),
        ]);
        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setAllTags(data.tags || []);
          setSelectedTags((prev) =>
            prev.filter((t) => (data.tags || []).includes(t))
          );
        }
        if (chaptersRes.ok) {
          const data = await chaptersRes.json();
          setAllChapters(data.chapters || []);
          setSelectedChapters((prev) =>
            prev.filter((c) => (data.chapters || []).includes(c))
          );
        }
      } catch {
        // silently fail
      }
    }
    fetchFilters();
  }, [selectedBankIds]);

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

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function toggleChapter(chapter: string) {
    setSelectedChapters((prev) =>
      prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter]
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
        note: note.trim() || undefined,
        questionBankIds: selectedBankIds.length > 0 ? selectedBankIds : undefined,
        difficulty: difficultyRange.length > 0 && difficultyRange.length < 5 ? difficultyRange : undefined,
        count,
        mode,
        timeLimit: mode === "MOCK" ? timeLimit * 60 : undefined,
        wrongOnly,
        favoriteOnly,
        notedOnly,
        untriedOnly,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        chapters: selectedChapters.length > 0 ? selectedChapters : undefined,
        shuffleOptions,
        shuffleQuestions,
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

      {/* SRS review banner */}
      {srsDueCount > 0 && (
        <Link
          href="/exam/review"
          className="block bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                今天有 {srsDueCount} 張卡片需要複習
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                間隔複習幫你在最佳時間點鞏固記憶
              </p>
            </div>
            <span className="text-gray-500 text-lg">→</span>
          </div>
        </Link>
      )}

      {/* Mode selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">測驗模式</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode("PRACTICE")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              mode === "PRACTICE"
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "border-gray-100 hover:border-gray-200 hover:shadow-md bg-white"
            }`}
          >
            <p className={`font-semibold ${mode === "PRACTICE" ? "text-white dark:text-gray-900" : "text-gray-900"}`}>練習模式</p>
            <p className={`text-sm mt-1 ${mode === "PRACTICE" ? "text-gray-300 dark:text-gray-500" : "text-gray-600"}`}>可隨時查看答案，無時間限制</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("MOCK")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              mode === "MOCK"
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "border-gray-100 hover:border-gray-200 hover:shadow-md bg-white"
            }`}
          >
            <p className={`font-semibold ${mode === "MOCK" ? "text-white dark:text-gray-900" : "text-gray-900"}`}>模擬考模式</p>
            <p className={`text-sm mt-1 ${mode === "MOCK" ? "text-gray-300 dark:text-gray-500" : "text-gray-600"}`}>計時作答，交卷後顯示結果</p>
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
        ) : questionBanks.filter((b) => !hiddenBankIds.has(b.id)).length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {session ? (
              <>
                <p>尚無題庫</p>
                <p className="text-sm mt-1">請先到題庫頁面匯入或新增題目</p>
              </>
            ) : (
              <>
                <p>請先登入以查看題庫</p>
                <a href="/login" className="text-gray-500 hover:text-gray-700 text-sm mt-2 inline-block">前往登入</a>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupBanksByCategory(
              questionBanks.filter((b) => !hiddenBankIds.has(b.id))
            ).map((group) => (
              <div key={group.category}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{group.category}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.banks.map((bank) => (
                    <label
                      key={bank.id}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        selectedBankIds.includes(bank.id)
                          ? "bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-400 dark:ring-gray-500"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBankIds.includes(bank.id)}
                        onChange={() => toggleBank(bank.id)}
                        className="accent-gray-500 mt-0.5"
                      />
                      <span className="text-sm text-gray-900 min-w-0 truncate">
                        {bank.name}
                        <span className="text-gray-400 ml-2">({bank._count.questions} 題)</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
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
                  ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
              }`}
            >
              <DifficultyStars value={d} />
            </button>
          ))}
        </div>
      </div>

      {/* Chapter filter */}
      {allChapters.length > 0 && (
        <ExamChapterFilter
          allChapters={allChapters}
          selectedChapters={selectedChapters}
          onToggle={toggleChapter}
        />
      )}

      {/* Tags filter */}
      {allTags.length > 0 && (
        <ExamTagFilter
          allTags={allTags}
          selectedTags={selectedTags}
          onToggle={toggleTag}
        />
      )}

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
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
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
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* Special options */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">特殊選項</h2>

        {/* 題目篩選 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">題目篩選</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { checked: wrongOnly, onChange: setWrongOnly, label: "只出錯題", icon: "✕" },
              { checked: favoriteOnly, onChange: setFavoriteOnly, label: "只出收藏題", icon: "★" },
              { checked: notedOnly, onChange: setNotedOnly, label: "只出筆記題", icon: "✎" },
              { checked: untriedOnly, onChange: setUntriedOnly, label: "只出未做過", icon: "○" },
            ].map(({ checked, onChange, label, icon }) => (
              <label
                key={label}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? "bg-purple-50 dark:bg-purple-500/15 border-purple-300 dark:border-purple-400/50 shadow-sm ring-1 ring-purple-200 dark:ring-purple-400/30"
                    : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked)}
                  className="sr-only"
                />
                <span className={`text-base ${checked ? "text-purple-500 dark:text-purple-400" : "opacity-40"}`}>{icon}</span>
                <span className={`text-sm font-medium ${checked ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 作答設定 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">作答設定</p>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                shuffleQuestions
                  ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 shadow-sm"
                  : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500"
              }`}
            >
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="sr-only"
              />
              <span className={`text-base ${shuffleQuestions ? "text-purple-500 dark:text-purple-400" : "opacity-40"}`}>⇅</span>
              <div>
                <span className={`text-sm font-medium ${shuffleQuestions ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>題目亂序</span>
                <p className={`text-xs ${shuffleQuestions ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>隨機打亂出題順序</p>
              </div>
            </label>
            <label
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                shuffleOptions
                  ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 shadow-sm"
                  : "bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500"
              }`}
            >
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="sr-only"
              />
              <span className={`text-base ${shuffleOptions ? "text-purple-500 dark:text-purple-400" : "opacity-40"}`}>⇄</span>
              <div>
                <span className={`text-sm font-medium ${shuffleOptions ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>選項亂序</span>
                <p className={`text-xs ${shuffleOptions ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>隨機打亂選項順序</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Note */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">備註</h2>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例：CCSP Domain 1、內控第三章..."
          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10"
        />
        <p className="text-[11px] text-gray-400 mt-1.5">可選填，方便日後辨識這次練習的內容</p>
      </div>

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

/* ── Chapter filter for exam setup ── */
function ExamChapterFilter({ allChapters, selectedChapters, onToggle }: {
  allChapters: string[];
  selectedChapters: string[];
  onToggle: (chapter: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_LIMIT = 6;
  const visibleChapters = expanded ? allChapters : allChapters.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = allChapters.length - COLLAPSED_LIMIT;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">章節篩選</h2>
          <p className="text-sm text-gray-600">不選則不限章節</p>
        </div>
        {selectedChapters.length > 0 && (
          <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
            已選 {selectedChapters.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {visibleChapters.map((chapter) => (
          <button
            key={chapter}
            type="button"
            onClick={() => onToggle(chapter)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
              selectedChapters.includes(chapter)
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100 shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {chapter}
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          {expanded ? "收合" : `顯示全部 (${allChapters.length})`}
        </button>
      )}
    </div>
  );
}

/* ── Collapsible + searchable tag filter for exam setup ── */
const TAGS_COLLAPSED_LIMIT = 12;

function ExamTagFilter({ allTags, selectedTags, onToggle }: {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTags;
    const lower = search.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(lower));
  }, [allTags, search]);

  // Always show selected tags first, then the rest
  const sorted = useMemo(() => {
    const selected = filtered.filter((t) => selectedTags.includes(t));
    const rest = filtered.filter((t) => !selectedTags.includes(t));
    return [...selected, ...rest];
  }, [filtered, selectedTags]);

  const isSearching = search.trim().length > 0;
  const visibleTags = (expanded || isSearching) ? sorted : sorted.slice(0, TAGS_COLLAPSED_LIMIT);
  const hiddenCount = sorted.length - TAGS_COLLAPSED_LIMIT;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">標籤篩選</h2>
          <p className="text-sm text-gray-600">不選則不限標籤，選多個則取交集</p>
        </div>
        {selectedTags.length > 0 && (
          <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
            已選 {selectedTags.length}
          </span>
        )}
      </div>
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋標籤..."
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {visibleTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
              selectedTags.includes(tag)
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100 shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {tag}
          </button>
        ))}
        {visibleTags.length === 0 && (
          <p className="text-sm text-gray-400">找不到相符的標籤</p>
        )}
      </div>
      {/* Expand / Collapse */}
      {!isSearching && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          {expanded ? "收合" : `顯示全部 (${allTags.length})`}
        </button>
      )}
    </div>
  );
}
