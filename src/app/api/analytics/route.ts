import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all data in parallel
    const [
      totalExams,
      completedExams,
      allExamAnswers,
      recentExams,
      wrongRecords,
      allCompletedExams,
    ] = await Promise.all([
      prisma.exam.count({ where: { userId } }),
      prisma.exam.findMany({
        where: { userId, status: "COMPLETED" },
        select: { id: true, score: true },
      }),
      prisma.examAnswer.findMany({
        where: { exam: { userId } },
        include: {
          exam: { select: { mode: true } },
          question: {
            select: {
              id: true,
              questionBankId: true,
              difficulty: true,
              stem: true,
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
      // For mode comparison & daily activity
      prisma.exam.findMany({
        where: { userId, status: "COMPLETED" },
        select: {
          id: true,
          mode: true,
          score: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
    ]);

    // Fetch question banks for mapping
    const questionBanks = await prisma.questionBank.findMany({
      select: { id: true, name: true },
    });
    const bankMap = new Map(questionBanks.map((b) => [b.id, b.name]));

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
    for (const answer of allExamAnswers) {
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

    const bankAccuracy = Object.entries(bankStats).map(
      ([bankId, stats]) => ({
        questionBankId: bankId,
        questionBankName: bankMap.get(bankId) || bankId,
        total: stats.total,
        correct: stats.correct,
        accuracy:
          stats.total > 0
            ? Math.round((stats.correct / stats.total) * 100 * 100) / 100
            : 0,
      })
    );

    // Difficulty distribution
    const difficultyStats: Record<
      number,
      { total: number; correct: number }
    > = {};
    for (const answer of allExamAnswers) {
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
    const allWrongQuestions = wrongRecords.map((r) => ({
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
    const answeredWithTime = allExamAnswers.filter(
      (a) => a.userAnswer != null && (a.timeSpent ?? 0) > 0 && a.exam.mode === "MOCK"
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
    const timePerBank = Object.entries(timeByBank).map(([bId, s]) => ({
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

    // ── Daily activity (last 30 days) ──
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyActivity: Record<string, { exams: number; questions: number }> = {};
    // Init all 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyActivity[key] = { exams: 0, questions: 0 };
    }
    // Count exams per day
    for (const exam of allCompletedExams) {
      if (!exam.finishedAt) continue;
      const key = new Date(exam.finishedAt).toISOString().slice(0, 10);
      if (dailyActivity[key]) dailyActivity[key].exams++;
    }
    // Count answered questions per day (from exam's finishedAt)
    const examFinishMap = new Map(
      allCompletedExams.map((e) => [e.id, e.finishedAt])
    );
    for (const a of allExamAnswers) {
      if (a.userAnswer == null) continue;
      const finished = examFinishMap.get(a.examId);
      if (!finished) continue;
      const key = new Date(finished).toISOString().slice(0, 10);
      if (dailyActivity[key]) dailyActivity[key].questions++;
    }
    const dailyActivityArray = Object.entries(dailyActivity)
      .map(([date, s]) => ({ date, ...s }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Study streak ──
    let currentStreak = 0;
    const today = now.toISOString().slice(0, 10);
    // Walk backwards from today
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const activity = dailyActivity[key];
      // For days beyond 30-day window, check allCompletedExams directly
      if (activity) {
        if (activity.exams > 0 || activity.questions > 0) {
          currentStreak++;
        } else if (key !== today) {
          // Allow today to be zero (day not over yet) on first iteration
          break;
        } else {
          // Today with no activity - check if yesterday had activity
          continue;
        }
      } else {
        // Beyond 30-day cache, check exam data
        const hasExam = allCompletedExams.some(
          (e) => e.finishedAt && new Date(e.finishedAt).toISOString().slice(0, 10) === key
        );
        if (hasExam) {
          currentStreak++;
        } else if (key !== today) {
          break;
        }
      }
    }

    // ── Today's progress (for daily goal) ──
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayAnswered = allExamAnswers.filter((a) => {
      if (a.userAnswer == null) return false;
      const finished = examFinishMap.get(a.examId);
      if (!finished) return false;
      return new Date(finished) >= todayStart;
    }).length;

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
      // New analytics
      timeAnalysis: {
        avgTimePerQuestion,
        timePerDifficulty,
        timePerBank,
      },
      modeComparison,
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
