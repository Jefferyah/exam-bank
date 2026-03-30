import { prisma } from "@/lib/db";

/**
 * Shared success-rate calculation logic.
 * Used by both /api/admin/stats/success-rate and /api/success-rate.
 */

// ── Scoring helpers ──

export function coverageScore(attempts: number): number {
  if (attempts >= 3) return 1;
  if (attempts === 2) return 0.85;
  if (attempts === 1) return 0.5;
  return 0;
}

export function masteryScore(accuracy: number): number {
  if (accuracy >= 85) return 100;
  if (accuracy >= 60) return 40 + ((accuracy - 60) / 25) * 60;
  if (accuracy >= 40) return 15 + ((accuracy - 40) / 20) * 25;
  return (accuracy / 40) * 15;
}

export function timeScore(ratio: number): number {
  if (ratio >= 1.0) return 100;
  if (ratio >= 0.5) return 50 + ((ratio - 0.5) / 0.5) * 50;
  if (ratio >= 0.2) return 15 + ((ratio - 0.2) / 0.3) * 35;
  return (ratio / 0.2) * 15;
}

export function trendScore(activeDays: { daysAgo: number }[]): number {
  let score = 0;
  const daySet = new Set(activeDays.map((d) => d.daysAgo));
  for (let i = 0; i < 15; i++) {
    if (!daySet.has(i)) continue;
    if (i < 5) score += 1.5;
    else if (i < 10) score += 1.0;
    else score += 0.5;
  }
  return (score / 15) * 100;
}

export interface CategoryResult {
  category: string;
  bankNames: string[];
  totalQuestions: number;
  questionsAttempted: number;
  indicators: {
    coverage: number;
    mastery: number;
    time: number;
    correction: number;
    trend: number;
  };
  rawValues: {
    masteryAccuracy: number;
    timeMinutes: number;
    targetMinutes: number;
    activeDays: number;
    correctedCount: number;
    wrongCount: number;
  };
  score: number;
}

export interface SuccessRateResult {
  categories: CategoryResult[];
  overallScore: number;
}

/**
 * Calculate per-category success rate for a given user.
 * Only categories the user has touched are included.
 * @param excludeBankIds - Bank IDs to exclude (e.g. hidden banks)
 */
