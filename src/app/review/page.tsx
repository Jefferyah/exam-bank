"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DifficultyStars } from "@/components/icons";
import { CopyQuestionButton } from "@/components/copy-question-button";

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

interface DailyActivity {
  date: string;
  exams: number;
  questions: number;
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
  dailyActivity: DailyActivity[];
  currentStreak: number;
  todayQuestions: number;
  dailyGoal: number | null;
}

/* ── Main ── */
export default function ReviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "wrong" | "favorites" | "notes">("dashboard");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [notedQuestions, setNotedQuestions] = useState<NotedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Wrong tab state
  const [wrongSort, setWrongSort] = useState<"count" | "recent" | "difficulty">("count");
  const [wrongGroupBy, setWrongGroupBy] = useState<"none" | "bank">("none");
  const [mastered, setMastered] = useState<Set<string>>(new Set());

  // Daily goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);

  useEffect(() => {
    if (!session) { setLoading(false); return; }

    // Load mastered from localStorage
    try {
      const stored = localStorage.getItem("exam-bank-mastered");
      if (stored) setMastered(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }

    async function fetchData() {
      try {
        const [analyticsRes, favRes, notesRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/favorites?limit=100"),
          fetch("/api/notes?limit=100"),
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session]);

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
    if (wrongQuestions.length === 0) return;
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `錯題重做 - ${new Date().toLocaleDateString("zh-TW")}`,
          count: Math.min(wrongQuestions.length, 50),
          mode: "PRACTICE",
          wrongOnly: true,
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
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {([
          ["dashboard", "總覽"],
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
        />
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
              <span className="text-3xl font-bold text-gray-900">{a.todayQuestions}<span className="text-base font-normal text-gray-400">/{dailyGoal}</span></span>
              <span className={cn("text-sm font-medium", todayProgress >= 100 ? "text-emerald-600" : "text-gray-500")}>
                {todayProgress >= 100 ? "已達成!" : `${todayProgress}%`}
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
              <div
                className={cn("h-3 rounded-full transition-all duration-500", todayProgress >= 100 ? "bg-emerald-500" : "bg-blue-500")}
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
        <SummaryCard label="連續學習" value={`${a.currentStreak}`} unit="天" accent={a.currentStreak >= 3 ? "text-orange-500" : undefined} />
        <SummaryCard label="完成考試" value={`${a.completedExams}`} unit="次" />
        <SummaryCard label="平均分數" value={`${a.avgScore.toFixed(1)}`} unit="分" accent={a.avgScore >= 80 ? "text-emerald-600" : a.avgScore >= 60 ? "text-amber-600" : "text-red-600"} />
        <SummaryCard label="總正確率" value={`${overallAccuracy}`} unit="%" accent={overallAccuracy >= 80 ? "text-emerald-600" : overallAccuracy >= 60 ? "text-amber-600" : "text-red-600"} />
      </div>

      {/* ── Quick Insight Banner ── */}
      {(scoreImprovement !== null || worstDiff) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">學習洞察</h3>
          <div className="flex flex-col gap-1.5 text-sm text-blue-800 dark:text-blue-300">
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
            {/* Bars + trend line */}
            <div className="absolute left-10 right-2 top-0 bottom-6 flex items-end gap-1">
              {a.recentTrend.slice().reverse().map((e) => {
                const score = e.score ?? 0;
                const barColor = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
                return (
                  <Link key={e.id} href={`/exam/${e.id}/result`} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-full mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {score.toFixed(0)}分 — {e.title}
                    </div>
                    <div
                      className={cn("w-full rounded-t-lg transition-all", barColor, "group-hover:opacity-80 min-h-[4px]")}
                      style={{ height: `${Math.max(3, score)}%` }}
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
              const colors = ["bg-gray-100 dark:bg-gray-700", "bg-emerald-200", "bg-emerald-400", "bg-emerald-500", "bg-emerald-600"];
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
            {["bg-gray-100 dark:bg-gray-700", "bg-emerald-200", "bg-emerald-400", "bg-emerald-500", "bg-emerald-600"].map((c, i) => (
              <div key={i} className={cn("w-3 h-3 rounded-sm", c)} />
            ))}
            <span>多</span>
          </div>
        </div>
      )}

      {/* ── Practice vs Mock Comparison ── */}
      {a.modeComparison.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">練習 vs 模擬考</h2>
          <div className="grid grid-cols-2 gap-4">
            {a.modeComparison.map((m) => {
              const label = m.mode === "PRACTICE" ? "練習模式" : "模擬考";

              return (
                <div key={m.mode} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-900 mb-3">{label}</div>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Difficulty Accuracy ── */}
      {a.difficultyDistribution.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">各難度正確率</h2>
          <div className="space-y-3">
            {a.difficultyDistribution.map((d) => (
              <div key={d.difficulty} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-16">
                  <DifficultyStars value={d.difficulty} />
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative overflow-hidden">
                  <div
                    className={cn(
                      "h-4 rounded-full transition-all",
                      d.accuracy >= 80 ? "bg-emerald-500" : d.accuracy >= 60 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.max(d.accuracy, 3)}%` }}
                  />
                </div>
                <span className="flex-shrink-0 w-28 text-right text-xs text-gray-600">
                  {Math.round(d.accuracy)}% ({d.correct}/{d.total})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Time Analysis: Speed vs Accuracy ── */}
      {(a.timeAnalysis.timePerDifficulty.length > 0 || a.timeAnalysis.timePerBank.length > 0) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">作答時間分析</h2>
          <p className="text-xs text-gray-400 mb-4">資料來自模擬考模式</p>

          {/* Average time badge */}
          {a.timeAnalysis.avgTimePerQuestion > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
              <span className="text-2xl font-bold text-blue-600">{a.timeAnalysis.avgTimePerQuestion}s</span>
              <span className="text-sm text-blue-700 dark:text-blue-300">平均每題作答時間</span>
            </div>
          )}

          {/* Time per difficulty — bar chart */}
          {a.timeAnalysis.timePerDifficulty.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">各難度平均秒數</h3>
              <div className="flex items-end gap-3 h-32">
                {a.timeAnalysis.timePerDifficulty.map((d) => {
                  const maxTime = Math.max(...a.timeAnalysis.timePerDifficulty.map((x) => x.avgTime));
                  const pct = maxTime > 0 ? (d.avgTime / maxTime) * 100 : 0;
                  return (
                    <div key={d.difficulty} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-gray-700">{d.avgTime}s</span>
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all" style={{ height: `${Math.max(12, pct)}%` }} />
                      <span className="text-[10px] text-gray-500">Lv.{d.difficulty}</span>
                      <span className="text-[10px] text-gray-400">{d.count}題</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time per bank — correct vs wrong side-by-side */}
          {a.timeAnalysis.timePerBank.length > 0 && (
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
                              <span className="text-[10px] text-emerald-600 font-medium">✓ 答對 {b.avgCorrectTime}s</span>
                            </div>
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(b.avgCorrectTime / maxVal) * 100}%` }} />
                            </div>
                          </div>
                        )}
                        {b.avgWrongTime > 0 && (
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] text-red-600 font-medium">✗ 答錯 {b.avgWrongTime}s</span>
                            </div>
                            <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(b.avgWrongTime / maxVal) * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] rounded-full font-medium flex-shrink-0">
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
                            d.accuracy >= 80 ? "bg-emerald-500" : d.accuracy >= 60 ? "bg-amber-500" : "bg-red-500"
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
                  <Link href={`/questions/${q.questionId}`}>
                    <p className="text-sm text-gray-900 line-clamp-1 hover:text-blue-600 transition-colors">{q.stem}</p>
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
  return (
    <>
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>共 {allWrongCount} 題</span>
        {masteredCount > 0 && (
          <span className="text-emerald-600">已掌握 {masteredCount} 題</span>
        )}
        <span>顯示 {wrongQuestions.length} 題</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {allWrongCount > 0 && (
          <button
            onClick={handleReviewWrong}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-sm font-medium transition-colors"
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
                ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200"
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
  return (
    <>
      {hasNotes && (
        <button
          onClick={handleReviewNotes}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors"
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
                  className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
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
function SummaryCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm text-center">
      <div className={cn("text-2xl font-bold", accent || "text-gray-900")}>
        {value}
        <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
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
