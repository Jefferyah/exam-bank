import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";
import { getEffectiveTagsMap } from "@/lib/effective-tags";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch data in parallel — only completed exams for stats, reduced field selection
    const [
      totalExams,
      allCompletedExams,
      allExamAnswers,
      recentExams,
      wrongRecords,
    ] = await Promise.all([
      prisma.exam.count({ where: { userId } }),
      // Single query for all completed exams (replaces two overlapping queries)
      prisma.exam.findMany({
        where: { userId, status: "COMPLETED" },
        select: {
          id: true,
          title: true,
          mode: true,
          score: true,
          config: true,
          startedAt: true,
          finishedAt: true,
        },
        orderBy: { finishedAt: "desc" },
      }),
      // Only fetch answers from completed exams, minimal fields
      prisma.examAnswer.findMany({
        where: { exam: { userId, status: "COMPLETED" } },
        select: {
          examId: true,
          userAnswer: true,
          isCorrect: true,
          timeSpent: true,
          question: {
            select: {
              id: true,
              questionBankId: true,
              difficulty: true,
              tags: true,
            },
          },
        },
      }),
      prisma.exam.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          score: true,
          config: true,
          finishedAt: true,
          startedAt: true,
        },
      }),
      prisma.wrongRecord.findMany({
        where: { userId },
        orderBy: [{ count: "desc" }, { lastWrongAt: "desc" }],
        include: {
          question: {
            select: {
              id: true,
              stem: true,
              questionBankId: true,
              difficulty: true,
            },
          },
        },
      }),
    ]);

    // Derive completedExams list from allCompletedExams
    const completedExams = allCompletedExams;

    // Fetch question banks for mapping + get hidden banks
    const [questionBanks, hiddenBanks] = await Promise.all([
      prisma.questionBank.findMany({ select: { id: true, name: true } }),
      prisma.hiddenBank.findMany({
        where: { userId },
        select: { questionBankId: true },
      }),
    ]);
    const bankMap = new Map(questionBanks.map((b) => [b.id, b.name]));
    const hiddenBankIds = new Set(hiddenBanks.map((h) => h.questionBankId));
    // Filter out hidden banks from all exam answers early so all downstream stats are consistent
    const allExamAnswersFiltered = allExamAnswers.filter(
      (a) => !hiddenBankIds.has(a.question.questionBankId)
    );
    // Build exam mode lookup from allCompletedExams
    const examModeMap = new Map(allCompletedExams.map((e) => [e.id, e.mode]));

    // Average score
    const avgScore =
      completedExams.length > 0
        ? completedExams.reduce((sum, e) => sum + (e.score || 0), 0) /
          completedExams.length
        : 0;

    // QuestionBank-wise accuracy
    const bankStats: Record<
      string,
      { total: number; correct: number }
    > = {};
    for (const answer of allExamAnswersFiltered) {
      const bankId = answer.question.questionBankId;
      if (!bankStats[bankId]) {
        bankStats[bankId] = { total: 0, correct: 0 };
      }
      if (answer.userAnswer != null) {
        bankStats[bankId].total++;
        if (answer.isCorrect) {
          bankStats[bankId].correct++;
        }
      }
    }

    const bankAccuracy = Object.entries(bankStats)
      .filter(([bankId]) => !hiddenBankIds.has(bankId))
      .map(([bankId, stats]) => ({
        questionBankId: bankId,
        questionBankName: bankMap.get(bankId) || bankId,
        total: stats.total,
        correct: stats.correct,
        accuracy:
          stats.total > 0
            ? Math.round((stats.correct / stats.total) * 100 * 100) / 100
            : 0,
      }));

    // Difficulty distribution
    const difficultyStats: Record<
      number,
      { total: number; correct: number }
    > = {};
    for (const answer of allExamAnswersFiltered) {
      const diff = answer.question.difficulty;
      if (!difficultyStats[diff]) {
        difficultyStats[diff] = { total: 0, correct: 0 };
      }
      if (answer.userAnswer != null) {
        difficultyStats[diff].total++;
        if (answer.isCorrect) {
          difficultyStats[diff].correct++;
        }
      }
    }

    const difficultyDistribution = Object.entries(difficultyStats)
      .map(([difficulty, stats]) => ({
        difficulty: parseInt(difficulty, 10),
        total: stats.total,
        correct: stats.correct,
        accuracy:
          stats.total > 0
            ? Math.round((stats.correct / stats.total) * 100 * 100) / 100
            : 0,
      }))
      .sort((a, b) => a.difficulty - b.difficulty);

    // Recent trend (last 10 exams) — include question bank names
    // Fetch actual bank IDs from exam answers for accurate names
    const recentExamIds = recentExams.map((e) => e.id);
    const recentExamAnswers = recentExamIds.length > 0
      ? await prisma.examAnswer.findMany({
          where: { examId: { in: recentExamIds } },
          select: { examId: true, question: { select: { questionBankId: true } } },
        })
      : [];

    // Group unique bank IDs per exam
    const examBankIds: Record<string, Set<string>> = {};
    for (const a of recentExamAnswers) {
      if (!examBankIds[a.examId]) examBankIds[a.examId] = new Set();
      examBankIds[a.examId].add(a.question.questionBankId);
    }

    const recentTrend = recentExams.map((e) => {
      const bankIds = Array.from(examBankIds[e.id] || []);
      const bankNames = bankIds.map((id) => bankMap.get(id) || id);
      return {
        id: e.id,
        title: e.title,
        score: e.score,
        finishedAt: e.finishedAt,
        startedAt: e.startedAt,
        questionBankNames: bankNames,
      };
    });

    // Most wrong questions
    const allWrongQuestions = wrongRecords
      .filter((r) => !hiddenBankIds.has(r.question.questionBankId))
      .map((r) => ({
        questionId: r.questionId,
        stem: r.question.stem,
        questionBankId: r.question.questionBankId,
        questionBankName: bankMap.get(r.question.questionBankId) || r.question.questionBankId,
        difficulty: r.question.difficulty,
        wrongCount: r.count,
        lastWrongAt: r.lastWrongAt,
      }));

    // ── Time analysis ──
    // Time analysis: only count MOCK (exam) mode for meaningful speed data
    const answeredWithTime = allExamAnswersFiltered.filter(
      (a) => a.userAnswer != null && (a.timeSpent ?? 0) > 0 && examModeMap.get(a.examId) === "MOCK"
    );
    const avgTimePerQuestion =
      answeredWithTime.length > 0
        ? Math.round(
            answeredWithTime.reduce((s, a) => s + (a.timeSpent ?? 0), 0) /
              answeredWithTime.length
          )
        : 0;

    // Time per difficulty
    const timeByDifficulty: Record<number, { totalTime: number; count: number }> = {};
    for (const a of answeredWithTime) {
      const d = a.question.difficulty;
      if (!timeByDifficulty[d]) timeByDifficulty[d] = { totalTime: 0, count: 0 };
      timeByDifficulty[d].totalTime += a.timeSpent ?? 0;
      timeByDifficulty[d].count++;
    }
    const timePerDifficulty = Object.entries(timeByDifficulty)
      .map(([d, s]) => ({
        difficulty: parseInt(d, 10),
        avgTime: Math.round(s.totalTime / s.count),
        count: s.count,
      }))
      .sort((a, b) => a.difficulty - b.difficulty);

    // Time per bank
    const timeByBank: Record<string, { totalTime: number; count: number; correctTime: number; correctCount: number; wrongTime: number; wrongCount: number }> = {};
    for (const a of answeredWithTime) {
      const bId = a.question.questionBankId;
      if (!timeByBank[bId]) timeByBank[bId] = { totalTime: 0, count: 0, correctTime: 0, correctCount: 0, wrongTime: 0, wrongCount: 0 };
      timeByBank[bId].totalTime += a.timeSpent ?? 0;
      timeByBank[bId].count++;
      if (a.isCorrect) {
        timeByBank[bId].correctTime += a.timeSpent ?? 0;
        timeByBank[bId].correctCount++;
      } else {
        timeByBank[bId].wrongTime += a.timeSpent ?? 0;
        timeByBank[bId].wrongCount++;
      }
    }
    const timePerBank = Object.entries(timeByBank).filter(([bId]) => !hiddenBankIds.has(bId)).map(([bId, s]) => ({
      questionBankId: bId,
      questionBankName: bankMap.get(bId) || bId,
      avgTime: Math.round(s.totalTime / s.count),
      avgCorrectTime: s.correctCount > 0 ? Math.round(s.correctTime / s.correctCount) : 0,
      avgWrongTime: s.wrongCount > 0 ? Math.round(s.wrongTime / s.wrongCount) : 0,
      count: s.count,
    }));

    // ── Mode comparison (PRACTICE vs MOCK) ──
    const modeStats: Record<string, { count: number; totalScore: number; totalDuration: number }> = {};
    for (const exam of allCompletedExams) {
      const mode = exam.mode || "PRACTICE";
      if (!modeStats[mode]) modeStats[mode] = { count: 0, totalScore: 0, totalDuration: 0 };
      modeStats[mode].count++;
      modeStats[mode].totalScore += exam.score || 0;
      if (exam.startedAt && exam.finishedAt) {
        modeStats[mode].totalDuration +=
          (new Date(exam.finishedAt).getTime() - new Date(exam.startedAt).getTime()) / 1000;
      }
    }
    const modeComparison = Object.entries(modeStats).map(([mode, s]) => ({
      mode,
      count: s.count,
      avgScore: s.count > 0 ? Math.round((s.totalScore / s.count) * 100) / 100 : 0,
      avgDuration: s.count > 0 ? Math.round(s.totalDuration / s.count) : 0,
    }));

    // ── Tag-wise accuracy (using effective tags per user) ──
    const tagOverrideMap = await getEffectiveTagsMap(
      allExamAnswersFiltered.map((a) => a.question.id),
      userId
    );
    const tagStats: Record<string, { total: number; correct: number }> = {};
    for (const answer of allExamAnswersFiltered) {
      if (answer.userAnswer == null) continue;
      const tags: string[] = tagOverrideMap.get(answer.question.id) ?? safeJsonParse(answer.question.tags, []);
      for (const tag of tags) {
        if (!tag.trim()) continue;
        const t = tag.trim();
        if (!tagStats[t]) tagStats[t] = { total: 0, correct: 0 };
        tagStats[t].total++;
        if (answer.isCorrect) tagStats[t].correct++;
      }
    }
    const tagAccuracy = Object.entries(tagStats)
      .map(([tag, stats]) => ({
        tag,
        total: stats.total,
        correct: stats.correct,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Timezone-aware date helper (Asia/Taipei) ──
    const TZ = "Asia/Taipei";
    function toLocalDateKey(date: Date): string {
      return date.toLocaleDateString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD"
    }
    function localDayStart(dateKey: string): Date {
      // Parse "YYYY-MM-DD" as local midnight in target timezone
      // sv-SE locale gives ISO format, convert back via timezone offset
      const d = new Date(dateKey + "T00:00:00+08:00");
      return d;
    }

    // ── Daily activity (last 30 days) ──
    const now = new Date();
    const todayKey = toLocalDateKey(now);

    const dailyActivity: Record<string, { exams: number; questions: number }> = {};
    // Init all 30 days using local dates
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = toLocalDateKey(d);
      dailyActivity[key] = { exams: 0, questions: 0 };
    }
    // Count exams per day (local timezone)
    for (const exam of allCompletedExams) {
      if (!exam.finishedAt) continue;
      const key = toLocalDateKey(new Date(exam.finishedAt));
      if (dailyActivity[key]) dailyActivity[key].exams++;
    }
    // Count answered questions per day (from exam's finishedAt)
    const examFinishMap = new Map(
      allCompletedExams.map((e) => [e.id, e.finishedAt])
    );
    for (const a of allExamAnswersFiltered) {
      if (a.userAnswer == null) continue;
      const finished = examFinishMap.get(a.examId);
      if (!finished) continue;
      const key = toLocalDateKey(new Date(finished));
      if (dailyActivity[key]) dailyActivity[key].questions++;
    }
    const dailyActivityArray = Object.entries(dailyActivity)
      .map(([date, s]) => ({ date, ...s }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Study streak (local timezone) ──
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = toLocalDateKey(d);
      const activity = dailyActivity[key];
      if (activity) {
        if (activity.exams > 0 || activity.questions > 0) {
          currentStreak++;
        } else if (key !== todayKey) {
          break;
        } else {
          continue; // Today with no activity yet — day not over
        }
      } else {
        // Beyond 30-day cache, check exam data directly
        const hasExam = allCompletedExams.some(
          (e) => e.finishedAt && toLocalDateKey(new Date(e.finishedAt)) === key
        );
        if (hasExam) {
          currentStreak++;
        } else if (key !== todayKey) {
          break;
        }
      }
    }

    // ── Today's progress (for daily goal, local timezone) ──
    // Count answered questions from COMPLETED exams finished today
    // PLUS answered questions from IN_PROGRESS exams started today
    const todayStart = localDayStart(todayKey);
    const todayCompletedAnswered = allExamAnswersFiltered.filter((a) => {
      if (a.userAnswer == null) return false;
      const finished = examFinishMap.get(a.examId);
      if (!finished) return false;
      return new Date(finished) >= todayStart;
    }).length;

    // Also count answers from in-progress exams (include all, not just started today,
    // so cross-midnight sessions are counted)
    const inProgressExams = await prisma.exam.findMany({
      where: {
        userId,
        status: "IN_PROGRESS",
      },
      select: { id: true },
    });
    let todayInProgressAnswered = 0;
    if (inProgressExams.length > 0) {
      todayInProgressAnswered = await prisma.examAnswer.count({
        where: {
          examId: { in: inProgressExams.map((e) => e.id) },
          userAnswer: { not: null },
          createdAt: { gte: todayStart },
        },
      });
    }
    const todayAnswered = todayCompletedAnswered + todayInProgressAnswered;

    // Fetch user's daily goal
    const userSettings = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyGoal: true },
    });

    return NextResponse.json({
      totalExams,
      completedExams: completedExams.length,
      avgScore: Math.round(avgScore * 100) / 100,
      bankAccuracy,
      difficultyDistribution,
      recentTrend,
      mostWrongQuestions: allWrongQuestions.slice(0, 10),
      allWrongQuestions,
      totalWrongCount: allWrongQuestions.reduce((sum, q) => sum + q.wrongCount, 0),
      // New analytics
      timeAnalysis: {
        avgTimePerQuestion,
        timePerDifficulty,
        timePerBank,
      },
      modeComparison,
      tagAccuracy,
      dailyActivity: dailyActivityArray,
      currentStreak,
      todayQuestions: todayAnswered,
      dailyGoal: userSettings?.dailyGoal || null,
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
