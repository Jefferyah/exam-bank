"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { DifficultyStarsClickable, FlagFilled, FlagEmpty, NoteIcon, ArrowLeft, ArrowRight } from "@/components/icons";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { TagEditor } from "@/components/tag-editor";
import { buildAiPrompt, getAiWebUrls } from "@/lib/ai-prompt";

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
    tags?: string[];
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
  const [answerFeedback, setAnswerFeedback] = useState<"correct" | "wrong" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Per-question note
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState(false);
  const [showNote, setShowNote] = useState(false);
  // Per-question difficulty override
  const [difficulties, setDifficulties] = useState<Record<string, number>>({});
  // Custom AI prompt
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  // Per-question time tracking
  const [timeSpents, setTimeSpents] = useState<Record<string, number>>({});
  const questionStartRef = useRef<number>(Date.now());
  // Scroll refs
  const questionTopRef = useRef<HTMLDivElement>(null);
  const checkAnswerRef = useRef<HTMLButtonElement>(null);

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
          const existingTime: Record<string, number> = {};
          for (const a of data.answers) {
            if (a.userAnswer) existing[a.questionId] = a.userAnswer;
            if (a.flagged) existingFlags.add(a.questionId);
            existingDiff[a.questionId] = a.question.difficulty;
            if (a.timeSpent != null) existingTime[a.questionId] = a.timeSpent;
          }
          setUserAnswers(existing);
          setFlagged(existingFlags);
          setDifficulties(existingDiff);
          setTimeSpents(existingTime);
          questionStartRef.current = Date.now();

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

  // Fetch user's custom AI prompt
  useEffect(() => {
    fetch("/api/user-settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.aiPromptTemplate) setCustomPrompt(data.aiPromptTemplate); })
      .catch(() => {});
  }, []);

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

  // Save a single answer to the server immediately and notify goal tracker
  const saveOneAnswer = useCallback(async (questionId: string, userAnswer: string) => {
    if (!exam) return;
    try {
      await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: [{ questionId, userAnswer }],
        }),
      });
      // Notify daily-goal-tracker that a question was answered
      window.dispatchEvent(new CustomEvent("question-answered"));
    } catch {
      // silently ignore — periodic save will catch up
    }
  }, [exam]);

  function selectAnswer(questionId: string, value: string, isMulti: boolean) {
    let newAnswer: string;
    setUserAnswers((prev) => {
      if (isMulti) {
        const current = prev[questionId] || "";
        const labels = current.split(",").filter(Boolean);
        if (labels.includes(value)) {
          newAnswer = labels.filter((l) => l !== value).sort().join(",");
        } else {
          newAnswer = [...labels, value].sort().join(",");
        }
        return { ...prev, [questionId]: newAnswer };
      }
      newAnswer = value;
      return { ...prev, [questionId]: value };
    });
    setShowExplanation(false);
    // Save this answer to server immediately (fire-and-forget)
    // Use setTimeout to ensure newAnswer is set after setState
    setTimeout(() => {
      if (newAnswer) saveOneAnswer(questionId, newAnswer);
    }, 0);
    // Auto-scroll to "查看答案" button after selecting (single choice)
    if (!isMulti) {
      setTimeout(() => {
        checkAnswerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
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
    // Accumulate time spent on current question before switching
    if (exam) {
      const currentQId = exam.answers[currentIndex]?.questionId;
      if (currentQId) {
        const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
        setTimeSpents((prev) => ({ ...prev, [currentQId]: (prev[currentQId] || 0) + spent }));
      }
    }
    questionStartRef.current = Date.now();
    setCurrentIndex(index);
    setShowExplanation(false);
    setShowNote(false);
    // Scroll to top of question area
    setTimeout(() => {
      questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  // Get timeSpents with current question's live time included
  const getLatestTimeSpents = useCallback(() => {
    if (!exam) return timeSpents;
    const currentQId = exam.answers[currentIndex]?.questionId;
    if (!currentQId) return timeSpents;
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
    return { ...timeSpents, [currentQId]: (timeSpents[currentQId] || 0) + spent };
  }, [exam, currentIndex, timeSpents]);

  const saveAnswers = useCallback(async () => {
    if (!exam) return;
    const latestTime = getLatestTimeSpents();
    const answers = Object.entries(userAnswers).map(([questionId, userAnswer]) => ({
      questionId,
      userAnswer,
      flagged: flagged.has(questionId),
      timeSpent: latestTime[questionId] || 0,
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
  }, [exam, userAnswers, flagged, getLatestTimeSpents]);

  useEffect(() => {
    if (!exam) return;
    const interval = setInterval(saveAnswers, 30000);
    return () => clearInterval(interval);
  }, [exam, saveAnswers]);

  // Save on page leave (visibilitychange is more reliable than beforeunload)
  useEffect(() => {
    if (!exam) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveAnswers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [exam, saveAnswers]);

  const handleFinish = useCallback(async (force = false) => {
    if (!exam) return;
    if (submitting) return;
    if (!force && !isPractice && !confirm("確定要交卷嗎？交卷後無法修改答案。")) return;

    setSubmitting(true);
    try {
      const latestTime = getLatestTimeSpents();
      const answers = Object.entries(userAnswers).map(([questionId, userAnswer]) => ({
        questionId,
        userAnswer,
        flagged: flagged.has(questionId),
        timeSpent: latestTime[questionId] || 0,
      }));

      // Also include unanswered questions' timeSpent (without overwriting userAnswer)
      if (exam.answers) {
        for (const a of exam.answers) {
          if (!userAnswers[a.questionId] && latestTime[a.questionId]) {
            answers.push({
              questionId: a.questionId,
              userAnswer: null as unknown as string,
              flagged: flagged.has(a.questionId),
              timeSpent: latestTime[a.questionId],
            });
          }
        }
      }

      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, finish: true }),
      });

      if (res.ok) {
        // Notify global daily-goal-tracker that an exam was finished
        window.dispatchEvent(new CustomEvent("exam-finished"));
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
          <div className="h-10 w-48 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
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
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900 hidden sm:block truncate max-w-xs lg:max-w-md">{exam.title}</h1>
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
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm lg:sticky lg:top-20">
            <p className="text-sm text-gray-600 mb-2 hidden lg:block">題目導覽</p>
            <div className="grid grid-cols-10 sm:grid-cols-8 lg:grid-cols-4 gap-1.5">
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
            <div className="mt-3 space-y-1 text-xs text-gray-400 hidden lg:block">
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

        {/* Answer feedback animation */}
        {answerFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Dim backdrop */}
            <div className="absolute inset-0 bg-black/20 animate-[fadeIn_0.15s_ease-out]" />
            {/* Card */}
            <div className={cn(
              "relative rounded-3xl px-6 py-6 sm:px-10 sm:py-8 backdrop-blur-xl shadow-2xl animate-[bounceIn_0.5s_ease-out]",
              answerFeedback === "correct"
                ? "bg-white/90 border border-emerald-200"
                : "bg-white/90 border border-red-200"
            )}>
              {answerFeedback === "correct" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">答對了！</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  </div>
                  <span className="text-lg font-bold text-red-600">再想想！</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main question area */}
        <div className="flex-1 space-y-4" ref={questionTopRef}>
          {/* Progress */}
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 bg-gray-900 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">第 {currentIndex + 1} 題 / 共 {totalCount} 題</span>
                <DifficultyStarsClickable value={currentDifficulty} onChange={(d) => handleSetDifficulty(currentQuestion.id, d)} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <CopyQuestionButton
                  stem={currentQuestion.stem}
                  options={currentQuestion.options}
                  answer={currentQuestion.answer}
                  explanation={currentQuestion.explanation}
                />
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all",
                    flagged.has(currentQuestion.id)
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  {flagged.has(currentQuestion.id) ? <><FlagFilled className="w-3 h-3" /> 已標記</> : <><FlagEmpty className="w-3 h-3" /> 標記</>}
                </button>
                <button
                  onClick={() => setShowNote(!showNote)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all",
                    showNote
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : notes[currentQuestion.id]
                        ? "bg-blue-50 text-blue-500 border border-blue-100"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  <NoteIcon className="w-3 h-3" /> 筆記
                </button>
              </div>
              {/* Inline tag editor */}
              <TagEditor questionId={currentQuestion.id} initialTags={currentQuestion.tags || []} compact />
            </div>

            <p className="text-lg leading-relaxed whitespace-pre-wrap break-words overflow-hidden text-gray-900">{currentQuestion.stem}</p>

            {isMulti && (
              <p className="text-sm text-amber-500 mt-2">（多選題，可選擇多個答案）</p>
            )}
          </div>

          {/* Inline note */}
          {showNote && (
            <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><NoteIcon className="w-3.5 h-3.5" /> 我的筆記</p>
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
                className="w-full min-h-[80px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const selected = isMulti
                ? (userAnswers[currentQuestion.id] || "").split(",").includes(opt.label)
                : userAnswers[currentQuestion.id] === opt.label;

              let optionStyle = "border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-500 hover:shadow-md";
              if (selected) {
                optionStyle = "border-blue-200 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30";
              }
              if (showExplanation && isPractice) {
                const isCorrect = currentQuestion.answer.includes(opt.label);
                if (isCorrect) {
                  optionStyle = "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30";
                } else if (selected && !isCorrect) {
                  optionStyle = "border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30";
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
                  <span className="font-semibold text-gray-900 mr-3 flex-shrink-0">{opt.label}.</span>
                  <span className="text-gray-700 break-words">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Practice mode: show answer button */}
          {isPractice && userAnswers[currentQuestion.id] && (
            <button
              ref={checkAnswerRef}
              onClick={() => {
                const next = !showExplanation;
                setShowExplanation(next);
                if (next) {
                  const userAns = userAnswers[currentQuestion.id] || "";
                  const correctAns = currentQuestion.answer;
                  const isRight = userAns === correctAns || (correctAns.includes(",") && userAns.split(",").sort().join(",") === correctAns.split(",").sort().join(","));
                  setAnswerFeedback(isRight ? "correct" : "wrong");
                  setTimeout(() => setAnswerFeedback(null), 1200);
                } else {
                  setAnswerFeedback(null);
                }
              }}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
            >
              {showExplanation ? "隱藏答案" : "查看答案"}
            </button>
          )}

          {/* Explanation (practice mode only) */}
          {showExplanation && isPractice && (
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-3">
              <p className="text-sm text-gray-600">
                正確答案：<span className="text-emerald-500 font-bold text-lg">{currentQuestion.answer}</span>
              </p>
              <p className="text-gray-600 whitespace-pre-wrap break-words overflow-hidden">{currentQuestion.explanation}</p>
              {currentQuestion.wrongOptionExplanations && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {Object.entries(currentQuestion.wrongOptionExplanations).map(([label, text]) => (
                    <p key={label} className="text-sm text-gray-600">
                      <span className="text-red-500 font-semibold">{label}.</span> {text}
                    </p>
                  ))}
                </div>
              )}

              {/* AI solve buttons (practice mode only) */}
              {(() => {
                const urls = getAiWebUrls(buildAiPrompt(currentQuestion, customPrompt));
                return (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400 w-full mb-1">AI 解題</span>
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

          {/* Navigation — sticky bottom */}
          <div className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-100 dark:border-gray-700 -mx-4 px-4 py-3 flex items-center justify-between gap-2">
            <button
              onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-medium text-sm sm:text-base transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 上一題
            </button>
            <span className="text-sm text-gray-400 dark:text-gray-500">{currentIndex + 1} / {totalCount}</span>
            {currentIndex === totalCount - 1 ? (
              <button
                onClick={() => handleFinish()}
                disabled={submitting}
                className={cn(
                  "px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium text-sm sm:text-base transition-all",
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
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-full font-medium text-sm sm:text-base transition-all"
              >
                下一題 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
