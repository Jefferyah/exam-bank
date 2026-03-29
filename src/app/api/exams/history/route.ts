import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/exams/history?page=1&limit=20&mode=PRACTICE
 * Full exam history with pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const modeFilter = searchParams.get("mode"); // PRACTICE, MOCK, or null for all
    const skip = (page - 1) * limit;

    const where = {
      userId,
      status: "COMPLETED" as const,
      ...(modeFilter ? { mode: modeFilter } : {}),
    };

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        orderBy: { finishedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          note: true,
          mode: true,
          score: true,
          startedAt: true,
          finishedAt: true,
          timeLimit: true,
          answers: {
            select: {
              id: true,
              isCorrect: true,
              question: {
                select: {
                  questionBank: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.exam.count({ where }),
    ]);

    const items = exams.map((e) => {
      const answered = e.answers.filter((a) => a.isCorrect !== null).length;
      const correct = e.answers.filter((a) => a.isCorrect === true).length;
      const bankNames = [...new Set(e.answers.map((a) => a.question.questionBank?.name).filter(Boolean))];
      return {
        id: e.id,
        title: e.title,
        note: e.note,
        mode: e.mode,
        score: e.score,
        startedAt: e.startedAt,
        finishedAt: e.finishedAt,
        timeLimit: e.timeLimit,
        totalQuestions: e.answers.length,
        answered,
        correct,
        questionBankNames: bankNames,
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/exams/history error:", error);
    return NextResponse.json({ error: "Failed to fetch exam history" }, { status: 500 });
  }
}
