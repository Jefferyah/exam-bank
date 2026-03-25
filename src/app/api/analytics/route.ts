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
    ] = await Promise.all([
      prisma.exam.count({ where: { userId } }),
      prisma.exam.findMany({
        where: { userId, status: "COMPLETED" },
        select: { id: true, score: true },
      }),
      prisma.examAnswer.findMany({
        where: { exam: { userId } },
        include: {
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
          finishedAt: true,
          startedAt: true,
        },
      }),
      prisma.wrongRecord.findMany({
        where: { userId },
        orderBy: { count: "desc" },
        take: 10,
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

    // Recent trend (last 10 exams)
    const recentTrend = recentExams.map((e) => ({
      id: e.id,
      title: e.title,
      score: e.score,
      finishedAt: e.finishedAt,
      startedAt: e.startedAt,
    }));

    // Most wrong questions
    const mostWrongQuestions = wrongRecords.map((r) => ({
      questionId: r.questionId,
      stem: r.question.stem,
      questionBankId: r.question.questionBankId,
      questionBankName: bankMap.get(r.question.questionBankId) || r.question.questionBankId,
      difficulty: r.question.difficulty,
      wrongCount: r.count,
      lastWrongAt: r.lastWrongAt,
    }));

    return NextResponse.json({
      totalExams,
      completedExams: completedExams.length,
      avgScore: Math.round(avgScore * 100) / 100,
      bankAccuracy,
      difficultyDistribution,
      recentTrend,
      mostWrongQuestions,
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
