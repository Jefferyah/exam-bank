"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  previewAllRatings,
  formatInterval,
  SRS_AGAIN,
  SRS_HARD,
  SRS_GOOD,
  SRS_EASY,
  SRS_RATING_LABELS_ZH,
  type SRSRating,
  type CardState,
} from "@/lib/srs";

interface ReviewQuestion {
  id: string;
  stem: string;
  type: string;
  options: { label: string; text: string }[];
  answer: string;
  explanation: string;
  wrongOptionExplanations: Record<string, string> | null;
  difficulty: number;
  questionBank?: { id: string; name: string };
}

interface ReviewCardData {
  id: string;
  questionId: string;
  status: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  nextDueAt: string;
  question: ReviewQuestion;
}

interface ReviewStats {
  totalCards: number;
  dueToday: number;
  byStatus: Record<string, number>;
  masteryRate: number;
}

export default function ReviewSessionPage() {
  const router = useRouter();
  useSession({ required: true });

  const [cards, setCards] = useState<ReviewCardData[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionResults, setSessionResults] = useState<
    { cardId: string; rating: SRSRating; intervalDays: number }[]
  >([]);
  const [finished, setFinished] = useState(false);
  const questionTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchDueCards() {
      try {
        const res = await fetch("/api/review-cards?due=today&limit=200");
        if (res.ok) {
          const data = await res.json();
          setCards(data.cards || []);
          setStats(data.stats || null);
          if (!data.cards?.length) {
            setFinished(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDueCards();
  }, []);

  const currentCard = cards[currentIndex];
  const currentQuestion = currentCard?.question;

  // Build card state for preview
  const cardState: CardState | null = currentCard
    ? {
        status: currentCard.status as CardState["status"],
        interval: currentCard.interval,
        easeFactor: currentCard.easeFactor,
        repetitions: currentCard.repetitions,
        lapses: currentCard.lapses,
      }
    : null;

  const previews = cardState ? previewAllRatings(cardState) : null;

  const submitRating = useCallback(
    async (rating: SRSRating) => {
      if (!currentCard || submitting) return;
      setSubmitting(true);

      try {
        const res = await fetch(`/api/review-cards/${currentCard.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        });

        if (res.ok) {
          const data = await res.json();
          setSessionResults((prev) => [
            ...prev,
            {
              cardId: currentCard.id,
              rating,
              intervalDays: data.intervalDays,
            },
          ]);

          // Move to next card or finish
          if (currentIndex + 1 < cards.length) {
            setCurrentIndex((i) => i + 1);
            setShowAnswer(false);
            setSelectedAnswer(null);
            setTimeout(() => {
              questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
          } else {
            setFinished(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    },
    [currentCard, currentIndex, cards.length, submitting]
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Session finished ──
  if (finished) {
    const againCount = sessionResults.filter((r) => r.rating === SRS_AGAIN).length;
    const hardCount = sessionResults.filter((r) => r.rating === SRS_HARD).length;
    const goodCount = sessionResults.filter((r) => r.rating === SRS_GOOD).length;
    const easyCount = sessionResults.filter((r) => r.rating === SRS_EASY).length;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-8 shadow-sm text-center">
          {sessionResults.length === 0 ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                今天沒有需要複習的卡片
              </h2>
              <p className="text-gray-500 mb-6">做更多練習來建立複習排程吧！</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                複習完成！
              </h2>
              <p className="text-gray-500 mb-6">
                今天複習了 {sessionResults.length} 張卡片
              </p>

              {/* Result breakdown */}
              <div className="flex justify-center gap-4 mb-6">
                {againCount > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{againCount}</div>
                    <div className="text-xs text-gray-400">{SRS_RATING_LABELS_ZH[SRS_AGAIN]}</div>
                  </div>
                )}
                {hardCount > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">{hardCount}</div>
                    <div className="text-xs text-gray-400">{SRS_RATING_LABELS_ZH[SRS_HARD]}</div>
                  </div>
                )}
                {goodCount > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{goodCount}</div>
                    <div className="text-xs text-gray-400">{SRS_RATING_LABELS_ZH[SRS_GOOD]}</div>
                  </div>
                )}
                {easyCount > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-500">{easyCount}</div>
                    <div className="text-xs text-gray-400">{SRS_RATING_LABELS_ZH[SRS_EASY]}</div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/review")}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full font-medium transition-colors"
            >
              回到複習分析
            </button>
            <button
              onClick={() => router.push("/exam")}
              className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-colors"
            >
              繼續練習
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{stats.totalCards}</div>
              <div className="text-xs text-gray-400">總卡片數</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-blue-500">{stats.byStatus.LEARNING || 0}</div>
              <div className="text-xs text-gray-400">學習中</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-amber-500">{stats.byStatus.REVIEW || 0}</div>
              <div className="text-xs text-gray-400">複習中</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-emerald-500">{stats.byStatus.MASTERED || 0}</div>
              <div className="text-xs text-gray-400">已精熟</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── No current card (shouldn't happen) ──
  if (!currentQuestion) return null;

  const isMulti = currentQuestion.type === "MULTI";

  return (
    <div className="max-w-3xl mx-auto px-4 py-4" ref={questionTopRef}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm("確定要結束複習嗎？")) setFinished(true);
            }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            結束
          </button>
          <span className="text-sm text-gray-600">
            間隔複習
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {cards.length}
          </span>
          {/* Status badge */}
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              currentCard.status === "NEW" && "bg-gray-100 text-gray-500",
              currentCard.status === "LEARNING" && "bg-blue-50 text-blue-600",
              currentCard.status === "REVIEW" && "bg-amber-50 text-amber-600",
              currentCard.status === "MASTERED" && "bg-emerald-50 text-emerald-600"
            )}
          >
            {currentCard.status === "NEW" && "新卡片"}
            {currentCard.status === "LEARNING" && "學習中"}
            {currentCard.status === "REVIEW" && "複習中"}
            {currentCard.status === "MASTERED" && "已精熟"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-4">
        <div
          className="h-1.5 bg-blue-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-3">
          {currentQuestion.questionBank && (
            <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {currentQuestion.questionBank.name}
            </span>
          )}
          {currentCard.lapses > 0 && (
            <span className="text-xs text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
              曾忘記 {currentCard.lapses} 次
            </span>
          )}
        </div>

        <p className="text-lg leading-relaxed whitespace-pre-wrap break-words text-gray-900 mb-1">
          {currentQuestion.stem}
        </p>
        {isMulti && (
          <p className="text-sm text-amber-500 mt-1">（多選題）</p>
        )}
      </div>

      {/* Options — always visible, clickable before reveal */}
      <div className="space-y-3 mb-4">
        {currentQuestion.options.map((opt) => {
          const isSelected = isMulti
            ? (selectedAnswer || "").split(",").includes(opt.label)
            : selectedAnswer === opt.label;

          const isCorrectOption = currentQuestion.answer.includes(opt.label);
          const isUserWrong = showAnswer && isSelected && !isCorrectOption;
          const isCorrectRevealed = showAnswer && isCorrectOption;

          let optStyle =
            "border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-200";
          if (!showAnswer && isSelected) {
            optStyle = "border-blue-200 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30";
          }
          if (isCorrectRevealed) {
            optStyle = "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30";
          }
          if (isUserWrong) {
            optStyle = "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-900/30";
          }

          return (
            <button
              key={opt.label}
              onClick={() => {
                if (showAnswer) return;
                if (isMulti) {
                  const labels = (selectedAnswer || "").split(",").filter(Boolean);
                  const next = labels.includes(opt.label)
                    ? labels.filter((l) => l !== opt.label)
                    : [...labels, opt.label];
                  setSelectedAnswer(next.sort().join(",") || null);
                } else {
                  setSelectedAnswer(opt.label);
                }
              }}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all",
                optStyle
              )}
            >
              <span className="font-semibold text-gray-900 mr-3">{opt.label}.</span>
              <span className="text-gray-700 break-words">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Show answer / Rating buttons */}
      {!showAnswer ? (
        <button
          onClick={() => setShowAnswer(true)}
          disabled={!selectedAnswer}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full font-medium transition-all"
        >
          顯示答案
        </button>
      ) : (
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">
              正確答案：<span className="text-emerald-500 font-bold text-lg">{currentQuestion.answer}</span>
            </p>
            <p className="text-gray-600 whitespace-pre-wrap break-words">{currentQuestion.explanation}</p>
            {currentQuestion.wrongOptionExplanations && (
              <div className="space-y-2 pt-3 mt-3 border-t border-gray-100">
                {Object.entries(currentQuestion.wrongOptionExplanations).map(([label, text]) => (
                  <p key={label} className="text-sm text-gray-600">
                    <span className="text-red-500 font-semibold">{label}.</span> {text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Rating buttons */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-3 text-center">這題你掌握得如何？</p>
            <div className="grid grid-cols-4 gap-2">
              {([SRS_AGAIN, SRS_HARD, SRS_GOOD, SRS_EASY] as SRSRating[]).map((rating) => {
                const preview = previews?.[rating];
                const colors = {
                  [SRS_AGAIN]: "bg-red-500 hover:bg-red-600 text-white",
                  [SRS_HARD]: "bg-orange-500 hover:bg-orange-600 text-white",
                  [SRS_GOOD]: "bg-blue-500 hover:bg-blue-600 text-white",
                  [SRS_EASY]: "bg-emerald-500 hover:bg-emerald-600 text-white",
                };
                return (
                  <button
                    key={rating}
                    onClick={() => submitRating(rating)}
                    disabled={submitting}
                    className={cn(
                      "rounded-xl py-3 px-2 font-medium transition-all disabled:opacity-50",
                      colors[rating]
                    )}
                  >
                    <div className="text-sm">{SRS_RATING_LABELS_ZH[rating]}</div>
                    {preview && (
                      <div className="text-xs opacity-80 mt-0.5">
                        {formatInterval(preview.interval)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
