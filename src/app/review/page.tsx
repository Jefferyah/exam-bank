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
   A. Dashboard Tab
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
}) {
  if (!analytics) {
    return <div className="text-center py-12 text-gray-400">尚無分析資料，完成一次考試後即可查看</div>;
  }

  const a = analytics;
  const todayProgress = dailyGoal ? Math.min(100, Math.round((a.todayQuestions / dailyGoal) * 100)) : 0;

  return (
    <div className="space-y-6">

      {/* ── E. Daily Goal ── */}
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
        <SummaryCard label="平均作答" value={a.timeAnalysis.avgTimePerQuestion > 0 ? `${a.timeAnalysis.avgTimePerQuestion}` : "-"} unit="秒/題" />
      </div>

      {/* ── Score Trend (last 10 exams) ── */}
      {a.recentTrend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">分數走勢（最近 {a.recentTrend.length} 次）</h2>
          <div className="flex items-end gap-1 h-40">
            {a.recentTrend.slice().reverse().map((e, i) => {
              const score = e.score ?? 0;
              const barColor = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
              return (
                <Link key={e.id} href={`/exam/${e.id}/result`} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-xs font-medium text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {score.toFixed(0)}
                  </span>
                  <div
                    className={cn("w-full rounded-t-lg transition-all", barColor, "group-hover:opacity-80 min-h-[4px]")}
                    style={{ height: `${Math.max(3, score * 1.2)}%` }}
                  />
                  <span className="text-[10px] text-gray-400 truncate w-full text-center">
                    {new Date(e.finishedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 30-day Activity Heatmap ── */}
      {a.dailyActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">近 30 天活動</h2>
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
                    {dayLabel}: {d.questions} 題
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

      {/* ── Practice vs Mock ── */}
      {a.modeComparison.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">練習 vs 模擬考</h2>
          <div className="grid grid-cols-2 gap-4">
            {a.modeComparison.map((m) => (
              <div key={m.mode} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-900 mb-2">{m.mode === "PRACTICE" ? "練習模式" : "模擬考"}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>次數</span><span className="font-medium text-gray-900">{m.count}</span></div>
                  <div className="flex justify-between"><span>平均分數</span><span className="font-medium text-gray-900">{m.avgScore.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>平均用時</span><span className="font-medium text-gray-900">{formatDuration(m.avgDuration)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── B. Difficulty Analysis ── */}
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
                    style={{ width: `${d.accuracy}%` }}
                  />
                </div>
                <span className="flex-shrink-0 w-28 text-right text-sm text-gray-600">
                  {d.accuracy}% <span className="text-gray-400">({d.correct}/{d.total})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── C. Time Analysis ── */}
      {a.timeAnalysis.timePerBank.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">作答時間分析</h2>

          {/* Time per difficulty */}
          {a.timeAnalysis.timePerDifficulty.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">各難度平均秒數</h3>
              <div className="flex items-end gap-2 h-28">
                {a.timeAnalysis.timePerDifficulty.map((d) => {
                  const maxTime = Math.max(...a.timeAnalysis.timePerDifficulty.map((x) => x.avgTime));
                  const pct = maxTime > 0 ? (d.avgTime / maxTime) * 100 : 0;
                  return (
                    <div key={d.difficulty} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-600">{d.avgTime}s</span>
                      <div className="w-full bg-blue-400 rounded-t-lg" style={{ height: `${Math.max(8, pct)}%` }} />
                      <span className="text-[10px] text-gray-400">難度{d.difficulty}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time per bank — correct vs wrong */}
          <h3 className="text-sm font-medium text-gray-500 mb-3">各題庫答題速度（答對 vs 答錯）</h3>
          <div className="space-y-3">
            {a.timeAnalysis.timePerBank.map((b) => (
              <div key={b.questionBankId} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                <div className="text-sm font-medium text-gray-900 mb-2 truncate">{b.questionBankName}</div>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span>平均 <strong className="text-gray-900">{b.avgTime}s</strong></span>
                  {b.avgCorrectTime > 0 && (
                    <span>答對 <strong className="text-emerald-600">{b.avgCorrectTime}s</strong></span>
                  )}
                  {b.avgWrongTime > 0 && (
                    <span>答錯 <strong className="text-red-600">{b.avgWrongTime}s</strong></span>
                  )}
                  <span className="text-gray-400">{b.count} 題</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bank Accuracy (from weak page) ── */}
      {a.bankAccuracy.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">各題庫正確率</h2>
          <div className="space-y-3">
            {[...a.bankAccuracy].sort((x, y) => x.accuracy - y.accuracy).map((d, i) => (
              <div key={d.questionBankId} className="flex items-center gap-3">
                {i === 0 && (
                  <span className="flex-shrink-0 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-medium">弱</span>
                )}
                {i !== 0 && <span className="flex-shrink-0 w-6" />}
                <span className="flex-shrink-0 w-24 text-sm text-gray-900 truncate">{d.questionBankName}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={cn(
                      "h-3 rounded-full",
                      d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${d.accuracy}%` }}
                  />
                </div>
                <span className="flex-shrink-0 w-28 text-right text-xs text-gray-600">
                  {d.accuracy}% ({d.correct}/{d.total})
                </span>
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
