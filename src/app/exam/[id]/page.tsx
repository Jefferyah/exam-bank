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
  // Per-question note
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState(false);
  const [showNote, setShowNote] = useState(false);
  // Per-question difficulty override
  const [difficulties, setDifficulties] = useState<Record<string, number>>({});
  // Scroll ref
  const questionTopRef = useRef<HTMLDivElement>(null);

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
          const initialElapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
          setElapsed(initialElapsed);
          const existing: Record<string, string> = {};
          const existingFlags = new Set<string>();
          const existingDiff: Record<string, number> = {};
          for (const a of data.answers) {
            if (a.userAnswer) existing[a.questionId] = a.userAnswer;
            if (a.flagged) existingFlags.add(a.questionId);
            existingDiff[a.questionId] = a.question.difficulty;
          }
          setUserAnswers(existing);
          setFlagged(existingFlags);
          setDifficulties(existingDiff);

          // Load user's personal difficulty ratings
          try {
            const diffRes = await fetch("/api/user-difficulty");
            if (diffRes.ok) {
              const diffData = await diffRes.json();
              const userDiff: Record<string, number> = {};
              for (const r of diffData.ratings || []) {
                userDiff[r.questionId] = r.difficulty;
              }
              // User ratings override defaults
              setDifficulties((prev) => ({ ...prev, ...userDiff }));
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) fetchExam();
  }, [params.id, router]);

  // Fetch notes for current question
  const currentAnswer = exam?.answers[currentIndex];
  const currentQuestion = currentAnswer?.question;

  useEffect(() => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    if (notes[qId] !== undefined) return; // already loaded
    fetch(`/api/notes?questionId=${qId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.notes?.[0]?.content) {
          setNotes((prev) => ({ ...prev, [qId]: data.notes[0].content }));
        } else {
          setNotes((prev) => ({ ...prev, [qId]: "" }));
        }
      })
      .catch(() => {});
  }, [currentQuestion, notes]);

  // Timer
  useEffect(() => {
    if (!exam) return;
    timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [exam]);

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

  async function handleSetDifficulty(questionId: string, diff: number) {
    setDifficulties((prev) => ({ ...prev, [questionId]: diff }));
    try {
      await fetch("/api/user-difficulty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, difficulty: diff }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveNote(questionId: string) {
    const content = notes[questionId];
    if (content === undefined) return;
    setSavingNote(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content: content || " " }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    setShowExplanation(false);
    setShowNote(false);
    // Scroll to top of question area
    setTimeout(() => {
      questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
    if (exam?.mode === "MOCK" && exam.timeLimit && elapsed >= exam.timeLimit && !submitting) {
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
      <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-600">
        找不到此測驗
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = exam.answers.length;
  const isMulti = currentQuestion.type === "MULTI";
  const currentDifficulty = difficulties[currentQuestion.id] ?? currentQuestion.difficulty;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900 hidden sm:block">{exam.title}</h1>
          <span className="text-sm text-gray-600">
            {answeredCount}/{totalCount} 已作答
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={cn(
            "font-mono text-lg font-bold",
            remaining !== null && remaining < 300 ? "text-red-500" : "text-gray-900"
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
          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm lg:sticky lg:top-20">
            <p className="text-sm text-gray-600 mb-2">題目導覽</p>
            <div className="grid grid-cols-8 lg:grid-cols-4 gap-1.5">
              {exam.answers.map((a, i) => {
                const answered = !!userAnswers[a.questionId];
                const isFlagged = flagged.has(a.questionId);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={a.id}
                    onClick={() => goToQuestion(i)}
                    className={cn(
                      "w-full aspect-square rounded-lg text-xs font-medium transition-colors relative",
                      isCurrent
                        ? "bg-gray-900 text-white ring-2 ring-gray-400"
                        : answered
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-100"
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
                <span className="w-3 h-3 bg-gray-900 rounded" /> 目前題目
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-50 border border-gray-100 rounded relative">
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                </span> 已標記
              </div>
            </div>
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 space-y-4" ref={questionTopRef}>
          {/* Progress */}
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 bg-gray-900 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">第 {currentIndex + 1} 題 / 共 {totalCount} 題</span>
              <div className="flex items-center gap-2">
                {/* Difficulty stars */}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleSetDifficulty(currentQuestion.id, star)}
                      className={cn(
                        "text-sm transition-colors",
                        star <= currentDifficulty ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
                      )}
                      title={`難度 ${star}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs transition-all",
                    flagged.has(currentQuestion.id)
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-100"
                  )}
                >
                  {flagged.has(currentQuestion.id) ? "★ 已標記" : "☆ 標記"}
                </button>
                <button
                  onClick={() => setShowNote(!showNote)}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs transition-all",
                    showNote
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : notes[currentQuestion.id]
                        ? "bg-blue-50 text-blue-500 border border-blue-100"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-100"
                  )}
                >
                  📝 筆記
                </button>
              </div>
            </div>

            <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-900">{currentQuestion.stem}</p>

            {isMulti && (
              <p className="text-sm text-amber-500 mt-2">（多選題，可選擇多個答案）</p>
            )}
          </div>

          {/* Inline note */}
          {showNote && (
            <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">📝 我的筆記</p>
                <button
                  onClick={() => handleSaveNote(currentQuestion.id)}
                  disabled={savingNote}
                  className="px-3 py-1 text-xs bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full transition-all"
                >
                  {savingNote ? "..." : "儲存"}
                </button>
              </div>
              <textarea
                value={notes[currentQuestion.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                placeholder="輸入筆記..."
                className="w-full min-h-[80px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const selected = isMulti
                ? (userAnswers[currentQuestion.id] || "").split(",").includes(opt.label)
                : userAnswers[currentQuestion.id] === opt.label;

              let optionStyle = "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md";
              if (selected) {
                optionStyle = "border-blue-200 bg-blue-50";
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
                    "w-full text-left p-4 rounded-xl border-2 transition-all",
                    optionStyle
                  )}
                >
                  <span className="font-semibold text-gray-900 mr-3">{opt.label}.</span>
                  <span className="text-gray-700">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Practice mode: show answer button */}
          {isPractice && userAnswers[currentQuestion.id] && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
            >
              {showExplanation ? "隱藏答案" : "查看答案"}
            </button>
          )}

          {/* Explanation (practice mode only) */}
          {showExplanation && isPractice && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <p className="text-sm text-gray-600">
                正確答案：<span className="text-emerald-500 font-bold text-lg">{currentQuestion.answer}</span>
              </p>
              <p className="text-gray-600 whitespace-pre-wrap">{currentQuestion.explanation}</p>
              {currentQuestion.wrongOptionExplanations && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {Object.entries(currentQuestion.wrongOptionExplanations).map(([label, text]) => (
                    <p key={label} className="text-sm text-gray-600">
                      <span className="text-red-500 font-semibold">{label}.</span> {text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation — sticky bottom */}
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 -mx-4 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium transition-colors"
            >
              ← 上一題
            </button>
            <span className="text-sm text-gray-400">{currentIndex + 1} / {totalCount}</span>
            {currentIndex === totalCount - 1 ? (
              <button
                onClick={() => handleFinish()}
                disabled={submitting}
                className={cn(
                  "px-6 py-2.5 rounded-full font-medium transition-all",
                  isPractice
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                )}
              >
                {isPractice ? "結束練習" : "交卷"}
              </button>
            ) : (
              <button
                onClick={() => goToQuestion(Math.min(totalCount - 1, currentIndex + 1))}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
              >
                下一題 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
