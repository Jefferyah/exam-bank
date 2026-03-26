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
                href="/questions"
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

  const wrongCount = analytics?.mostWrongQuestions?.reduce((sum, q) => sum + q.wrongCount, 0) || 0;

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
        <StatCard
          label="題庫總數"
          value={totalQuestions}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>}
        />
        <StatCard
          label="已完成測驗"
          value={analytics?.completedExams || 0}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        <StatCard
          label="平均分數"
          value={`${(analytics?.avgScore || 0).toFixed(1)}%`}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
        />
        <StatCard
          label="錯題次數"
          value={wrongCount}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
      </div>

      {/* Daily Goal */}
      <DailyGoalCard
        todayQuestions={analytics?.todayQuestions ?? 0}
        dailyGoal={analytics?.dailyGoal ?? null}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction href="/exam" label="開始練習" desc="模擬測驗" bgColor="bg-blue-50" textColor="text-blue-600" />
        <QuickAction href="/questions" label="瀏覽題庫" desc="搜尋題目" bgColor="bg-emerald-50" textColor="text-emerald-600" />
        <QuickAction href="/review" label="查看錯題" desc="重點複習" bgColor="bg-amber-50" textColor="text-amber-600" />
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
                pct >= 80 ? "from-emerald-200 to-emerald-300"
                : pct >= 60 ? "from-blue-200 to-blue-300"
                : pct >= 40 ? "from-amber-200 to-amber-300"
                : "from-red-200 to-red-300";
              const textColor =
                pct >= 80 ? "text-emerald-500"
                : pct >= 60 ? "text-blue-500"
                : pct >= 40 ? "text-amber-500"
                : "text-red-500";
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
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate max-w-[160px] flex-shrink-0">
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
                      d.accuracy >= 70 ? "bg-emerald-300" : d.accuracy >= 50 ? "bg-amber-300" : "bg-red-300"
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

function StatCard({ label, value, icon, iconBg, iconColor }: { label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg, iconColor)}>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-3 tracking-tight text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ href, label, desc, bgColor, textColor }: { href: string; label: string; desc: string; bgColor: string; textColor: string }) {
  return (
    <Link
      href={href}
      className={cn("rounded-2xl p-4 text-center transition-all hover:shadow-md border border-transparent hover:border-gray-200", bgColor)}
    >
      <p className={cn("font-semibold", textColor)}>{label}</p>
      <p className={cn("text-sm opacity-70", textColor)}>{desc}</p>
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
      hasTriggeredRef.current = true;
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
            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
            : "bg-gray-100 dark:bg-gray-700 text-gray-500"
        )}>
          {isComplete ? "已達成！" : `${progress}%`}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className={cn(
          "text-3xl font-bold tabular-nums",
          isComplete ? "text-emerald-600" : "text-gray-900"
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
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : progress >= 50
                ? "bg-gradient-to-r from-blue-400 to-blue-500"
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

