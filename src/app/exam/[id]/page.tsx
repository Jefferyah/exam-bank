"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface ExamAnswer {
  id: string;
  questionId: string;
  order: number;
  userAnswer: string | null;
  isCorrect: boolean | null;
  flagged: boolean;
  timeSpent: number | null;
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
}

interface Exam {
  id: string;
  title: string;
  mode: string;
  status: string;
  timeLimit: number | null;
  startedAt: string;
  config: Record<string, unknown>;
  answers: ExamAnswer[];
}

export default function ExamTakingPage() {
  const params = useParams();
  const router = useRouter();
  useSession();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showExplanation, setShowExplanation] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchExam() {
      try {
        const res = await fetch(`/api/exams/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "COMPLETED") {
            router.replace(`/exam/${params.id}/result`);
            return;
          }
          setExam(data);
          const startedAt = new Date(data.startedAt).getTime();
          const initialElapsed = Math.max(
            0,
            Math.floor((Date.now() - startedAt) / 1000)
          );
          setElapsed(initialElapsed);
          // Restore any existing answers
          const existing: Record<string, string> = {};
          const existingFlags = new Set<string>();
          for (const a of data.answers) {
            if (a.userAnswer) existing[a.questionId] = a.userAnswer;
            if (a.flagged) existingFlags.add(a.questionId);
          }
          setUserAnswers(existing);
          setFlagged(existingFlags);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) fetchExam();
  }, [params.id, router]);

  // Timer
  useEffect(() => {
    if (!exam) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [exam]);

  // Auto-submit if time's up (mock mode)
  const currentAnswer = exam?.answers[currentIndex];
  const currentQuestion = currentAnswer?.question;
  const isPractice = exam?.mode === "PRACTICE";
  const remaining = exam?.timeLimit ? exam.timeLimit - elapsed : null;

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function selectAnswer(questionId: string, value: string, isMulti: boolean) {
    setUserAnswers((prev) => {
      if (isMulti) {
        const current = prev[questionId] || "";
        const labels = current.split(",").filter(Boolean);
        if (labels.includes(value)) {
          return { ...prev, [questionId]: labels.filter((l) => l !== value).sort().join(",") };
        } else {
          return { ...prev, [questionId]: [...labels, value].sort().join(",") };
        }
      }
      return { ...prev, [questionId]: value };
    });
    setShowExplanation(false);
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  const saveAnswers = useCallback(async () => {
    if (!exam) return;
    const answers = Object.entries(userAnswers).map(([questionId, userAnswer]) => ({
      questionId,
      userAnswer,
      flagged: flagged.has(questionId),
    }));
    try {
      await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
    } catch (err) {
      console.error(err);
    }
  }, [exam, userAnswers, flagged]);

  // Auto-save periodically
  useEffect(() => {
    if (!exam) return;
    const interval = setInterval(saveAnswers, 30000);
    return () => clearInterval(interval);
  }, [exam, saveAnswers]);

  const handleFinish = useCallback(async (force = false) => {
    if (!exam) return;
    if (submitting) return;
    if (!force && !isPractice && !confirm("確定要交卷嗎？交卷後無法修改答案。")) return;

    setSubmitting(true);
    try {
      const answers = Object.entries(userAnswers).map(([questionId, userAnswer]) => ({
        questionId,
        userAnswer,
        flagged: flagged.has(questionId),
      }));

      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, finish: true }),
      });

      if (res.ok) {
        router.push(`/exam/${exam.id}/result`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [exam, flagged, isPractice, router, submitting, userAnswers]);

  useEffect(() => {
    if (
      exam?.mode === "MOCK" &&
      exam.timeLimit &&
      elapsed >= exam.timeLimit &&
      !submitting
    ) {
      handleFinish(true);
    }
  }, [elapsed, exam, handleFinish, submitting]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-48 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-500">
        找不到此測驗
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = exam.answers.length;
  const isMulti = currentQuestion.type === "MULTI";

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 glass-card rounded-2xl p-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">{exam.title}</h1>
          <span className="text-sm text-gray-500">
            {answeredCount}/{totalCount} 已作答
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={cn(
            "font-mono text-lg font-bold",
            remaining !== null && remaining < 300 ? "text-red-500" : "text-emerald-600"
          )}>
            {remaining !== null ? formatTime(Math.max(0, remaining)) : formatTime(elapsed)}
          </span>
          {isPractice ? (
            <button
              onClick={() => handleFinish()}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-medium transition-colors"
            >
              結束練習
            </button>
          ) : (
            <button
              onClick={() => handleFinish()}
              disabled={submitting}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors"
            >
              {submitting ? "交卷中..." : "交卷"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Question navigation sidebar */}
        <div className="lg:w-48 flex-shrink-0">
          <div className="glass-card rounded-2xl p-3">
            <p className="text-sm text-gray-500 mb-2">題目導覽</p>
            <div className="grid grid-cols-8 lg:grid-cols-4 gap-1.5">
              {exam.answers.map((a, i) => {
                const answered = !!userAnswers[a.questionId];
                const isFlagged = flagged.has(a.questionId);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={a.id}
                    onClick={() => { setCurrentIndex(i); setShowExplanation(false); }}
                    className={cn(
                      "w-full aspect-square rounded-lg text-xs font-medium transition-colors relative",
                      isCurrent
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                        : answered
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                    )}
                  >
                    {i + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-100 rounded border border-emerald-200" /> 已作答
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-600 rounded" /> 目前題目
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-50 border border-gray-200 rounded relative">
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                </span> 已標記
              </div>
            </div>
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 space-y-4">
          {/* Progress */}
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 bg-emerald-500 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">第 {currentIndex + 1} 題 / 共 {totalCount} 題</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs transition-colors",
                    flagged.has(currentQuestion.id)
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  {flagged.has(currentQuestion.id) ? "★ 已標記" : "☆ 標記"}
                </button>
              </div>
            </div>

            <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-900">{currentQuestion.stem}</p>

            {isMulti && (
              <p className="text-sm text-amber-500 mt-2">（多選題，可選擇多個答案）</p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const selected = isMulti
                ? (userAnswers[currentQuestion.id] || "").split(",").includes(opt.label)
                : userAnswers[currentQuestion.id] === opt.label;

              let optionStyle = "border-gray-200 bg-white hover:border-gray-300";
              if (selected) {
                optionStyle = "border-emerald-500 bg-emerald-50";
              }
              if (showExplanation && isPractice) {
                const isCorrect = currentQuestion.answer.includes(opt.label);
                if (isCorrect) {
                  optionStyle = "border-emerald-400 bg-emerald-50";
                } else if (selected && !isCorrect) {
                  optionStyle = "border-red-400 bg-red-50";
                }
              }

              return (
                <button
                  key={opt.label}
                  onClick={() => selectAnswer(currentQuestion.id, opt.label, isMulti)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-colors",
                    optionStyle
                  )}
                >
                  <span className="font-semibold text-emerald-600 mr-3">{opt.label}.</span>
                  <span className="text-gray-700">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Practice mode: show answer button */}
          {isPractice && userAnswers[currentQuestion.id] && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full py-3 btn-nature rounded-full font-medium transition-colors"
            >
              {showExplanation ? "隱藏答案" : "查看答案"}
            </button>
          )}

          {/* Explanation (practice mode only) */}
          {showExplanation && isPractice && (
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <p className="text-sm text-gray-500">
                正確答案：<span className="text-emerald-500 font-bold text-lg">{currentQuestion.answer}</span>
              </p>
              <p className="text-gray-500 whitespace-pre-wrap">{currentQuestion.explanation}</p>
              {currentQuestion.wrongOptionExplanations && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  {Object.entries(currentQuestion.wrongOptionExplanations).map(([label, text]) => (
                    <p key={label} className="text-sm text-gray-500">
                      <span className="text-red-500 font-semibold">{label}.</span> {text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setShowExplanation(false); }}
              disabled={currentIndex === 0}
              className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium transition-colors"
            >
              上一題
            </button>
            <span className="text-sm text-gray-400">{currentIndex + 1} / {totalCount}</span>
            <button
              onClick={() => { setCurrentIndex((i) => Math.min(totalCount - 1, i + 1)); setShowExplanation(false); }}
              disabled={currentIndex === totalCount - 1}
              className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium transition-colors"
            >
              下一題
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
