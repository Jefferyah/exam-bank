"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
          <div className="h-10 w-64 rounded-2xl" style={{ background: 'var(--accent-bg)' }} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'var(--accent-bg)' }} />
            ))}
          </div>
          <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--accent-bg)' }} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="hero-gradient flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="text-center space-y-8">
          {/* Nature badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium" style={{ color: 'var(--primary)' }}>
            <span>🌱</span>
            <span>智慧學習，自然成長</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            <span className="text-emerald-700">輕鬆備考</span>
            <br />
            <span style={{ color: 'var(--foreground)' }}>你的萬用題庫系統</span>
          </h1>

          <p className="text-lg max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
            支援多題庫管理、智慧出題、模擬考、AI 解題、學習分析，
            <br className="hidden sm:block" />
            讓每一次練習都帶你向前一步
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="btn-nature px-8 py-3.5 text-lg"
            >
              開始使用
            </Link>
            <Link
              href="/questions"
              className="btn-secondary px-8 py-3.5 text-lg"
            >
              瀏覽題庫
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
            <FeatureChip icon="📚" label="多題庫管理" />
            <FeatureChip icon="🤖" label="AI 三模型解題" />
            <FeatureChip icon="📈" label="學習數據分析" />
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
        <h1 className="text-2xl md:text-3xl font-bold">
          歡迎回來，<span className="text-emerald-600">{session.user?.name || session.user?.email}</span>
        </h1>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>繼續你的學習旅程 🌿</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="題庫總數"
          value={totalQuestions}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>}
        />
        <StatCard
          label="已完成測驗"
          value={analytics?.completedExams || 0}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction href="/exam" label="開始練習" desc="模擬測驗" icon="🏃" bgColor="bg-emerald-50" textColor="text-emerald-700" />
        <QuickAction href="/questions" label="瀏覽題庫" desc="搜尋題目" icon="📚" bgColor="bg-blue-50" textColor="text-blue-700" />
        <QuickAction href="/review" label="查看錯題" desc="重點複習" icon="🔄" bgColor="bg-amber-50" textColor="text-amber-700" />
      </div>

      {/* Recent exams */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">最近測驗</h2>
          <Link href="/exam" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            查看全部 →
          </Link>
        </div>
        {analytics?.recentTrend && analytics.recentTrend.length > 0 ? (
          <div className="space-y-3">
            {analytics.recentTrend.map((exam) => (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}/result`}
                className="flex items-center justify-between p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: 'var(--accent-bg)' }}
              >
                <div>
                  <p className="font-medium">{exam.title || "測驗"}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
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
          <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
            <p className="text-3xl mb-2">🌱</p>
            <p>尚無測驗記錄</p>
            <Link href="/exam" className="text-emerald-600 hover:text-emerald-700 text-sm mt-2 inline-block font-medium">
              開始第一次測驗 →
            </Link>
          </div>
        )}
      </div>

      {/* Bank accuracy overview */}
      {analytics?.bankAccuracy && analytics.bankAccuracy.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">各題庫正確率</h2>
          <div className="space-y-3">
            {analytics.bankAccuracy.map((d) => (
              <div key={d.questionBankId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate mr-2">{d.questionBankName}</span>
                  <span style={{ color: 'var(--muted)' }} className="flex-shrink-0">{d.accuracy}% ({d.correct}/{d.total})</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'var(--accent-bg)' }}>
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

function FeatureChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatCard({ label, value, icon, iconBg, iconColor }: { label: string; value: string | number; icon: React.ReactNode; iconBg: string; iconColor: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 transition-all hover:scale-[1.02]">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg, iconColor)}>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}

function QuickAction({ href, label, desc, icon, bgColor, textColor }: { href: string; label: string; desc: string; icon: string; bgColor: string; textColor: string }) {
  return (
    <Link
      href={href}
      className={cn("rounded-2xl p-5 text-center transition-all hover:scale-[1.02] hover:shadow-md", bgColor)}
    >
      <p className="text-2xl mb-1">{icon}</p>
      <p className={cn("font-semibold", textColor)}>{label}</p>
      <p className={cn("text-sm opacity-70", textColor)}>{desc}</p>
    </Link>
  );
}
