"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { GoalCelebration } from "@/components/confetti";

/**
 * Global daily goal tracker that lives in the layout.
 * Periodically checks if the user has reached their daily goal
 * and shows a full-screen confetti celebration when they do.
 */
export function DailyGoalTracker() {
  const { data: session } = useSession();
  const [showCelebration, setShowCelebration] = useState(false);
  const prevProgressRef = useRef<number | null>(null);
  const hasShownRef = useRef(false);

  // Track which calendar day we've already celebrated
  const celebratedDayRef = useRef<string | null>(null);

  useEffect(() => {
    // Load celebrated day from sessionStorage (resets on new browser session)
    const stored = sessionStorage.getItem("exam-bank-goal-celebrated-day");
    if (stored) celebratedDayRef.current = stored;
  }, []);

  const checkGoal = useCallback(async () => {
    if (!session?.user?.id || hasShownRef.current) return;

    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) return;
      const data = await res.json();

      const { todayQuestions, dailyGoal } = data;
      if (!dailyGoal || dailyGoal <= 0) return;

      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });

      // Already celebrated today
      if (celebratedDayRef.current === today) return;

      const wasBelow = prevProgressRef.current !== null && prevProgressRef.current < dailyGoal;
      const isNowComplete = todayQuestions >= dailyGoal;

      // Trigger: either first load already complete, or transition from below to complete
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

  useEffect(() => {
    if (!session) return;

    // Check on mount
    checkGoal();

    // Check every 30 seconds (catches goal completion during exam)
    const interval = setInterval(checkGoal, 30000);

    // Also check when page becomes visible again (e.g., switching tabs after finishing exam)
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        checkGoal();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session, checkGoal]);

  if (!showCelebration) return null;

  return (
    <GoalCelebration
      onDone={() => setShowCelebration(false)}
      message="每日目標達成！"
    />
  );
}
