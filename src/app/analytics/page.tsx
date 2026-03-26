"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn, formatDuration } from "@/lib/utils";
import { DifficultyStars } from "@/components/icons";

interface AnalyticsData {
  totalExams: number;
  completedExams: number;
  avgScore: number;
  bankAccuracy: { questionBankId: string; questionBankName: string; total: number; correct: number; accuracy: number }[];
  difficultyDistribution: { difficulty: number; total: number; correct: number; accuracy: number }[];
  recentTrend: { id: string; title: string; score: number | null; finishedAt: string }[];
  mostWrongQuestions: { questionId: string; stem: string; wrongCount: number; questionBankName: string; difficulty: number }[];
  timeAnalysis: {
    avgTimePerQuestion: number;
    timePerDifficulty: { difficulty: number; avgTime: number; count: number }[];
    timePerBank: { questionBankId: string; questionBankName: string; avgTime: number; avgCorrectTime: number; avgWrongTime: number; count: number }[];
  };
  modeComparison: { mode: string; count: number; avgScore: number; avgDuration: number }[];
  dailyActivity: { date: string; exams: number; questions: number }[];
  currentStreak: number;
}

const MODE_LABELS: Record<string, string> = {
  PRACTICE: "練習模式",
  MOCK: "模擬考",
};

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
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入以查看學習分析</p>
        <Link href="/login" className="text-gray-900 hover:text-gray-800 mt-2 inline-block font-medium">登入</Link>
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
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>無法載入分析資料</p>
      </div>
    );
  }

  const totalAnswered = data.bankAccuracy.reduce((sum, d) => sum + d.total, 0);
  const totalCorrect = data.bankAccuracy.reduce((sum, d) => sum + d.correct, 0);
  const overallAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

  // Daily activity helpers
  const maxQuestions = Math.max(...data.dailyActivity.map((d) => d.questions), 1);

  function getHeatColor(questions: number): string {
    if (questions === 0) return "bg-gray-100";
    const ratio = questions / maxQuestions;
    if (ratio > 0.75) return "bg-emerald-500";
    if (ratio > 0.5) return "bg-emerald-400";
    if (ratio > 0.25) return "bg-emerald-300";
    return "bg-emerald-200";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">學習分析</h1>
        <Link
          href="/analytics/domain"
          className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-full text-sm font-medium transition-colors"
        >
          題庫詳細分析
        </Link>
      </div>

      {/* ── Overall stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{overallAccuracy.toFixed(1)}%</p>
          <p className="text-sm text-gray-600">整體正確率</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{data.completedExams}</p>
          <p className="text-sm text-gray-600">已完成測驗</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{totalAnswered}</p>
          <p className="text-sm text-gray-600">已答題數</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-emerald-500">{data.avgScore.toFixed(1)}%</p>
          <p className="text-sm text-gray-600">平均分數</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-3xl font-bold text-blue-500">{data.currentStreak}</p>
          <p className="text-sm text-gray-600">連續學習天數</p>
        </div>
      </div>

      {/* ── Daily activity heatmap ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">學習活躍度（近 30 天）</h2>
        {data.dailyActivity.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無紀錄</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {data.dailyActivity.map((d) => {
                const date = new Date(d.date + "T00:00:00");
                const label = `${date.getMonth() + 1}/${date.getDate()}`;
                return (
                  <div key={d.date} className="group relative flex flex-col items-center">
                    <div
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-md transition-all",
                        getHeatColor(d.questions)
                      )}
                    />
                    <span className="text-[9px] text-gray-400 mt-0.5 hidden sm:block">{label}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p>{d.exams} 場測驗 · {d.questions} 題</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>少</span>
              <div className="w-4 h-4 rounded bg-gray-100" />
              <div className="w-4 h-4 rounded bg-emerald-200" />
              <div className="w-4 h-4 rounded bg-emerald-300" />
              <div className="w-4 h-4 rounded bg-emerald-400" />
              <div className="w-4 h-4 rounded bg-emerald-500" />
              <span>多</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Score trend (bar chart) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
                    <span className="text-xs text-gray-600">{score.toFixed(0)}%</span>
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

      {/* ── Mode comparison ── */}
      {data.modeComparison.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">練習 vs 模擬考</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.modeComparison.map((m) => {
              const isPractice = m.mode === "PRACTICE";
              return (
                <div
                  key={m.mode}
                  className={cn(
                    "rounded-2xl p-5 border",
                    isPractice
                      ? "bg-blue-50 border-blue-200"
                      : "bg-purple-50 border-purple-200"
                  )}
                >
                  <p className={cn(
                    "text-sm font-medium mb-3",
                    isPractice ? "text-blue-700" : "text-purple-700"
                  )}>
                    {MODE_LABELS[m.mode] || m.mode}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">完成次數</span>
                      <span className="text-sm font-semibold text-gray-900">{m.count} 場</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">平均分數</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        m.avgScore >= 70 ? "text-emerald-500" : m.avgScore >= 50 ? "text-amber-500" : "text-red-500"
                      )}>
                        {m.avgScore.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">平均耗時</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {m.avgDuration > 0 ? formatDuration(m.avgDuration) : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Time analysis ── */}
      {data.timeAnalysis.avgTimePerQuestion > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">答題速度分析</h2>
          <p className="text-sm text-gray-500 mb-4">
            模擬考模式，每題平均 <span className="font-semibold text-gray-900">{formatDuration(data.timeAnalysis.avgTimePerQuestion)}</span>
          </p>

          {/* Time per difficulty */}
          {data.timeAnalysis.timePerDifficulty.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">各難度平均耗時</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {data.timeAnalysis.timePerDifficulty.map((d) => {
                  const maxTime = Math.max(...data.timeAnalysis.timePerDifficulty.map((x) => x.avgTime), 1);
                  const ratio = d.avgTime / maxTime;
                  return (
                    <div key={d.difficulty} className="text-center">
                      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center relative">
                        <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100" />
                          <circle
                            cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                            strokeDasharray={`${ratio * 88} 88`}
                            className="text-blue-500"
                          />
                        </svg>
                        <span className="text-xs font-bold z-10 text-gray-900">{formatDuration(d.avgTime)}</span>
                      </div>
                      <div className="flex justify-center mt-1"><DifficultyStars value={d.difficulty} /></div>
                      <p className="text-xs text-gray-400">{d.count} 題</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time per bank: correct vs wrong */}
          {data.timeAnalysis.timePerBank.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">各題庫答題速度（答對 vs 答錯）</h3>
              <div className="space-y-3">
                {data.timeAnalysis.timePerBank
                  .sort((a, b) => b.avgTime - a.avgTime)
                  .map((b) => {
                    const maxBarTime = Math.max(
                      ...data.timeAnalysis.timePerBank.map((x) => Math.max(x.avgCorrectTime, x.avgWrongTime)),
                      1
                    );
                    return (
                      <div key={b.questionBankId}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-900 truncate mr-2">{b.questionBankName}</span>
                          <span className="text-gray-500 flex-shrink-0 text-xs">
                            平均 {formatDuration(b.avgTime)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {b.avgCorrectTime > 0 && (
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                  className="h-2.5 rounded-full bg-emerald-400 transition-all"
                                  style={{ width: `${(b.avgCorrectTime / maxBarTime) * 100}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-emerald-600 mt-0.5">答對 {formatDuration(b.avgCorrectTime)}</p>
                            </div>
                          )}
                          {b.avgWrongTime > 0 && (
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                  className="h-2.5 rounded-full bg-red-400 transition-all"
                                  style={{ width: `${(b.avgWrongTime / maxBarTime) * 100}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-red-600 mt-0.5">答錯 {formatDuration(b.avgWrongTime)}</p>
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

      {/* ── Bank accuracy bar chart ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
                    <span className="text-gray-600 flex-shrink-0">
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

      {/* ── Difficulty distribution (circular SVGs) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
                  <div className="flex justify-center mt-2"><DifficultyStars value={d.difficulty} /></div>
                  <p className="text-xs text-gray-600">{d.total} 題 ({percentage.toFixed(0)}%)</p>
                  <p className="text-xs text-gray-400">{DIFFICULTY_LABELS[d.difficulty]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Most wrong questions ── */}
      {data.mostWrongQuestions.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">錯題排行榜</h2>
          <div className="space-y-3">
            {data.mostWrongQuestions.map((q, i) => (
              <div
                key={q.questionId}
                className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl"
              >
                <span className={cn(
                  "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                  i === 0 ? "bg-red-500 text-white" :
                  i === 1 ? "bg-red-400 text-white" :
                  i === 2 ? "bg-red-300 text-white" :
                  "bg-gray-200 text-gray-600"
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 line-clamp-2">{q.stem}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-500">{q.questionBankName}</span>
                    <span className="text-xs text-gray-300">|</span>
                    <DifficultyStars value={q.difficulty} />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-red-500">{q.wrongCount}</p>
                  <p className="text-[10px] text-gray-400">次答錯</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
