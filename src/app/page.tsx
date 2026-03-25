"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";

interface AnalyticsData {
  totalExams: number;
  completedExams: number;
  avgScore: number;
  bankAccuracy: { questionBankId: string; questionBankName: string; total: number; correct: number; accuracy: number }[];
  recentTrend: { id: string; title: string; score: number | null; finishedAt: string; startedAt: string }[];
  mostWrongQuestions: { questionId: string; stem: string; questionBankName: string; difficulty: number; wrongCount: number; lastWrongAt: string }[];
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
          <div className="h-10 w-64 bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="hero-gradient flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            <span className="text-blue-500">萬用</span>題庫系統
          </h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            全方位考試準備平台，支援多題庫管理、模擬考、AI 解題、學習分析
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-lg font-medium shadow-sm transition-colors"
            >
              開始使用
            </Link>
            <Link
              href="#"
              className="inline-block px-8 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-lg font-medium transition-colors"
            >
              了解更多
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const wrongCount = analytics?.mostWrongQuestions?.reduce((sum, q) => sum + q.wrongCount, 0) || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          歡迎回來，<span className="text-blue-500">{session.user?.name || session.user?.email}</span>
        </h1>
        <p className="text-gray-500 mt-1">繼續你的學習旅程</p>
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/exam" label="開始練習" desc="模擬測驗" bgColor="bg-blue-50" textColor="text-blue-600" />
        <QuickAction href="/questions" label="瀏覽題庫" desc="搜尋題目" bgColor="bg-emerald-50" textColor="text-emerald-600" />
        <QuickAction href="/review" label="查看錯題" desc="重點複習" bgColor="bg-amber-50" textColor="text-amber-600" />
        <QuickAction href="/questions/create" label="AI 解題" desc="智慧分析" bgColor="bg-purple-50" textColor="text-purple-600" />
      </div>

      {/* Recent exams */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">最近測驗</h2>
          <Link href="/exam" className="text-sm text-blue-500 hover:text-blue-600">
            查看全部
          </Link>
        </div>
        {analytics?.recentTrend && analytics.recentTrend.length > 0 ? (
          <div className="space-y-3">
            {analytics.recentTrend.map((exam) => (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}/result`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{exam.title || "測驗"}</p>
                  <p className="text-sm text-gray-500">
                    {exam.finishedAt
                      ? new Date(exam.finishedAt).toLocaleDateString("zh-TW")
                      : "進行中"}
                  </p>
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  (exam.score || 0) >= 70 ? "text-emerald-500" : "text-red-500"
                )}>
                  {exam.score != null ? `${exam.score.toFixed(1)}%` : "--"}
                </div>
              </Link>
            ))}
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
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
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
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
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
  );
}

function StatCard({ label, value, icon, iconBg, iconColor }: { label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg, iconColor)}>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-3 text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
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
