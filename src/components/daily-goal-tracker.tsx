"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { GoalCelebration } from "@/components/confetti";

/**
 * Global daily goal tracker.
 * Triggers celebration immediately when:
 * - Page loads and goal is already met
 * - User finishes an exam (listens to "exam-finished" custom event)
 * - User navigates to a new page (route change)
 */
export function DailyGoalTracker() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showCelebration, setShowCelebration] = useState(false);
  const prevProgressRef = useRef<number | null>(null);
  const hasShownRef = useRef(false);
  const celebratedDayRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("exam-bank-goal-celebrated-day");
    if (stored) celebratedDayRef.current = stored;
  }, []);

  const checkGoal = useCallback(async () => {
    if (!session?.user?.id || hasShownRef.current) return;

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    if (celebratedDayRef.current === today) return;

    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) return;
      const data = await res.json();

      const { todayQuestions, dailyGoal } = data;
      if (!dailyGoal || dailyGoal <= 0) return;

      const wasBelow = prevProgressRef.current !== null && prevProgressRef.current < dailyGoal;
      const isNowComplete = todayQuestions >= dailyGoal;

      if (isNowComplete && (wasBelow || prevProgressRef.current === null)) {
        hasShownRef.current = true;
        celebratedDayRef.current = today;
        sessionStorage.setItem("exam-bank-goal-celebrated-day", today);
        setShowCelebration(true);
      }

      prevProgressRef.current = todayQuestions;
    } catch {
      // silently ignore
    }
  }, [session]);

  // Check on mount
  useEffect(() => {
    if (session) checkGoal();
  }, [session, checkGoal]);

  // Check on route change (e.g., navigating to result page after exam)
  useEffect(() => {
    if (session) checkGoal();
  }, [pathname, session, checkGoal]);

  // Listen for "exam-finished" custom event (fired immediately when exam is submitted)
  useEffect(() => {
    function handleExamFinished() {
      // Small delay to let the server process the answers
      setTimeout(checkGoal, 1500);
    }

    window.addEventListener("exam-finished", handleExamFinished);
    return () => window.removeEventListener("exam-finished", handleExamFinished);
  }, [checkGoal]);

  if (!showCelebration) return null;

  return (
    <GoalCelebration
      onDone={() => setShowCelebration(false)}
      message="每日目標達成！"
    />
  );
}
