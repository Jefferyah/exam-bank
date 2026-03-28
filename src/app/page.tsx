"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/icons";
import { ConfettiExplosion } from "@/components/confetti";

interface AnalyticsData {
  totalExams: number;
  completedExams: number;
  avgScore: number;
  bankAccuracy: { questionBankId: string; questionBankName: string; total: number; correct: number; accuracy: number }[];
  recentTrend: { id: string; title: string; score: number | null; finishedAt: string; startedAt: string; questionBankNames?: string[] }[];
  mostWrongQuestions: { questionId: string; stem: string; questionBankName: string; difficulty: number; wrongCount: number; lastWrongAt: string }[];
  totalWrongCount: number;
  todayQuestions: number;
  dailyGoal: number | null;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [analyticsRes, questionsRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/questions?limit=1"),
        ]);

        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setAnalytics(data);
        }
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          setTotalQuestions(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Hero section — always shown (top of page)
  const heroSection = (
    <div className="hero-gradient flex flex-col items-center justify-center px-4 py-16 md:py-24">
      <div className="text-center space-y-8 max-w-3xl mx-auto">
        {/* Badge */}
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur text-sm text-gray-600">
          <Sparkle className="w-4 h-4 text-amber-400" />
          <span>多題庫管理・智慧出題・模擬考</span>
        </div>

        {/* Hero heading */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
          <span className="text-gray-900">打造</span>{" "}
          <span className="text-gradient">最強</span>
          <br />
          <span className="text-gray-900">題庫練習系統</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-500 max-w-xl mx-auto leading-relaxed">
          多題庫管理、智慧出題、模擬考、學習分析<br />
          全方位備考平台，讓每次練習都有效率
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          {session ? (
            <>
              <Link
                href="/exam"
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-base md:text-lg font-medium transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
              >
                開始練習 →
              </Link>
              <Link
                href="/questions"
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-base md:text-lg font-medium transition-all whitespace-nowrap"
              >
                瀏覽題庫 →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-base md:text-lg font-medium transition-all shadow-lg hover:shadow-xl whitespace-nowrap"
              >
                開始使用 →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-base md:text-lg font-medium transition-all whitespace-nowrap"
              >
                瀏覽題庫 →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!session) {
    return heroSection;
  }

  const wrongCount = analytics?.totalWrongCount || 0;

  return (
    <div>
      {/* Hero — always visible */}
      {heroSection}

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          歡迎回來，<span className="text-gradient">{session.user?.name || session.user?.email}</span>
        </h1>
        <p className="text-gray-600 mt-1">繼續你的學習旅程</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="題庫總數" value={totalQuestions} />
        <StatCard label="已完成測驗" value={analytics?.completedExams || 0} />
        <StatCard label="平均分數" value={`${(analytics?.avgScore || 0).toFixed(1)}%`} />
        <StatCard label="錯題次數" value={wrongCount} />
      </div>

      {/* Daily Goal */}
      <DailyGoalCard
        todayQuestions={analytics?.todayQuestions ?? 0}
        dailyGoal={analytics?.dailyGoal ?? null}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction href="/exam" label="開始練習" desc="模擬測驗" />
        <QuickAction href="/questions" label="瀏覽題庫" desc="搜尋題目" />
        <QuickAction href="/review?tab=wrong" label="查看錯題" desc="重點複習" />
      </div>

      {/* Recent exams */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">最近測驗</h2>
          <Link href="/review" className="text-sm text-blue-500 hover:text-blue-600">
            查看全部
          </Link>
        </div>
        {analytics?.recentTrend && analytics.recentTrend.length > 0 ? (
          <div className="space-y-4">
            {analytics.recentTrend.map((exam) => {
              const pct = exam.score ?? 0;
              const barColor =
                pct >= 80 ? "from-gray-400 to-gray-500"
                : pct >= 60 ? "from-gray-300 to-gray-400"
                : pct >= 40 ? "from-gray-300 to-gray-400"
                : "from-gray-300 to-gray-400";
              const textColor =
                pct >= 80 ? "text-gray-900"
                : pct >= 60 ? "text-gray-700"
                : pct >= 40 ? "text-gray-600"
                : "text-gray-500";
              return (
                <Link
                  key={exam.id}
                  href={`/exam/${exam.id}/result`}
                  className="block group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {exam.title || "測驗"}
                      </p>
                      {exam.questionBankNames && exam.questionBankNames.length > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full truncate max-w-[160px] flex-shrink-0">
                          {exam.questionBankNames.join(", ")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {exam.finishedAt
                          ? new Date(exam.finishedAt).toLocaleDateString("zh-TW")
                          : "進行中"}
                      </span>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums flex-shrink-0 ml-3", textColor)}>
                      {exam.score != null ? `${exam.score.toFixed(1)}%` : "--"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r transition-all duration-500 group-hover:opacity-80",
                        barColor
                      )}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>尚無測驗記錄</p>
            <Link href="/exam" className="text-blue-500 hover:text-blue-600 text-sm mt-2 inline-block">
              開始第一次測驗
            </Link>
          </div>
        )}
      </div>

      {/* Bank accuracy overview */}
      {analytics?.bankAccuracy && analytics.bankAccuracy.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">各題庫正確率</h2>
          <div className="space-y-3">
            {analytics.bankAccuracy.map((d) => (
              <div key={d.questionBankId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 truncate mr-2">
                    {d.questionBankName}
                  </span>
                  <span className="text-gray-500 flex-shrink-0">{d.accuracy}% ({d.correct}/{d.total})</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      d.accuracy >= 70 ? "bg-gray-500" : d.accuracy >= 50 ? "bg-gray-400" : "bg-gray-300"
                    )}
                    style={{ width: `${d.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl p-5 transition-all hover:shadow-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1.5 tracking-tight text-gray-900">{value}</p>
    </div>
  );
}

function QuickAction({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl p-4 text-center transition-all hover:shadow-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-gray-200 shadow-sm"
    >
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-sm text-gray-400">{desc}</p>
    </Link>
  );
}

/* ── Daily Goal Card with Confetti ── */
function DailyGoalCard({ todayQuestions, dailyGoal }: { todayQuestions: number; dailyGoal: number | null }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const hasTriggeredRef = useRef(false);

  const isComplete = dailyGoal ? todayQuestions >= dailyGoal : false;
  const progress = dailyGoal ? Math.min(100, Math.round((todayQuestions / dailyGoal) * 100)) : 0;

  useEffect(() => {
    if (isComplete && !hasTriggeredRef.current) {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
      const celebrated = sessionStorage.getItem("exam-bank-goal-celebrated-day");
      if (celebrated === today) return;
      hasTriggeredRef.current = true;
      sessionStorage.setItem("exam-bank-goal-celebrated-day", today);
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!dailyGoal) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">每日練習目標</h3>
            <p className="text-xs text-gray-400 mt-0.5">設定每日刷題數量，養成學習習慣</p>
          </div>
          <Link
            href="/review"
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-xs font-medium transition-all"
          >
            前往設定
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      {showConfetti && <ConfettiExplosion />}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">每日練習目標</h3>
        <span className={cn(
          "text-xs font-medium px-2.5 py-1 rounded-full",
          isComplete
            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
            : "bg-gray-100 dark:bg-gray-700 text-gray-500"
        )}>
          {isComplete ? "已達成！" : `${progress}%`}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className={cn(
          "text-3xl font-bold tabular-nums text-gray-900"
        )}>
          {todayQuestions}
        </span>
        <span className="text-base text-gray-400 mb-0.5">/ {dailyGoal} 題</span>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={cn(
            "h-3 rounded-full transition-all duration-700 ease-out",
            isComplete
              ? "bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-100"
              : "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-400"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {!isComplete && dailyGoal - todayQuestions > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          還差 <span className="font-medium text-gray-600 dark:text-gray-300">{dailyGoal - todayQuestions}</span> 題就達標了，
          <Link href="/exam" className="text-blue-500 hover:text-blue-600 ml-0.5">繼續練習 →</Link>
        </p>
      )}
    </div>
  );
}

