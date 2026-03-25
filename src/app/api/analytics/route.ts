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
              domain: true,
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
              domain: true,
              difficulty: true,
            },
          },
        },
      }),
    ]);

    // Average score
    const avgScore =
      completedExams.length > 0
        ? completedExams.reduce((sum, e) => sum + (e.score || 0), 0) /
          completedExams.length
        : 0;

    // Domain-wise accuracy
    const domainStats: Record<
      string,
      { total: number; correct: number }
    > = {};
    for (const answer of allExamAnswers) {
      const domain = answer.question.domain;
      if (!domainStats[domain]) {
        domainStats[domain] = { total: 0, correct: 0 };
      }
      if (answer.userAnswer != null) {
        domainStats[domain].total++;
        if (answer.isCorrect) {
          domainStats[domain].correct++;
        }
      }
    }

    const domainAccuracy = Object.entries(domainStats).map(
      ([domain, stats]) => ({
        domain,
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
      domain: r.question.domain,
      difficulty: r.question.difficulty,
      wrongCount: r.count,
      lastWrongAt: r.lastWrongAt,
    }));

    return NextResponse.json({
      totalExams,
      completedExams: completedExams.length,
      avgScore: Math.round(avgScore * 100) / 100,
      domainAccuracy,
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
