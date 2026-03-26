/**
 * Spaced Repetition System (SM-2 variant)
 *
 * Pure functions — no DB or framework dependency.
 * Can be used on both server and client (e.g. to preview next interval).
 */

// ── Rating constants ──
export const SRS_AGAIN = 1 as const;
export const SRS_HARD = 2 as const;
export const SRS_GOOD = 3 as const;
export const SRS_EASY = 4 as const;

export type SRSRating = typeof SRS_AGAIN | typeof SRS_HARD | typeof SRS_GOOD | typeof SRS_EASY;

export const SRS_RATING_LABELS: Record<SRSRating, string> = {
  [SRS_AGAIN]: "Again",
  [SRS_HARD]: "Hard",
  [SRS_GOOD]: "Good",
  [SRS_EASY]: "Easy",
};

export const SRS_RATING_LABELS_ZH: Record<SRSRating, string> = {
  [SRS_AGAIN]: "忘記了",
  [SRS_HARD]: "有點難",
  [SRS_GOOD]: "記得",
  [SRS_EASY]: "太簡單",
};

// ── Card status ──
export type CardStatus = "NEW" | "LEARNING" | "REVIEW" | "MASTERED";

// ── Card state (the mutable fields we compute on) ──
export interface CardState {
  status: CardStatus;
  interval: number;     // days
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export interface NextCardState extends CardState {
  nextDueAt: Date;
}

// ── SM-2 core ──

const MIN_EASE = 1.3;

/**
 * Compute the next SRS state after a review.
 *
 * @param current  Current card state
 * @param rating   User's self-rating (1–4)
 * @param now      Optional: override current time (for testing)
 * @returns        New card state + nextDueAt
 */
export function computeNextState(
  current: CardState,
  rating: SRSRating,
  now: Date = new Date()
): NextCardState {
  let { interval, easeFactor, repetitions, lapses } = current;
  let status: CardStatus;

  switch (rating) {
    case SRS_AGAIN:
      // Forgot — reset progress
      repetitions = 0;
      lapses += 1;
      interval = 1;
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
      status = "LEARNING";
      break;

    case SRS_HARD:
      // Correct but struggled
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 2;
      } else {
        interval = Math.max(interval * 1.2, interval + 1);
      }
      repetitions += 1;
      status = repetitions >= 2 ? "REVIEW" : "LEARNING";
      break;

    case SRS_GOOD:
      // Normal correct
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 3;
      } else {
        interval = interval * easeFactor;
      }
      repetitions += 1;
      status = repetitions >= 2 ? "REVIEW" : "LEARNING";
      break;

    case SRS_EASY:
      // Effortlessly correct
      easeFactor = easeFactor + 0.15;
      if (repetitions === 0) {
        interval = 2;
      } else if (repetitions === 1) {
        interval = 4;
      } else {
        interval = interval * easeFactor * 1.3;
      }
      repetitions += 1;
      status = "REVIEW";
      break;
  }

  // Cap interval at 365 days
  interval = Math.min(Math.round(interval * 100) / 100, 365);

  // Promote to MASTERED if interval > 21 days and repetitions >= 5
  if (interval > 21 && repetitions >= 5) {
    status = "MASTERED";
  }

  // Compute next due date
  const nextDueAt = new Date(now.getTime() + interval * 86400000);

  return { status, interval, easeFactor, repetitions, lapses, nextDueAt };
}

// ── Auto-rating from exam answers ──

/**
 * Automatically determine an SRS rating from exam answer data.
 *
 * @param isCorrect    Whether the user answered correctly
 * @param timeSpent    Seconds spent on this question (nullable)
 * @param avgTime      Average time per question (seconds). Defaults to 60.
 * @returns            SRS rating (1–4)
 */
export function autoRateFromExamAnswer(
  isCorrect: boolean | null,
  timeSpent: number | null,
  avgTime: number = 60
): SRSRating {
  // Wrong → Again
  if (!isCorrect) return SRS_AGAIN;

  // Correct — determine quality by speed
  if (timeSpent != null && timeSpent > 0 && avgTime > 0) {
    const ratio = timeSpent / avgTime;
    if (ratio < 0.5) return SRS_EASY;   // Very fast
    if (ratio > 2.0) return SRS_HARD;   // Very slow (struggled)
    return SRS_GOOD;
  }

  // No time data → default Good
  return SRS_GOOD;
}

// ── Helpers ──

/** Human-readable interval description */
export function formatInterval(days: number): string {
  if (days < 1) return "< 1 天";
  if (days === 1) return "1 天";
  if (days < 7) return `${Math.round(days)} 天`;
  if (days < 30) return `${Math.round(days / 7)} 週`;
  if (days < 365) return `${Math.round(days / 30)} 個月`;
  return `${Math.round(days / 365)} 年`;
}

/** Preview what each rating would produce (for showing on buttons) */
export function previewAllRatings(
  current: CardState,
  now: Date = new Date()
): Record<SRSRating, NextCardState> {
  return {
    [SRS_AGAIN]: computeNextState(current, SRS_AGAIN, now),
    [SRS_HARD]: computeNextState(current, SRS_HARD, now),
    [SRS_GOOD]: computeNextState(current, SRS_GOOD, now),
    [SRS_EASY]: computeNextState(current, SRS_EASY, now),
  };
}
