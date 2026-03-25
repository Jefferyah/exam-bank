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
          <div className="h-10 w-64 bg-slate-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-slate-800 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="text-indigo-400">萬用</span>題庫系統
          </h1>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            全方位考試準備平台，支援多題庫管理、模擬考、AI 解題、學習分析
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-lg font-medium transition-colors"
          >
            開始使用
          </Link>
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
          歡迎回來，<span className="text-indigo-400">{session.user?.name || session.user?.email}</span>
        </h1>
        <p className="text-slate-400 mt-1">繼續你的學習旅程</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="題庫總數" value={totalQuestions} icon="📚" />
        <StatCard label="已完成測驗" value={analytics?.completedExams || 0} icon="✅" />
        <StatCard
          label="平均分數"
          value={`${(analytics?.avgScore || 0).toFixed(1)}%`}
          icon="📊"
        />
        <StatCard label="錯題次數" value={wrongCount} icon="❌" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/exam" label="開始練習" desc="模擬測驗" color="bg-indigo-600 hover:bg-indigo-500" />
        <QuickAction href="/questions" label="瀏覽題庫" desc="搜尋題目" color="bg-emerald-600 hover:bg-emerald-500" />
        <QuickAction href="/review" label="查看錯題" desc="重點複習" color="bg-amber-600 hover:bg-amber-500" />
        <QuickAction href="/questions/create" label="AI 解題" desc="智慧分析" color="bg-purple-600 hover:bg-purple-500" />
      </div>

      {/* Recent exams */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">最近測驗</h2>
          <Link href="/exam" className="text-sm text-indigo-400 hover:text-indigo-300">
            查看全部
          </Link>
        </div>
        {analytics?.recentTrend && analytics.recentTrend.length > 0 ? (
          <div className="space-y-3">
            {analytics.recentTrend.map((exam) => (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}/result`}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <div>
                  <p className="font-medium">{exam.title || "測驗"}</p>
                  <p className="text-sm text-slate-400">
                    {exam.finishedAt
                      ? new Date(exam.finishedAt).toLocaleDateString("zh-TW")
                      : "進行中"}
                  </p>
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  (exam.score || 0) >= 70 ? "text-emerald-400" : "text-red-400"
                )}>
                  {exam.score != null ? `${exam.score.toFixed(1)}%` : "--"}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>尚無測驗記錄</p>
            <Link href="/exam" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
              開始第一次測驗
            </Link>
          </div>
        )}
      </div>

      {/* Bank accuracy overview */}
      {analytics?.bankAccuracy && analytics.bankAccuracy.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">各題庫正確率</h2>
          <div className="space-y-3">
            {analytics.bankAccuracy.map((d) => (
              <div key={d.questionBankId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 truncate mr-2">
                    {d.questionBankName}
                  </span>
                  <span className="text-slate-400 flex-shrink-0">{d.accuracy}% ({d.correct}/{d.total})</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
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

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

function QuickAction({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  return (
    <Link
      href={href}
      className={cn("rounded-lg p-4 text-center transition-colors", color)}
    >
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-white/70">{desc}</p>
    </Link>
  );
}
