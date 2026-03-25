"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";

interface AnalyticsData {
  totalExams: number;
  completedExams: number;
  avgScore: number;
  bankAccuracy: { questionBankId: string; questionBankName: string; total: number; correct: number; accuracy: number }[];
  difficultyDistribution: { difficulty: number; total: number; correct: number; accuracy: number }[];
  recentTrend: { id: string; title: string; score: number | null; finishedAt: string }[];
  mostWrongQuestions: { questionId: string; stem: string; wrongCount: number }[];
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">
        <p>請先登入以查看學習分析</p>
        <Link href="/login" className="text-blue-500 hover:text-blue-600 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500">
        <p>無法載入分析資料</p>
      </div>
    );
  }

  const totalAnswered = data.bankAccuracy.reduce((sum, d) => sum + d.total, 0);
  const totalCorrect = data.bankAccuracy.reduce((sum, d) => sum + d.correct, 0);
  const overallAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">學習分析</h1>
        <Link
          href="/analytics/domain"
          className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-full text-sm font-medium transition-colors"
        >
          題庫詳細分析
        </Link>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-3xl font-bold text-blue-500">{overallAccuracy.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">整體正確率</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-3xl font-bold text-gray-900">{data.completedExams}</p>
          <p className="text-sm text-gray-500">已完成測驗</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-3xl font-bold text-gray-900">{totalAnswered}</p>
          <p className="text-sm text-gray-500">已答題數</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-3xl font-bold text-emerald-500">{data.avgScore.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">平均分數</p>
        </div>
      </div>

      {/* Score trend (bar chart) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">分數趨勢（最近測驗）</h2>
        {data.recentTrend.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無測驗記錄</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-1 h-48">
              {data.recentTrend.slice().reverse().map((exam) => {
                const score = exam.score || 0;
                return (
                  <div
                    key={exam.id}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                  >
                    <span className="text-xs text-gray-500">{score.toFixed(0)}%</span>
                    <div
                      className={cn(
                        "w-full rounded-t transition-all min-h-[4px]",
                        score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ height: `${Math.max(score * 1.6, 4)}px` }}
                    />
                    <span className="text-[10px] text-gray-400 truncate w-full text-center">
                      {exam.finishedAt ? new Date(exam.finishedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Reference line at 70% */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex-1 border-t border-dashed border-gray-300" />
              <span>70% 及格線</span>
              <div className="flex-1 border-t border-dashed border-gray-300" />
            </div>
          </div>
        )}
      </div>

      {/* Bank accuracy bar chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">各題庫正確率</h2>
        {data.bankAccuracy.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無作答記錄</p>
        ) : (
          <div className="space-y-3">
            {data.bankAccuracy
              .sort((a, b) => b.accuracy - a.accuracy)
              .map((d) => (
                <div key={d.questionBankId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-900 truncate mr-2">
                      {d.questionBankName}
                    </span>
                    <span className="text-gray-500 flex-shrink-0">
                      {d.accuracy}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={cn(
                        "h-3 rounded-full transition-all",
                        d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${d.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Difficulty distribution (circular SVGs) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">難度分佈</h2>
        {data.difficultyDistribution.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無作答記錄</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {data.difficultyDistribution.map((d) => {
              const totalAll = data.difficultyDistribution.reduce((s, x) => s + x.total, 0);
              const percentage = totalAll > 0 ? (d.total / totalAll) * 100 : 0;
              return (
                <div key={d.difficulty} className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-gray-100"
                      />
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${d.accuracy * 0.88} 88`}
                        className={cn(
                          d.accuracy >= 70 ? "text-emerald-500" : d.accuracy >= 50 ? "text-amber-500" : "text-red-500"
                        )}
                      />
                    </svg>
                    <span className="text-sm font-bold z-10 text-gray-900">{d.accuracy.toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-amber-500 mt-2">{"★".repeat(d.difficulty)}</p>
                  <p className="text-xs text-gray-500">{d.total} 題 ({percentage.toFixed(0)}%)</p>
                  <p className="text-xs text-gray-400">{DIFFICULTY_LABELS[d.difficulty]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
