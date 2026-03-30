"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DifficultyStars } from "@/components/icons";
import ProgressRing, { scoreToColor } from "@/components/progress-ring";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { setQuestionNavList } from "@/lib/question-nav";

/* ── Types ── */
interface WrongQuestion {
  questionId: string;
  stem: string;
  questionBankId: string;
  questionBankName: string;
  difficulty: number;
  wrongCount: number;
  lastWrongAt: string;
}

interface FavoriteQuestion {
  id: string;
  questionId: string;
  createdAt: string;
  question: {
    id: string;
    stem: string;
    difficulty: number;
    type: string;
    questionBank?: { name: string };
  };
}

interface NotedQuestion {
  id: string;
  content: string;
  questionId: string;
  question: {
    id: string;
    stem: string;
    difficulty: number;
    type: string;
    questionBankId: string;
    questionBank?: { name: string };
  };
}

interface RecentExam {
  id: string;
  title: string;
  note?: string | null;
  score: number | null;
  finishedAt: string;
  startedAt: string;
  questionBankNames: string[];
}

interface DifficultyDist {
  difficulty: number;
  total: number;
  correct: number;
  accuracy: number;
}

interface BankAccuracy {
  questionBankId: string;
  questionBankName: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface TimePerBank {
  questionBankId: string;
  questionBankName: string;
  avgTime: number;
  avgCorrectTime: number;
  avgWrongTime: number;
  count: number;
}

interface TimePerDifficulty {
  difficulty: number;
  avgTime: number;
  count: number;
}

interface ModeComparison {
  mode: string;
  count: number;
  avgScore: number;
  avgDuration: number;
}

interface TagAccuracy {
  tag: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface DailyActivity {
  date: string;
  exams: number;
  questions: number;
}

interface CategoryScore {
  category: string;
  bankNames: string[];
  totalQuestions: number;
  questionsAttempted: number;
  indicators: {
    coverage: number;
    mastery: number;
    time: number;
    correction: number;
    trend: number;
  };
  rawValues: {
    masteryAccuracy: number;
    timeMinutes: number;
    targetMinutes: number;
    activeDays: number;
    correctedCount: number;
    wrongCount: number;
  };
  score: number;
}

interface SuccessRateData {
  categories: CategoryScore[];
  overallScore: number;
}

interface AnalyticsData {
  totalExams: number;
  completedExams: number;
  avgScore: number;
  bankAccuracy: BankAccuracy[];
  difficultyDistribution: DifficultyDist[];
  recentTrend: RecentExam[];
  mostWrongQuestions: WrongQuestion[];
  allWrongQuestions: WrongQuestion[];
  timeAnalysis: {
    avgTimePerQuestion: number;
    timePerDifficulty: TimePerDifficulty[];
    timePerBank: TimePerBank[];
  };
  modeComparison: ModeComparison[];
  tagAccuracy: TagAccuracy[];
  dailyActivity: DailyActivity[];
  currentStreak: number;
  todayQuestions: number;
  dailyGoal: number | null;
  statsResetAt: string | null;
}

/* ── Main ── */
export default function ReviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "wrong" | "favorites" | "notes" | "srs">("dashboard");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [notedQuestions, setNotedQuestions] = useState<NotedQuestion[]>([]);
  const [srsStats, setSrsStats] = useState<{ totalCards: number; dueToday: number; byStatus: Record<string, number>; masteryRate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [successRate, setSuccessRate] = useState<SuccessRateData | null>(null);

  // Wrong tab state
  const [wrongSort, setWrongSort] = useState<"count" | "recent" | "difficulty">("count");
  const [wrongGroupBy, setWrongGroupBy] = useState<"none" | "bank">("none");
  const [mastered, setMastered] = useState<Set<string>>(new Set());

  // Daily goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);

  // Date range filter
  const [dateRange, setDateRange] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");

  useEffect(() => {
    if (!session) { setLoading(false); return; }

    // Load mastered from localStorage
    try {
      const stored = localStorage.getItem("exam-bank-mastered");
      if (stored) setMastered(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }

    fetchData();
  }, [session]);

  // Compute since date from dateRange
  const sinceDate = useMemo(() => {
    if (dateRange === "all") return null;
    if (dateRange === "custom") return customDate || null;
    const now = new Date();
    if (dateRange === "7d") now.setDate(now.getDate() - 7);
    else if (dateRange === "30d") now.setDate(now.getDate() - 30);
    else if (dateRange === "90d") now.setDate(now.getDate() - 90);
    return now.toISOString().split("T")[0];
  }, [dateRange, customDate]);

  async function fetchData() {
    try {
      const analyticsUrl = sinceDate ? `/api/analytics?since=${sinceDate}` : "/api/analytics";
      const [analyticsRes, favRes, notesRes, srsRes, successRateRes] = await Promise.all([
        fetch(analyticsUrl),
        fetch("/api/favorites?limit=500"),
        fetch("/api/notes?limit=500"),
        fetch("/api/review-cards?stats=true"),
        fetch("/api/success-rate"),
      ]);

      if (analyticsRes.ok) {
        const data: AnalyticsData = await analyticsRes.json();
        setAnalytics(data);
        setWrongQuestions(data.allWrongQuestions || data.mostWrongQuestions || []);
        setDailyGoal(data.dailyGoal);
        setGoalDraft(data.dailyGoal?.toString() || "");
      }
      if (favRes.ok) {
        const data = await favRes.json();
        setFavorites(data.favorites || []);
      }
      if (notesRes.ok) {
        const data = await notesRes.json();
        setNotedQuestions(data.notes || []);
      }
      if (srsRes.ok) {
        const data = await srsRes.json();
        setSrsStats(data.stats || null);
      }
      if (successRateRes.ok) {
        const data = await successRateRes.json();
        setSuccessRate(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch when date range changes
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinceDate]);

  /* ── Actions ── */
  async function handleRemoveFavorite(questionId: string) {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) setFavorites((prev) => prev.filter((f) => f.questionId !== questionId));
    } catch (err) { console.error(err); }
  }

  async function handleReviewWrong() {
    // Use processedWrong (excludes mastered) instead of full wrongQuestions
    const unmasteredIds = processedWrong.map((q) => q.questionId);
    if (unmasteredIds.length === 0) return;
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `錯題重做 - ${new Date().toLocaleDateString("zh-TW")}`,
          count: Math.min(unmasteredIds.length, 50),
          mode: "PRACTICE",
          wrongOnly: true,
          excludeQuestionIds: [...mastered],
        }),
      });
      if (res.ok) { const data = await res.json(); router.push(`/exam/${data.id}`); }
    } catch (err) { console.error(err); }
  }

  async function handleReviewNotes() {
    if (notedQuestions.length === 0) return;
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `筆記題重做 - ${new Date().toLocaleDateString("zh-TW")}`,
          count: Math.min(notedQuestions.length, 50),
          mode: "PRACTICE",
          notedOnly: true,
        }),
      });
      if (res.ok) { const data = await res.json(); router.push(`/exam/${data.id}`); }
    } catch (err) { console.error(err); }
  }

  async function handlePracticeBank(bankId: string, bankName: string) {
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `加強練習 - ${bankName}`,
          questionBankIds: [bankId],
          count: 20,
          mode: "PRACTICE",
        }),
      });
      if (res.ok) { const data = await res.json(); router.push(`/exam/${data.id}`); }
    } catch (err) { console.error(err); }
  }

  function toggleMastered(questionId: string) {
    setMastered((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      localStorage.setItem("exam-bank-mastered", JSON.stringify([...next]));
      return next;
    });
  }

  async function handleSaveGoal() {
    const val = goalDraft.trim() === "" ? null : parseInt(goalDraft, 10);
    if (val !== null && (isNaN(val) || val < 1 || val > 500)) return;
    setSavingGoal(true);
    try {
      const res = await fetch("/api/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoal: val }),
      });
      if (res.ok) {
        setDailyGoal(val);
        setEditingGoal(false);
      }
    } catch (err) { console.error(err); }
    finally { setSavingGoal(false); }
  }

  /* ── Filtered & sorted wrong questions ── */
  const processedWrong = useMemo(() => {
    let list = wrongQuestions.filter((q) => !mastered.has(q.questionId));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((q) => q.stem.toLowerCase().includes(s) || q.questionBankName.toLowerCase().includes(s));
    }
    list = [...list].sort((a, b) => {
      if (wrongSort === "count") return b.wrongCount - a.wrongCount;
      if (wrongSort === "recent") return new Date(b.lastWrongAt).getTime() - new Date(a.lastWrongAt).getTime();
      return b.difficulty - a.difficulty;
    });
    return list;
  }, [wrongQuestions, mastered, search, wrongSort]);

  const wrongByBank = useMemo(() => {
    if (wrongGroupBy !== "bank") return null;
    const groups: Record<string, WrongQuestion[]> = {};
    for (const q of processedWrong) {
      const key = q.questionBankName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(q);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [processedWrong, wrongGroupBy]);

  const filteredFav = favorites.filter((f) =>
    !search || f.question.stem.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNotes = notedQuestions.filter((n) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return n.question.stem.toLowerCase().includes(s) || n.content.toLowerCase().includes(s);
  });

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入以查看複習內容</p>
        <Link href="/login" className="text-gray-900 hover:text-gray-800 mt-2 inline-block font-medium">登入</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">複習中心</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {([
          ["dashboard", "總覽"],
          ["srs", `間隔複習${srsStats?.dueToday ? ` (${srsStats.dueToday})` : ""}`],
          ["wrong", `錯題本 (${wrongQuestions.length})`],
          ["favorites", `收藏 (${favorites.length})`],
          ["notes", `筆記 (${notedQuestions.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              tab === key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search (not on dashboard) */}
      {tab !== "dashboard" && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋..."
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tab === "dashboard" ? (
        <DashboardTab
          analytics={analytics}
          dailyGoal={dailyGoal}
          editingGoal={editingGoal}
          setEditingGoal={setEditingGoal}
          goalDraft={goalDraft}
          setGoalDraft={setGoalDraft}
          savingGoal={savingGoal}
          handleSaveGoal={handleSaveGoal}
          mastered={mastered}
          handlePracticeBank={handlePracticeBank}
          successRate={successRate}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customDate={customDate}
          setCustomDate={setCustomDate}
        />
      ) : tab === "srs" ? (
        <SrsTab stats={srsStats} />
      ) : tab === "wrong" ? (
        <WrongTab
          wrongQuestions={processedWrong}
          wrongByBank={wrongByBank}
          wrongSort={wrongSort}
          setWrongSort={setWrongSort}
          wrongGroupBy={wrongGroupBy}
          setWrongGroupBy={setWrongGroupBy}
          mastered={mastered}
          toggleMastered={toggleMastered}
          allWrongCount={wrongQuestions.length}
          masteredCount={mastered.size}
          handleReviewWrong={handleReviewWrong}
          search={search}
        />
      ) : tab === "favorites" ? (
        <FavoritesTab
          favorites={filteredFav}
          search={search}
          handleRemoveFavorite={handleRemoveFavorite}
        />
      ) : (
        <NotesTab
          notes={filteredNotes}
          search={search}
          handleReviewNotes={handleReviewNotes}
          hasNotes={notedQuestions.length > 0}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   A. Dashboard Tab — Enriched Analytics
   ════════════════════════════════════════ */
function DashboardTab({
  analytics,
  dailyGoal,
  editingGoal,
  setEditingGoal,
  goalDraft,
  setGoalDraft,
  savingGoal,
  handleSaveGoal,
  mastered,
  handlePracticeBank,
  successRate,
  dateRange,
  setDateRange,
  customDate,
  setCustomDate,
}: {
  analytics: AnalyticsData | null;
  dailyGoal: number | null;
  editingGoal: boolean;
  setEditingGoal: (v: boolean) => void;
  goalDraft: string;
  setGoalDraft: (v: string) => void;
  savingGoal: boolean;
  handleSaveGoal: () => void;
  mastered: Set<string>;
  handlePracticeBank: (bankId: string, bankName: string) => void;
  successRate: SuccessRateData | null;
  dateRange: string;
  setDateRange: (v: string) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
}) {
  if (!analytics) {
    return <div className="text-center py-12 text-gray-400">尚無分析資料，完成一次考試後即可查看</div>;
  }

  const a = analytics;
  const todayProgress = dailyGoal ? Math.min(100, Math.round((a.todayQuestions / dailyGoal) * 100)) : 0;
  const totalAnswered = a.bankAccuracy.reduce((s, b) => s + b.total, 0);
  const totalCorrect = a.bankAccuracy.reduce((s, b) => s + b.correct, 0);
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const sortedBanks = [...a.bankAccuracy].sort((x, y) => x.accuracy - y.accuracy);

  // Calculate score improvement (first half vs second half of recent exams)
  const scoreImprovement = (() => {
    if (a.recentTrend.length < 4) return null;
    const reversed = [...a.recentTrend].reverse(); // oldest first
    const half = Math.floor(reversed.length / 2);
    const firstHalf = reversed.slice(0, half);
    const secondHalf = reversed.slice(half);
    const firstAvg = firstHalf.reduce((s, e) => s + (e.score ?? 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, e) => s + (e.score ?? 0), 0) / secondHalf.length;
    return Math.round(secondAvg - firstAvg);
  })();

  // Find best & worst difficulty
  const bestDiff = a.difficultyDistribution.length > 0
    ? [...a.difficultyDistribution].sort((x, y) => y.accuracy - x.accuracy)[0]
    : null;
  const worstDiff = a.difficultyDistribution.length > 0
    ? [...a.difficultyDistribution].sort((x, y) => x.accuracy - y.accuracy)[0]
    : null;

  return (
    <div className="space-y-6">

      {/* ── Date Range Filter ── */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-gray-400">統計範圍</span>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {[
            { value: "all", label: "全部" },
            { value: "7d", label: "7天" },
            { value: "30d", label: "30天" },
            { value: "90d", label: "3個月" },
            { value: "custom", label: "自訂" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                dateRange === opt.value
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dateRange === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="ml-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        )}
      </div>

      {/* ── Success Rate ── */}
      {successRate && successRate.categories.length > 0 && (
        <SuccessRateSection data={successRate} />
      )}

      {/* ── Daily Goal ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">每日目標</h2>
          {!editingGoal && (
            <button
              onClick={() => { setEditingGoal(true); setGoalDraft(dailyGoal?.toString() || ""); }}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              {dailyGoal ? "修改" : "設定目標"}
            </button>
          )}
        </div>
        {editingGoal ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">每日刷</span>
            <input
              type="number"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              min={1}
              max={500}
              className="w-20 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-center"
              placeholder="20"
            />
            <span className="text-sm text-gray-600">題</span>
            <button
              onClick={handleSaveGoal}
              disabled={savingGoal}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              儲存
            </button>
            <button onClick={() => setEditingGoal(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        ) : dailyGoal ? (
          <div>
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-bold text-gray-900">{a.todayQuestions}<span className="text-lg font-normal text-gray-400 ml-0.5">/ {dailyGoal}</span></span>
              <span className={cn("text-sm font-semibold", todayProgress >= 100 ? "bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-cyan-500 dark:to-blue-500 bg-clip-text text-transparent" : "text-gray-500")}>
                {todayProgress >= 100 ? "已達成!" : `${todayProgress}%`}
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
              <div
                className={cn("h-3 rounded-full transition-all duration-500", todayProgress >= 100 ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 dark:from-cyan-400 dark:via-blue-500 dark:to-indigo-500" : "bg-gradient-to-r from-indigo-200 via-purple-200 to-violet-200 dark:from-cyan-800 dark:via-blue-800 dark:to-indigo-800")}
                style={{ width: `${todayProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">設定每日刷題目標，養成學習習慣</p>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="連續學習"
          value={`${a.currentStreak}`}
          unit="天"
          color="orange"
          detail={a.currentStreak >= 7 ? "🔥 持續保持！" : a.currentStreak >= 3 ? "穩定進步中" : "再接再厲"}
        />
        <SummaryCard
          label="完成考試"
          value={`${a.completedExams}`}
          unit="次"
          color="blue"
          detail={`共 ${a.totalExams} 次考試`}
        />
        <SummaryCard
          label="平均分數"
          value={`${a.avgScore.toFixed(1)}`}
          unit="分"
          color={a.avgScore >= 80 ? "emerald" : a.avgScore >= 60 ? "amber" : "red"}
          detail={a.avgScore >= 80 ? "表現優秀" : a.avgScore >= 60 ? "持續加強" : "需要加油"}
        />
        <SummaryCard
          label="總正確率"
          value={`${overallAccuracy}`}
          unit="%"
          color={overallAccuracy >= 80 ? "emerald" : overallAccuracy >= 60 ? "amber" : "red"}
          detail={`${a.completedExams > 0 ? "最近趨勢" : "尚無資料"}`}
        />
      </div>

      {/* ── Quick Insight Banner ── */}
      {(scoreImprovement !== null || worstDiff) && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">學習洞察</h3>
          <div className="flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            {scoreImprovement !== null && (
              <p>
                {scoreImprovement > 0
                  ? `近期分數提升了 ${scoreImprovement} 分，繼續保持！`
                  : scoreImprovement < 0
                    ? `近期分數下降了 ${Math.abs(scoreImprovement)} 分，可以加強弱點題庫的練習`
                    : `近期分數持平，嘗試挑戰更高難度的題目吧`}
              </p>
            )}
            {worstDiff && bestDiff && worstDiff.difficulty !== bestDiff.difficulty && (
              <p>
                難度 {bestDiff.difficulty} 最擅長（{bestDiff.accuracy}%），難度 {worstDiff.difficulty} 需加強（{worstDiff.accuracy}%）
              </p>
            )}
            {sortedBanks.length > 0 && sortedBanks[0].accuracy < 60 && (
              <p>
                「{sortedBanks[0].questionBankName}」正確率最低（{sortedBanks[0].accuracy}%），建議重點練習
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Score Trend Chart ── */}
      {a.recentTrend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">分數走勢（最近 {a.recentTrend.length} 次）</h2>
            {a.recentTrend.length >= 2 && (
              <span className="text-xs text-gray-400">
                最高 {Math.max(...a.recentTrend.map(e => e.score ?? 0)).toFixed(0)} / 最低 {Math.min(...a.recentTrend.map(e => e.score ?? 0)).toFixed(0)}
              </span>
            )}
          </div>
          {/* Line chart area */}
          <div className="relative h-44">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-gray-400">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            {/* Grid lines */}
            <div className="absolute left-8 right-0 top-0 bottom-6">
              {[0, 25, 50, 75].map((v) => (
                <div key={v} className="absolute w-full border-t border-dashed border-gray-100 dark:border-gray-700" style={{ top: `${(1 - v / 100) * 100}%` }} />
              ))}
            </div>
            {/* Bars */}
            <div className="absolute left-10 right-2 top-0 bottom-6 flex items-end gap-1">
              {a.recentTrend.slice().reverse().map((e) => {
                const score = e.score ?? 0;
                const barColor = score >= 80 ? "bg-emerald-300 dark:bg-emerald-400/40" : score >= 60 ? "bg-amber-200 dark:bg-amber-400/40" : "bg-red-200 dark:bg-red-400/40";
                const barHeight = Math.max(4, score);
                return (
                  <Link key={e.id} href={`/exam/${e.id}/result`} className="flex-1 h-full relative group flex items-end">
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {score.toFixed(0)}分 — {e.title}
                    </div>
                    <div
                      className={cn("w-full rounded-t-lg transition-all", barColor, "group-hover:opacity-80")}
                      style={{ height: `${barHeight}%` }}
                    />
                  </Link>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="absolute left-10 right-2 bottom-0 flex">
              {a.recentTrend.slice().reverse().map((e) => (
                <span key={e.id} className="flex-1 text-center text-[10px] text-gray-400 truncate">
                  {new Date(e.finishedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 30-day Activity Heatmap ── */}
      {a.dailyActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">近 30 天活動</h2>
            <span className="text-xs text-gray-400">
              共 {a.dailyActivity.reduce((s, d) => s + d.questions, 0)} 題 / {a.dailyActivity.reduce((s, d) => s + d.exams, 0)} 次考試
            </span>
          </div>
          <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
            {a.dailyActivity.map((d) => {
              const intensity = d.questions === 0 ? 0 : d.questions <= 5 ? 1 : d.questions <= 15 ? 2 : d.questions <= 30 ? 3 : 4;
              const colors = ["bg-gray-100 dark:bg-gray-700", "bg-purple-100 dark:bg-purple-400/20", "bg-purple-200 dark:bg-purple-400/30", "bg-purple-300 dark:bg-purple-400/40", "bg-purple-400 dark:bg-purple-400/50"];
              const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
              return (
                <div
                  key={d.date}
                  className={cn("aspect-square rounded-sm", colors[intensity], "relative group cursor-default")}
                  title={`${dayLabel}: ${d.questions} 題, ${d.exams} 次考試`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {dayLabel}: {d.questions} 題 / {d.exams} 次
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-400">
            <span>少</span>
            {["bg-gray-100 dark:bg-gray-700", "bg-purple-100 dark:bg-purple-400/20", "bg-purple-200 dark:bg-purple-400/30", "bg-purple-300 dark:bg-purple-400/40", "bg-purple-400 dark:bg-purple-400/50"].map((c, i) => (
              <div key={i} className={cn("w-3 h-3 rounded-sm", c)} />
            ))}
            <span>多</span>
          </div>
        </div>
      )}

      {/* ── Practice vs Mock Comparison ── */}
      {a.modeComparison.length > 0 && (() => {
        const modes: { mode: string; count: number; avgScore: number; avgDuration: number }[] = [
          a.modeComparison.find((m) => m.mode === "MOCK") || { mode: "MOCK", count: 0, avgScore: 0, avgDuration: 0 },
          a.modeComparison.find((m) => m.mode === "PRACTICE") || { mode: "PRACTICE", count: 0, avgScore: 0, avgDuration: 0 },
        ];
        return (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">練習 vs 模擬考</h2>
            <div className="grid grid-cols-2 gap-4">
              {modes.map((m) => {
                const label = m.mode === "PRACTICE" ? "練習模式" : "模擬考";
                const isEmpty = m.count === 0;

                return (
                  <div key={m.mode} className={cn("bg-gray-50 dark:bg-gray-700 rounded-xl p-4", isEmpty && "opacity-50")}>
                    <div className="text-sm font-medium text-gray-900 mb-3">{label}</div>
                    {isEmpty ? (
                      <div className="text-xs text-gray-400 py-2">尚無資料</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">次數</span>
                          <span className="font-bold text-gray-900">{m.count}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均分數</span>
                          <span className={cn("font-bold", m.avgScore >= 80 ? "text-emerald-600" : m.avgScore >= 60 ? "text-amber-600" : "text-red-600")}>
                            {m.avgScore.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均用時</span>
                          <span className="font-medium text-gray-900">{formatDuration(m.avgDuration)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Time Analysis: Speed vs Accuracy ── */}
      {(a.timeAnalysis.timePerDifficulty.length > 0 || a.timeAnalysis.timePerBank.length > 0) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">作答時間分析</h2>
          <p className="text-xs text-gray-400 mb-4">資料來自模擬考模式</p>

          {/* Average time badge */}
          {a.timeAnalysis.avgTimePerQuestion > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{a.timeAnalysis.avgTimePerQuestion}s</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">平均每題作答時間</span>
            </div>
          )}

          {/* Time per difficulty — bar chart */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">各難度平均秒數</h3>
            {a.timeAnalysis.timePerDifficulty.length >= 2 ? (
              <div className="flex items-end justify-center gap-3 h-32">
                {a.timeAnalysis.timePerDifficulty.map((d) => {
                  const maxTime = Math.max(...a.timeAnalysis.timePerDifficulty.map((x) => x.avgTime));
                  const pct = maxTime > 0 ? (d.avgTime / maxTime) * 100 : 0;
                  return (
                    <div key={d.difficulty} className="flex flex-col items-center gap-1" style={{ width: `${Math.min(100 / Math.max(a.timeAnalysis.timePerDifficulty.length, 3), 33)}%` }}>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{d.avgTime}s</span>
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-purple-300 to-purple-200 dark:from-purple-400/40 dark:to-purple-300/30 transition-all" style={{ height: `${Math.max(12, pct)}%` }} />
                      <span className="text-[10px] text-gray-500">Lv.{d.difficulty}</span>
                      <span className="text-[10px] text-gray-400">{d.count}題</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">資料不足，需至少涵蓋 2 種難度</p>
            )}
          </div>

          {/* Time per bank — correct vs wrong side-by-side */}
          {a.timeAnalysis.timePerBank.length > 0 && a.timeAnalysis.timePerBank.reduce((s, b) => s + b.count, 0) >= 5 ? (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">各題庫答題速度 — 答對 vs 答錯</h3>
              <div className="space-y-3">
                {a.timeAnalysis.timePerBank.map((b) => {
                  const maxVal = Math.max(b.avgCorrectTime, b.avgWrongTime, 1);
                  return (
                    <div key={b.questionBankId} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{b.questionBankName}</span>
                        <span className="text-xs text-gray-400">{b.count} 題 / 平均 {b.avgTime}s</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        {b.avgCorrectTime > 0 && (
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] text-gray-600 font-medium">✓ 答對 {b.avgCorrectTime}s</span>
                            </div>
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div className="bg-emerald-300 dark:bg-emerald-400/40 h-2 rounded-full" style={{ width: `${(b.avgCorrectTime / maxVal) * 100}%` }} />
                            </div>
                          </div>
                        )}
                        {b.avgWrongTime > 0 && (
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] text-gray-500 font-medium">✗ 答錯 {b.avgWrongTime}s</span>
                            </div>
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div className="bg-red-200 dark:bg-red-400/40 h-2 rounded-full" style={{ width: `${(b.avgWrongTime / maxVal) * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">各題庫答題速度 — 答對 vs 答錯</h3>
              <p className="text-xs text-gray-400 py-4 text-center">資料不足，需至少完成 5 題模擬考</p>
            </div>
          )}
        </div>
      )}

      {/* ── Difficulty Accuracy ── */}
      {a.difficultyDistribution.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">各難度正確率</h2>
          <div className="space-y-3">
            {a.difficultyDistribution.map((d) => (
              <div key={d.difficulty} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-20 sm:w-24">
                  <DifficultyStars value={d.difficulty} />
                </div>
                <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
                  <div
                    className={cn(
                      "h-4 rounded-full transition-all",
                      d.accuracy >= 80 ? "bg-emerald-300 dark:bg-emerald-400/40" : d.accuracy >= 60 ? "bg-amber-200 dark:bg-amber-400/40" : "bg-red-200 dark:bg-red-400/40"
                    )}
                    style={{ width: `${Math.max(d.accuracy, 3)}%` }}
                  />
                </div>
                <span className="flex-shrink-0 text-right text-xs text-gray-600 whitespace-nowrap">
                  {Math.round(d.accuracy)}% ({d.correct}/{d.total})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bank Accuracy + Practice Buttons (merged from /review/weak) ── */}
      {sortedBanks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">各題庫正確率排名</h2>
          <div className="space-y-3">
            {sortedBanks.map((d, i) => (
              <div
                key={d.questionBankId}
                className={cn(
                  "p-3 rounded-xl",
                  i === 0 && d.accuracy < 60 ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" : "bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {i === 0 && d.accuracy < 60 && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] rounded-full font-medium flex-shrink-0">
                          最弱
                        </span>
                      )}
                      {i === sortedBanks.length - 1 && sortedBanks.length > 1 && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] rounded-full font-medium flex-shrink-0">
                          最強
                        </span>
                      )}
                      <span className="font-medium text-sm text-gray-900 truncate">{d.questionBankName}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div
                          className={cn(
                            "h-2.5 rounded-full transition-all",
                            d.accuracy >= 80 ? "bg-emerald-300 dark:bg-emerald-400/40" : d.accuracy >= 60 ? "bg-amber-200 dark:bg-amber-400/40" : "bg-red-200 dark:bg-red-400/40"
                          )}
                          style={{ width: `${d.accuracy}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 flex-shrink-0 w-24 text-right">
                        {d.accuracy}% ({d.correct}/{d.total})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePracticeBank(d.questionBankId, d.questionBankName)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-medium transition-all flex-shrink-0",
                      d.accuracy < 60
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    )}
                  >
                    加強練習
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tag Accuracy ── */}
      {a.tagAccuracy && a.tagAccuracy.length > 0 && (() => {
        const sortedTags = [...a.tagAccuracy]
          .filter((t) => t.total > 0)
          .sort((x, y) => x.accuracy - y.accuracy);
        const TAG_LIMIT = 6;
        return (
          <TagAccuracySection sortedTags={sortedTags} limit={TAG_LIMIT} />
        );
      })()}

      {/* ── Most Wrong Questions Top 5 ── */}
      {a.mostWrongQuestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">最常錯的題目</h2>
            {a.allWrongQuestions.length > 5 && (
              <span className="text-xs text-gray-400">顯示前 5 題 · 完整列表請看錯題本</span>
            )}
          </div>
          <div className="space-y-2">
            {a.mostWrongQuestions.slice(0, 5).map((q, i) => (
              <div
                key={q.questionId}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-650 transition-colors"
              >
                <span className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  i === 0 ? "bg-red-100 text-red-600" : "bg-gray-200 dark:bg-gray-600 text-gray-500"
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/questions/${q.questionId}`}
                    onClick={() => setQuestionNavList(a.mostWrongQuestions.slice(0, 5).map((wq: { questionId: string }) => wq.questionId), "常錯題目")}
                  >
                    <p className="text-sm text-gray-900 line-clamp-1 hover:text-gray-600 transition-colors">{q.stem}</p>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span className="text-red-500 font-medium">錯 {q.wrongCount} 次</span>
                    <span>{q.questionBankName}</span>
                    <DifficultyStars value={q.difficulty} />
                  </div>
                </div>
                <CopyQuestionButton stem={q.stem} options={[]} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   D. Enhanced Wrong Tab
   ════════════════════════════════════════ */
function WrongTab({
  wrongQuestions,
  wrongByBank,
  wrongSort,
  setWrongSort,
  wrongGroupBy,
  setWrongGroupBy,
  mastered,
  toggleMastered,
  allWrongCount,
  masteredCount,
  handleReviewWrong,
  search,
}: {
  wrongQuestions: WrongQuestion[];
  wrongByBank: [string, WrongQuestion[]][] | null;
  wrongSort: "count" | "recent" | "difficulty";
  setWrongSort: (v: "count" | "recent" | "difficulty") => void;
  wrongGroupBy: "none" | "bank";
  setWrongGroupBy: (v: "none" | "bank") => void;
  mastered: Set<string>;
  toggleMastered: (id: string) => void;
  allWrongCount: number;
  masteredCount: number;
  handleReviewWrong: () => void;
  search: string;
}) {
  // Set nav list for prev/next navigation
  useEffect(() => {
    const ids = wrongByBank
      ? wrongByBank.flatMap(([, qs]) => qs.map((q) => q.questionId))
      : wrongQuestions.map((q) => q.questionId);
    setQuestionNavList(ids, "錯題本");
  }, [wrongQuestions, wrongByBank]);

  return (
    <>
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>共 {allWrongCount} 題</span>
        {masteredCount > 0 && (
          <span className="text-gray-600">已掌握 {masteredCount} 題</span>
        )}
        <span>顯示 {wrongQuestions.length} 題</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {allWrongCount > 0 && (
          <button
            onClick={handleReviewWrong}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-medium transition-colors"
          >
            重做錯題
          </button>
        )}

        <select
          value={wrongSort}
          onChange={(e) => setWrongSort(e.target.value as typeof wrongSort)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-700"
        >
          <option value="count">按錯誤次數</option>
          <option value="recent">按最近錯誤</option>
          <option value="difficulty">按難度</option>
        </select>

        <select
          value={wrongGroupBy}
          onChange={(e) => setWrongGroupBy(e.target.value as typeof wrongGroupBy)}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-700"
        >
          <option value="none">不分群</option>
          <option value="bank">按題庫分群</option>
        </select>
      </div>

      {wrongQuestions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? "找不到符合的錯題" : masteredCount > 0 ? "所有錯題都已標記為掌握" : "目前沒有錯題記錄"}</p>
        </div>
      ) : wrongByBank ? (
        /* Grouped view */
        <div className="space-y-6">
          {wrongByBank.map(([bankName, questions]) => (
            <div key={bankName}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{bankName}</h3>
                <span className="text-xs text-gray-400">{questions.length} 題</span>
              </div>
              <div className="space-y-2">
                {questions.map((q) => (
                  <WrongQuestionCard key={q.questionId} q={q} mastered={mastered} toggleMastered={toggleMastered} showBank={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat view */
        <div className="space-y-3">
          {wrongQuestions.map((q) => (
            <WrongQuestionCard key={q.questionId} q={q} mastered={mastered} toggleMastered={toggleMastered} showBank={true} />
          ))}
        </div>
      )}
    </>
  );
}

function WrongQuestionCard({
  q,
  mastered,
  toggleMastered,
  showBank,
}: {
  q: WrongQuestion;
  mastered: Set<string>;
  toggleMastered: (id: string) => void;
  showBank: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/questions/${q.questionId}`} className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 line-clamp-2">{q.stem}</p>
        </Link>
        <div className="flex items-center gap-1 flex-shrink-0">
          <CopyQuestionButton stem={q.stem} options={[]} />
          <button
            onClick={() => toggleMastered(q.questionId)}
            title={mastered.has(q.questionId) ? "取消掌握" : "標記已掌握"}
            className={cn(
              "px-2 py-1 rounded-full text-[10px] font-medium transition-colors border",
              mastered.has(q.questionId)
                ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {mastered.has(q.questionId) ? "已掌握" : "掌握"}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">錯 {q.wrongCount} 次</span>
        {showBank && <span>{q.questionBankName}</span>}
        <DifficultyStars value={q.difficulty} />
        <span>最後：{new Date(q.lastWrongAt).toLocaleDateString("zh-TW")}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Favorites Tab
   ════════════════════════════════════════ */
function FavoritesTab({
  favorites,
  search,
  handleRemoveFavorite,
}: {
  favorites: FavoriteQuestion[];
  search: string;
  handleRemoveFavorite: (id: string) => void;
}) {
  useEffect(() => {
    setQuestionNavList(favorites.map((f) => f.questionId), "收藏");
  }, [favorites]);

  return (
    <>
      {favorites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? "找不到符合的收藏題" : "目前沒有收藏題目"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((f) => (
            <div
              key={f.id}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex items-start sm:items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap"
            >
              <Link
                href={`/questions/${f.questionId}`}
                className="flex-1 min-w-0 hover:text-gray-900 transition-colors"
              >
                <p className="text-sm text-gray-900 line-clamp-2">{f.question.stem}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  <span>{f.question.questionBank?.name || "未分類"}</span>
                  <DifficultyStars value={f.question.difficulty} />
                </div>
              </Link>
              <CopyQuestionButton stem={f.question.stem} options={[]} />
              <button
                onClick={() => handleRemoveFavorite(f.questionId)}
                className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-full text-xs transition-colors flex-shrink-0"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Notes Tab
   ════════════════════════════════════════ */
function NotesTab({
  notes,
  search,
  handleReviewNotes,
  hasNotes,
}: {
  notes: NotedQuestion[];
  search: string;
  handleReviewNotes: () => void;
  hasNotes: boolean;
}) {
  useEffect(() => {
    setQuestionNavList(notes.map((n) => n.questionId), "筆記");
  }, [notes]);

  return (
    <>
      {hasNotes && (
        <button
          onClick={handleReviewNotes}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-colors"
        >
          重做所有筆記題
        </button>
      )}
      {notes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? "找不到符合的筆記題" : "目前沒有筆記記錄"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/questions/${n.questionId}`} className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 line-clamp-2">{n.question.stem}</p>
                </Link>
                <CopyQuestionButton stem={n.question.stem} options={[]} />
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{n.content}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span>{n.question.questionBank?.name || n.question.questionBankId}</span>
                <DifficultyStars value={n.question.difficulty} />
                <Link
                  href={`/questions/${n.questionId}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  重做
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Helpers ── */
const CARD_COLORS = {
  blue:    { bar: "from-gray-300 to-gray-400", bg: "bg-gray-50/60 dark:bg-gray-800/60", text: "text-gray-700 dark:text-gray-300", sub: "text-gray-500/70 dark:text-gray-400/60" },
  emerald: { bar: "from-gray-300 to-gray-400", bg: "bg-gray-50/60 dark:bg-gray-800/60", text: "text-gray-700 dark:text-gray-300", sub: "text-gray-500/70 dark:text-gray-400/60" },
  amber:   { bar: "from-gray-300 to-gray-400", bg: "bg-gray-50/60 dark:bg-gray-800/60", text: "text-gray-700 dark:text-gray-300", sub: "text-gray-500/70 dark:text-gray-400/60" },
  orange:  { bar: "from-gray-300 to-gray-400", bg: "bg-gray-50/60 dark:bg-gray-800/60", text: "text-gray-700 dark:text-gray-300", sub: "text-gray-500/70 dark:text-gray-400/60" },
  red:     { bar: "from-gray-300 to-gray-400", bg: "bg-gray-50/60 dark:bg-gray-800/60", text: "text-gray-700 dark:text-gray-300", sub: "text-gray-500/70 dark:text-gray-400/60" },
} as const;

/* ════════════════════════════════════════
   Success Rate Section — Circular Progress Rings
   ════════════════════════════════════════ */

const INDICATOR_LABELS: Record<string, string> = {
  coverage: "覆蓋率",
  mastery: "精熟度",
  time: "投入時間",
  correction: "訂正率",
  trend: "近期趨勢",
};

const INDICATOR_WEIGHTS: Record<string, number> = {
  coverage: 25,
  mastery: 30,
  time: 15,
  correction: 15,
  trend: 15,
};

const INDICATOR_DESCRIPTIONS: Record<string, string> = {
  coverage: "題目覆蓋率：做過的題目佔該分類總題數的比例。做 1 次得 50%、2 次 85%、3 次以上 100%。",
  mastery: "精熟度：第 2 次以上作答的正確率 × 題目覆蓋率，反映理解程度與廣度。正確率 85% 以上且覆蓋全部題目才能滿分。",
  time: "投入時間：實際花費時間與目標時間（每題 4 分鐘）的比例。時間投入越接近目標分數越高。",
  correction: "訂正率：答錯的題目後來有答對的比例。全部訂正為滿分，從未答錯也算滿分。未做過任何題目則為 0 分。",
  trend: "近期趨勢：過去 15 天的練習頻率。最近 5 天權重最高，持續練習分數越高。",
};

function TagAccuracySection({ sortedTags, limit }: { sortedTags: TagAccuracy[]; limit: number }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sortedTags : sortedTags.slice(0, limit);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-4">各標籤正確率</h2>
      <div className="space-y-2">
        {visible.map((t) => (
          <div key={t.tag} className="flex items-center gap-3 p-2">
            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full flex-shrink-0 max-w-[120px] truncate">
              {t.tag}
            </span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 min-w-0">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  t.accuracy >= 80 ? "bg-emerald-300 dark:bg-emerald-400/40" : t.accuracy >= 60 ? "bg-amber-200 dark:bg-amber-400/40" : "bg-red-200 dark:bg-red-400/40"
                )}
                style={{ width: `${t.accuracy}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0 w-24 text-right">
              {Math.round(t.accuracy)}% ({t.correct}/{t.total})
            </span>
          </div>
        ))}
      </div>
      {sortedTags.length > limit && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full text-center"
        >
          {showAll ? "收起" : `顯示全部 ${sortedTags.length} 個標籤`}
        </button>
      )}
    </div>
  );
}

function SuccessRateSection({ data }: { data: SuccessRateData }) {
  const [showExplain, setShowExplain] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">學習成功率</h2>
        <button
          onClick={() => setShowExplain(!showExplain)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showExplain ? "收起說明" : "計分說明"}
        </button>
      </div>

      {/* Explanation panel */}
      {showExplain && (
        <div className="bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3 text-xs text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-700 dark:text-gray-300">成功率是綜合評估你在各分類題庫的學習表現，包含以下 5 項指標：</p>
          <div className="space-y-2">
            {Object.entries(INDICATOR_LABELS).map(([key, label]) => (
              <div key={key} className="flex gap-2">
                <span className="flex-shrink-0 font-semibold text-gray-700 dark:text-gray-300 w-20">
                  {label}（{INDICATOR_WEIGHTS[key]}%）
                </span>
                <span>{INDICATOR_DESCRIPTIONS[key]}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 dark:text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-600">
            總分 = 各指標加權平均，多個分類再依題數加權。只計算你做過的題庫分類。
          </p>
          <div className="flex items-center gap-4 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(85) }} />
              <span>70%+ 優秀</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(55) }} />
              <span>40-70% 待加強</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(20) }} />
              <span>0-40% 需努力</span>
            </span>
          </div>
        </div>
      )}

      {/* Category cards — ring left, indicators right */}
      <div className="space-y-3">
        {data.categories.map((cat) => {
          const rv = cat.rawValues;
          const RAW_DETAILS: Record<string, string> = {
            coverage: `已做 ${cat.questionsAttempted} / ${cat.totalQuestions} 題`,
            mastery: rv ? `第2次以上正確率 ${rv.masteryAccuracy}% × 覆蓋 ${cat.questionsAttempted}/${cat.totalQuestions} 題` : "",
            time: rv ? `已投入 ${rv.timeMinutes} 分 / 目標 ${rv.targetMinutes} 分` : "",
            correction: rv ? (rv.wrongCount === 0 ? "從未答錯" : `已訂正 ${rv.correctedCount} / ${rv.wrongCount} 題`) : "",
            trend: rv ? `近 15 天有 ${rv.activeDays} 天練習` : "",
          };
          return (
            <div
              key={cat.category}
              className="bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 rounded-xl p-4"
            >
              <div className="flex gap-4">
                {/* Left: ring */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <ProgressRing score={cat.score} size={64} strokeWidth={5} showLabel={true} />
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mt-1.5 text-center">
                    {cat.category}
                  </p>
                  <p className="text-[10px] text-gray-400 text-center">
                    {cat.questionsAttempted}/{cat.totalQuestions} 題
                  </p>
                </div>

                {/* Right: indicator bars */}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[10px] text-gray-400 truncate">{cat.bankNames.join("、")}</p>
                  {(Object.entries(cat.indicators) as [string, number][]).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 text-right flex-shrink-0">
                          {INDICATOR_LABELS[key]}
                        </span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${value}%`,
                              backgroundColor: scoreToColor(value),
                            }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: scoreToColor(value) }}>
                          {value}%
                        </span>
                      </div>
                      {RAW_DETAILS[key] && (
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 ml-16 mt-0.5">{RAW_DETAILS[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, unit, color, detail }: {
  label: string; value: string; unit: string;
  color: keyof typeof CARD_COLORS;
  detail?: string;
}) {
  const c = CARD_COLORS[color];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm", c.bg)}>
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", c.bar)} />
      <div className="pl-4 pr-4 py-4">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={cn("text-2xl font-bold tabular-nums", c.text)}>{value}</span>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{unit}</span>
        </div>
        {detail && (
          <p className={cn("text-[11px] mt-1.5", c.sub)}>{detail}</p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   E. SRS Tab — Spaced Repetition Dashboard
   ════════════════════════════════════════ */
function SrsTab({ stats }: { stats: { totalCards: number; dueToday: number; byStatus: Record<string, number>; masteryRate: number } | null }) {
  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>載入中...</p>
      </div>
    );
  }

  const total = stats.totalCards;
  const { NEW: newCount = 0, LEARNING: learningCount = 0, REVIEW: reviewCount = 0, MASTERED: masteredCount = 0 } = stats.byStatus;

  return (
    <div className="space-y-6">
      {/* Due today hero card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="text-5xl font-bold text-gray-900 mb-1">{stats.dueToday}</div>
        <p className="text-gray-500 mb-4">今天需要複習的卡片</p>
        {stats.dueToday > 0 ? (
          <Link
            href="/exam/review"
            className="inline-flex px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-colors"
          >
            開始間隔複習
          </Link>
        ) : (
          <p className="text-sm text-gray-500 font-medium">
            {total > 0 ? "今天的複習已完成！" : "做練習來建立複習排程"}
          </p>
        )}
      </div>

      {/* Status breakdown */}
      {total > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">掌握度分佈</h3>

          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700">
            {newCount > 0 && (
              <div
                className="bg-blue-200 dark:bg-blue-400/40 transition-all"
                style={{ width: `${(newCount / total) * 100}%` }}
                title={`新卡片 ${newCount}`}
              />
            )}
            {learningCount > 0 && (
              <div
                className="bg-amber-200 dark:bg-amber-400/40 transition-all"
                style={{ width: `${(learningCount / total) * 100}%` }}
                title={`學習中 ${learningCount}`}
              />
            )}
            {reviewCount > 0 && (
              <div
                className="bg-purple-200 dark:bg-purple-400/40 transition-all"
                style={{ width: `${(reviewCount / total) * 100}%` }}
                title={`複習中 ${reviewCount}`}
              />
            )}
            {masteredCount > 0 && (
              <div
                className="bg-emerald-300 dark:bg-emerald-400/40 transition-all"
                style={{ width: `${(masteredCount / total) * 100}%` }}
                title={`已精熟 ${masteredCount}`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-400/40" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{newCount}</div>
                <div className="text-xs text-gray-400">新卡片</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-200 dark:bg-amber-400/40" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{learningCount}</div>
                <div className="text-xs text-gray-400">學習中</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-200 dark:bg-purple-400/40" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{reviewCount}</div>
                <div className="text-xs text-gray-400">複習中</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-300 dark:bg-emerald-400/40" />
              <div>
                <div className="text-sm font-semibold text-gray-900">{masteredCount}</div>
                <div className="text-xs text-gray-400">已精熟</div>
              </div>
            </div>
          </div>

          {/* Mastery rate */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">精熟率</span>
              <span className="text-lg font-bold text-gray-900">{stats.masteryRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 mt-1">
              <div
                className="h-2 rounded-full bg-emerald-300 dark:bg-emerald-400/40 transition-all"
                style={{ width: `${stats.masteryRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">間隔複習如何運作？</h3>
        <div className="space-y-2 text-sm text-gray-500">
          <p>系統根據你對每道題的掌握程度，自動安排最佳複習時間：</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>做練習或考試時，系統自動建立複習卡片</li>
            <li>答錯的題目會更快出現在複習中</li>
            <li>答對的題目間隔會逐漸拉長（1天 → 3天 → 7天 → ...）</li>
            <li>你也可以手動將任何題目加入複習排程</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}分${s}秒` : `${m}分`;
  const h = Math.floor(m / 60);
  return `${h}時${m % 60}分`;
}