export async function calculateSuccessRate(
  userId: string,
  excludeBankIds: string[] = [],
): Promise<SuccessRateResult> {
  // Get all question banks grouped by category that user has actually answered (excluding hidden banks)
  const touchedBanks = excludeBankIds.length > 0
    ? await prisma.$queryRaw<
        { questionBankId: string; category: string; bankName: string }[]
      >`
        SELECT DISTINCT qb.id AS "questionBankId", COALESCE(qb.category, '未分類') AS category, qb.name AS "bankName"
        FROM "ExamAnswer" ea
        JOIN "Exam" e ON ea."examId" = e.id
        JOIN "Question" q ON ea."questionId" = q.id
        JOIN "QuestionBank" qb ON q."questionBankId" = qb.id
        WHERE e."userId" = ${userId}
          AND ea."userAnswer" IS NOT NULL
          AND qb.id != ALL(${excludeBankIds})
      `
    : await prisma.$queryRaw<
        { questionBankId: string; category: string; bankName: string }[]
      >`
        SELECT DISTINCT qb.id AS "questionBankId", COALESCE(qb.category, '未分類') AS category, qb.name AS "bankName"
        FROM "ExamAnswer" ea
        JOIN "Exam" e ON ea."examId" = e.id
        JOIN "Question" q ON ea."questionId" = q.id
        JOIN "QuestionBank" qb ON q."questionBankId" = qb.id
        WHERE e."userId" = ${userId}
          AND ea."userAnswer" IS NOT NULL
      `;

  if (touchedBanks.length === 0) {
    return { categories: [], overallScore: 0 };
  }

  // Get touched category names
  const touchedCategories = [...new Set(touchedBanks.map((tb) => tb.category))];

  // Expand: find ALL banks in those categories (not just the ones the user touched)
  const hasUncategorized = touchedCategories.includes("未分類");
  const namedCategories = touchedCategories.filter((c) => c !== "未分類");

  const categoryFilter: object[] = [];
  if (namedCategories.length > 0) {
    categoryFilter.push({ category: { in: namedCategories } });
  }
  if (hasUncategorized) {
    categoryFilter.push({ category: null });
  }

  const allBanksInCategories = await prisma.questionBank.findMany({
    where: {
      OR: categoryFilter,
      ...(excludeBankIds.length > 0 ? { id: { notIn: excludeBankIds } } : {}),
    },
    select: { id: true, name: true, category: true },
  });

  // Group ALL bank IDs by category
  const categoryMap = new Map<string, { bankIds: string[]; bankNames: string[] }>();
  for (const bank of allBanksInCategories) {
    const cat = bank.category || "未分類";
    const existing = categoryMap.get(cat) || { bankIds: [], bankNames: [] };
    if (!existing.bankIds.includes(bank.id)) {
      existing.bankIds.push(bank.id);
      existing.bankNames.push(bank.name);
    }
    categoryMap.set(cat, existing);
  }

  const now = new Date();
  const todayKey = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const fifteenDaysAgo = new Date(todayKey + "T00:00:00+08:00");
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const categoryResults: CategoryResult[] = [];

  for (const [category, { bankIds, bankNames }] of categoryMap) {
    const totalQuestions = await prisma.question.count({
      where: { questionBankId: { in: bankIds } },
    });
    if (totalQuestions === 0) continue;

    const questionAttempts = await prisma.$queryRaw<
      {
        questionId: string;
        attemptCount: number;
        secondPlusCorrect: number;
        secondPlusTotal: number;
        everWrong: boolean;
        laterCorrect: boolean;
        totalTimeSpent: number;
      }[]
    >`
      WITH numbered AS (
        SELECT
          ea."questionId",
          ea."isCorrect",
          ea."timeSpent",
          ea."updatedAt" AS "answeredAt",
          ROW_NUMBER() OVER (PARTITION BY ea."questionId" ORDER BY ea."updatedAt") AS rn
        FROM "ExamAnswer" ea
        JOIN "Exam" e ON ea."examId" = e.id
        JOIN "Question" q ON ea."questionId" = q.id
        WHERE e."userId" = ${userId}
          AND q."questionBankId" = ANY(${bankIds})
          AND ea."isCorrect" IS NOT NULL
      )
      SELECT
        "questionId",
        COUNT(*)::int AS "attemptCount",
        COUNT(CASE WHEN rn >= 2 AND "isCorrect" = true THEN 1 END)::int AS "secondPlusCorrect",
        COUNT(CASE WHEN rn >= 2 THEN 1 END)::int AS "secondPlusTotal",
        BOOL_OR("isCorrect" = false) AS "everWrong",
        BOOL_OR(
          "isCorrect" = true AND "answeredAt" > (
            SELECT MIN(n2."answeredAt") FROM numbered n2
            WHERE n2."questionId" = numbered."questionId" AND n2."isCorrect" = false
          )
        ) AS "laterCorrect",
        COALESCE(SUM("timeSpent"), 0)::int AS "totalTimeSpent"
      FROM numbered
      GROUP BY "questionId"
    `;

    // Indicator 1: Coverage
    let coverageSum = 0;
    for (const qa of questionAttempts) {
      coverageSum += coverageScore(qa.attemptCount);
    }
    const indicator1 = (coverageSum / totalQuestions) * 100;

    // Indicator 2: Mastery — scaled by coverage ratio
    // Raw mastery = 2nd+ attempt accuracy, but scaled by how many questions
    // the student has attempted out of total. This prevents gaming by only
    // doing a few questions well while ignoring the rest.
    const totalSecondPlus = questionAttempts.reduce((s, q) => s + q.secondPlusTotal, 0);
    const correctSecondPlus = questionAttempts.reduce((s, q) => s + q.secondPlusCorrect, 0);
    const rawMastery = totalSecondPlus > 0 ? (correctSecondPlus / totalSecondPlus) * 100 : 0;
    const coverageRatio = questionAttempts.length / totalQuestions; // 0~1
    const indicator2 = masteryScore(rawMastery) * coverageRatio;

    // Indicator 3: Time
    const totalTimeSeconds = questionAttempts.reduce((s, q) => s + q.totalTimeSpent, 0);
    const targetMinutes = totalQuestions * 4;
    const actualMinutes = totalTimeSeconds / 60;
    const indicator3 = timeScore(actualMinutes / targetMinutes);

    // Indicator 4: Correction rate
    const everWrongQuestions = questionAttempts.filter((q) => q.everWrong);
    let indicator4: number;
    if (questionAttempts.length === 0) {
      // No questions attempted at all → 0%
      indicator4 = 0;
    } else if (everWrongQuestions.length === 0) {
      // Attempted questions but never wrong → 100%
      indicator4 = 100;
    } else {
      const corrected = everWrongQuestions.filter((q) => q.laterCorrect).length;
      indicator4 = (corrected / everWrongQuestions.length) * 100;
    }

    // Indicator 5: 15-day trend — only count days with actual answers
    const recentActivity = await prisma.$queryRaw<{ dayDate: string }[]>`
      SELECT DISTINCT DATE(e."startedAt" AT TIME ZONE 'Asia/Taipei') AS "dayDate"
      FROM "ExamAnswer" ea
      JOIN "Exam" e ON ea."examId" = e.id
      JOIN "Question" q ON ea."questionId" = q.id
      WHERE e."userId" = ${userId}
        AND q."questionBankId" = ANY(${bankIds})
        AND e."startedAt" >= ${fifteenDaysAgo}
        AND ea."userAnswer" IS NOT NULL
    `;

    const activeDays = recentActivity.map((r) => {
      const d = new Date(r.dayDate);
      const today = new Date(todayKey + "T00:00:00+08:00");
      const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return { daysAgo: diff };
    });
    const indicator5 = trendScore(activeDays);

    // Total score
    const total = Math.round(
      indicator1 * 0.25 +
      indicator2 * 0.30 +
      indicator3 * 0.15 +
      indicator4 * 0.15 +
      indicator5 * 0.15
    );

    categoryResults.push({
      category,
      bankNames,
      totalQuestions,
      questionsAttempted: questionAttempts.length,
      indicators: {
        coverage: Math.round(indicator1),
        mastery: Math.round(indicator2),
        time: Math.round(indicator3),
        correction: Math.round(indicator4),
        trend: Math.round(indicator5),
      },
      rawValues: {
        masteryAccuracy: Math.round(rawMastery),
        timeMinutes: Math.round(actualMinutes),
        targetMinutes,
        activeDays: activeDays.length,
        correctedCount: everWrongQuestions.filter((q) => q.laterCorrect).length,
        wrongCount: everWrongQuestions.length,
      },
      score: total,
    });
  }

  // Overall = weighted average by totalQuestions per category
  const totalQAll = categoryResults.reduce((s, c) => s + c.totalQuestions, 0);
  const overallScore = totalQAll > 0
    ? Math.round(categoryResults.reduce((s, c) => s + c.score * c.totalQuestions, 0) / totalQAll)
    : 0;

  return {
    categories: categoryResults.sort((a, b) => a.score - b.score),
    overallScore,
  };
}
