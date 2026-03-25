"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DOMAINS, DIFFICULTY_LABELS, cn, DomainKey } from "@/lib/utils";

interface ExamResult {
  id: string;
  title: string;
  mode: string;
  score: number | null;
  startedAt: string;
  finishedAt: string | null;
  answers: {
    id: string;
    questionId: string;
    order: number;
    userAnswer: string | null;
    isCorrect: boolean | null;
    question: {
      id: string;
      stem: string;
      type: string;
      options: { label: string; text: string }[];
      answer: string;
      explanation: string;
      domain: string;
      difficulty: number;
      wrongOptionExplanations: Record<string, string> | null;
    };
  }[];
}

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const [exam, setExam] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, Record<string, { success: boolean; data?: { answer: string; reasoning: string }; error?: string }>>>({});

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/exams/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setExam(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) fetchResult();
  }, [params.id]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAiSolve(questionId: string) {
    setAiLoadingId(questionId);
    try {
      const res = await fetch("/api/ai-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResults((prev) => ({ ...prev, [questionId]: data.results }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-800 rounded-lg" />
          <div className="h-64 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-slate-400">
        找不到此測驗結果
      </div>
    );
  }

  const correctCount = exam.answers.filter((a) => a.isCorrect === true).length;
  const totalCount = exam.answers.length;
  const score = exam.score ?? (totalCount > 0 ? (correctCount / totalCount) * 100 : 0);

  // Domain breakdown
  const domainStats: Record<string, { total: number; correct: number }> = {};
  for (const a of exam.answers) {
    const d = a.question.domain;
    if (!domainStats[d]) domainStats[d] = { total: 0, correct: 0 };
    domainStats[d].total++;
    if (a.isCorrect) domainStats[d].correct++;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Score display */}
      <div className="bg-slate-800 rounded-lg p-8 text-center">
        <h1 className="text-xl text-slate-400 mb-2">{exam.title}</h1>
        <div className={cn(
          "text-6xl md:text-8xl font-bold",
          score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"
        )}>
          {score.toFixed(1)}%
        </div>
        <p className="text-slate-400 mt-2">
          {correctCount} / {totalCount} 答對
        </p>
        {exam.finishedAt && exam.startedAt && (
          <p className="text-sm text-slate-500 mt-1">
            用時 {Math.round((new Date(exam.finishedAt).getTime() - new Date(exam.startedAt).getTime()) / 60000)} 分鐘
          </p>
        )}
      </div>

      {/* Domain breakdown */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">各 Domain 表現</h2>
        <div className="space-y-3">
          {Object.entries(domainStats).map(([domain, stats]) => {
            const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            return (
              <div key={domain}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 truncate mr-2">
                    {DOMAINS[domain as DomainKey] || domain}
                  </span>
                  <span className="text-slate-400 flex-shrink-0">
                    {stats.correct}/{stats.total} ({accuracy.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className={cn(
                      "h-3 rounded-full transition-all",
                      accuracy >= 70 ? "bg-emerald-500" : accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/exam"
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-center transition-colors"
        >
          重新測驗
        </Link>
        <Link
          href="/"
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-center transition-colors"
        >
          回首頁
        </Link>
      </div>

      {/* Question list */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">題目詳情</h2>
        <div className="space-y-3">
          {exam.answers.map((a, i) => (
            <div key={a.id} className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpand(a.id)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-700/50 transition-colors"
              >
                <span className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0",
                  a.isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                )}>
                  {a.isCorrect ? "O" : "X"}
                </span>
                <span className="flex-1 text-sm line-clamp-1">
                  {i + 1}. {a.question.stem}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {expandedIds.has(a.id) ? "收起" : "展開"}
                </span>
              </button>

              {expandedIds.has(a.id) && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
                  <p className="text-slate-200 whitespace-pre-wrap">{a.question.stem}</p>

                  <div className="space-y-2">
                    {a.question.options.map((opt) => {
                      const isCorrectOpt = a.question.answer.includes(opt.label);
                      const isUserAnswer = a.userAnswer?.includes(opt.label);
                      return (
                        <div
                          key={opt.label}
                          className={cn(
                            "p-2 rounded text-sm",
                            isCorrectOpt
                              ? "bg-emerald-500/10 border border-emerald-500/30"
                              : isUserAnswer
                                ? "bg-red-500/10 border border-red-500/30"
                                : "bg-slate-700/30"
                          )}
                        >
                          <span className="font-semibold mr-2">{opt.label}.</span>
                          {opt.text}
                          {isCorrectOpt && <span className="ml-2 text-emerald-400 text-xs">(正確)</span>}
                          {isUserAnswer && !isCorrectOpt && <span className="ml-2 text-red-400 text-xs">(你的答案)</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-700/30 rounded p-3">
                    <p className="text-sm text-slate-400 mb-1">解析</p>
                    <p className="text-sm text-slate-300">{a.question.explanation}</p>
                  </div>

                  {/* AI solve per question */}
                  <button
                    onClick={() => handleAiSolve(a.questionId)}
                    disabled={aiLoadingId === a.questionId}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 rounded text-xs font-medium transition-colors"
                  >
                    {aiLoadingId === a.questionId ? "分析中..." : "AI 解題"}
                  </button>

                  {aiResults[a.questionId] && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {(["claude", "openai", "gemini"] as const).map((model) => {
                        const r = aiResults[a.questionId]?.[model];
                        if (!r) return null;
                        return (
                          <div key={model} className="bg-slate-700/50 rounded p-3 text-xs">
                            <p className="font-semibold text-indigo-300 capitalize mb-1">{model}</p>
                            {r.success && r.data ? (
                              <p className="text-slate-300">{r.data.answer}: {r.data.reasoning?.slice(0, 100)}...</p>
                            ) : (
                              <p className="text-red-400">{r.error}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
