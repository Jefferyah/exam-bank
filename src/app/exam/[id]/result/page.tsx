"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn, DIFFICULTY_LABELS } from "@/lib/utils";
import { CheckCircle, XCircle } from "@/components/icons";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { buildAiPrompt, getAiWebUrls } from "@/lib/ai-prompt";

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
      questionBankId: string;
      questionBank?: { id: string; name: string };
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
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrompt() {
      try {
        const res = await fetch("/api/user-settings");
        if (res.ok) {
          const data = await res.json();
          setCustomPrompt(data.aiPromptTemplate || null);
        }
      } catch (err) {
        console.error("Failed to fetch prompt:", err);
      }
    }
    fetchPrompt();
  }, []);

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


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-600">
        找不到此測驗結果
      </div>
    );
  }

  const correctCount = exam.answers.filter((a) => a.isCorrect === true).length;
  const totalCount = exam.answers.length;
  const score = exam.score ?? (totalCount > 0 ? (correctCount / totalCount) * 100 : 0);

  // Build bank name map and stats grouped by questionBankId
  const bankNameMap: Record<string, string> = {};
  const bankStats: Record<string, { total: number; correct: number }> = {};
  for (const a of exam.answers) {
    const bankId = a.question.questionBankId;
    if (!bankNameMap[bankId] && a.question.questionBank?.name) {
      bankNameMap[bankId] = a.question.questionBank.name;
    }
    if (!bankStats[bankId]) bankStats[bankId] = { total: 0, correct: 0 };
    bankStats[bankId].total++;
    if (a.isCorrect) bankStats[bankId].correct++;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Score display */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-8 shadow-sm text-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 mb-2">{exam.title}</h1>
        <div className={cn(
          "text-6xl md:text-8xl font-bold",
          score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500"
        )}>
          {score.toFixed(1)}%
        </div>
        <p className="text-gray-600 mt-2">
          {correctCount} / {totalCount} 答對
        </p>
        {exam.finishedAt && exam.startedAt && (
          <p className="text-sm text-gray-400 mt-1">
            用時 {Math.round((new Date(exam.finishedAt).getTime() - new Date(exam.startedAt).getTime()) / 60000)} 分鐘
          </p>
        )}
      </div>

      {/* Question bank breakdown */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">各題庫表現</h2>
        <div className="space-y-3">
          {Object.entries(bankStats).map(([bankId, stats]) => {
            const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            return (
              <div key={bankId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-900 truncate mr-2">
                    {bankNameMap[bankId] || bankId}
                  </span>
                  <span className="text-gray-600 flex-shrink-0">
                    {stats.correct}/{stats.total} ({accuracy.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
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
          className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium text-center transition-all"
        >
          重新測驗
        </Link>
        <Link
          href="/"
          className="flex-1 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full font-medium text-center transition-all"
        >
          回首頁
        </Link>
      </div>

      {/* Question list */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">題目詳情</h2>
        <div className="space-y-3">
          {exam.answers.map((a, i) => (
            <div key={a.id} className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleExpand(a.id)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0">
                  {a.isCorrect ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                </span>
                <span className="flex-1 text-sm text-gray-900 line-clamp-1">
                  {i + 1}. {a.question.stem}
                </span>
                <CopyQuestionButton
                  stem={a.question.stem}
                  options={a.question.options}
                  answer={a.question.answer}
                  explanation={a.question.explanation}
                />
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {expandedIds.has(a.id) ? "收起" : "展開"}
                </span>
              </button>

              {expandedIds.has(a.id) && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <p className="text-gray-900 whitespace-pre-wrap">{a.question.stem}</p>

                  <div className="space-y-2">
                    {a.question.options.map((opt) => {
                      const isCorrectOpt = a.question.answer.includes(opt.label);
                      const isUserAnswer = a.userAnswer?.includes(opt.label);
                      return (
                        <div
                          key={opt.label}
                          className={cn(
                            "p-2 rounded-xl text-sm",
                            isCorrectOpt
                              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                              : isUserAnswer
                                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                                : "bg-gray-50 dark:bg-gray-700"
                          )}
                        >
                          <span className="font-semibold mr-2 text-gray-900">{opt.label}.</span>
                          <span className="text-gray-700">{opt.text}</span>
                          {isCorrectOpt && <span className="ml-2 text-emerald-600 text-xs">(正確)</span>}
                          {isUserAnswer && !isCorrectOpt && <span className="ml-2 text-red-600 text-xs">(你的答案)</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-sm text-gray-600 mb-1">解析</p>
                    <p className="text-sm text-gray-700">{a.question.explanation}</p>
                  </div>

                  {/* AI solve — open in external AI web */}
                  {(() => {
                    const urls = getAiWebUrls(buildAiPrompt(a.question, customPrompt));
                    return (
                      <div className="flex flex-wrap gap-2">
                        <a href={urls.chatgpt} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#10a37f] hover:bg-[#0d8c6d] text-white rounded-full text-xs font-medium transition-all">
                          🤖 ChatGPT
                        </a>
                        <a href={urls.claude} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#d97706] hover:bg-[#b45309] text-white rounded-full text-xs font-medium transition-all">
                          🧠 Claude
                        </a>
                        <a href={urls.gemini} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#4285f4] hover:bg-[#3367d6] text-white rounded-full text-xs font-medium transition-all">
                          ✨ Gemini
                        </a>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
