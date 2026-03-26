import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/review-cards
 *
 * Query params:
 *  - due=today        Only cards with nextDueAt <= end of today (Asia/Taipei)
 *  - status=LEARNING  Filter by status
 *  - questionBankId   Filter by question bank
 *  - questionId       Check if a specific question has a card
 *  - limit            Max results (default 200)
 *  - stats=true       Return only summary stats (no card list)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const url = req.nextUrl;
    const due = url.searchParams.get("due");
    const status = url.searchParams.get("status");
    const questionBankId = url.searchParams.get("questionBankId");
    const questionId = url.searchParams.get("questionId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200"), 500);
    const statsOnly = url.searchParams.get("stats") === "true";

    // Exclude hidden banks
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };

    if (due === "today") {
      // End of today in Asia/Taipei
      const now = new Date();
      const todayKey = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
      const endOfToday = new Date(todayKey + "T23:59:59+08:00");
      where.nextDueAt = { lte: endOfToday };
    }

    if (status) {
      where.status = status;
    }

    if (questionId) {
      where.questionId = questionId;
    }

    // Filter by question bank, always excluding hidden banks
    const questionFilter: any = {};
    if (questionBankId) {
      questionFilter.questionBankId = questionBankId;
    }
    if (hiddenBankIds.length > 0) {
      questionFilter.questionBank = { id: { notIn: hiddenBankIds } };
    }
    if (Object.keys(questionFilter).length > 0) {
      where.question = questionFilter;
    }

    // Stats where clause — also excludes hidden banks
    const statsWhere: any = { userId };
    if (hiddenBankIds.length > 0) {
      statsWhere.question = { questionBank: { id: { notIn: hiddenBankIds } } };
    }

    // Always fetch stats
    const [totalCards, statusCounts, dueToday] = await Promise.all([
      prisma.reviewCard.count({ where: statsWhere }),
      prisma.reviewCard.groupBy({
        by: ["status"],
        where: statsWhere,
        _count: true,
      }),
      prisma.reviewCard.count({
        where: {
          ...statsWhere,
          nextDueAt: {
            lte: new Date(
              new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }) +
                "T23:59:59+08:00"
            ),
          },
        },
      }),
    ]);

    const byStatus: Record<string, number> = {
      NEW: 0,
      LEARNING: 0,
      REVIEW: 0,
      MASTERED: 0,
    };
    for (const s of statusCounts) {
      byStatus[s.status] = s._count;
    }

    const stats = {
      totalCards,
      dueToday,
      byStatus,
      masteryRate:
        totalCards > 0
          ? Math.round((byStatus.MASTERED / totalCards) * 100 * 100) / 100
          : 0,
    };

    if (statsOnly) {
      return NextResponse.json({ stats });
    }

    // Fetch cards
    const cards = await prisma.reviewCard.findMany({
      where,
      include: {
        question: {
          select: {
            id: true,
            stem: true,
            type: true,
            options: true,
            answer: true,
            explanation: true,
            wrongOptionExplanations: true,
            difficulty: true,
            questionBankId: true,
            questionBank: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ nextDueAt: "asc" }],
      take: limit,
    });

    // Parse JSON fields
    const parsed = cards.map((c) => ({
      ...c,
      question: {
        ...c.question,
        options: safeJsonParse(c.question.options, []),
        wrongOptionExplanations: c.question.wrongOptionExplanations
          ? safeJsonParse(c.question.wrongOptionExplanations, null)
          : null,
      },
    }));

    return NextResponse.json({ cards: parsed, stats });
  } catch (error) {
    console.error("GET /api/review-cards error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review cards" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/review-cards — Manually add a question to review
 * Body: { questionId }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId } = await req.json();
    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    // Verify question exists and user has access
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { questionBank: { select: { isPublic: true, createdById: true } } },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && !question.questionBank.isPublic && question.questionBank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Upsert — if already exists, just return it
    const card = await prisma.reviewCard.upsert({
      where: {
        userId_questionId: {
          userId: session.user.id,
          questionId,
        },
      },
      create: {
        userId: session.user.id,
        questionId,
        status: "NEW",
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        nextDueAt: new Date(),
      },
      update: {}, // no-op if exists
    });

    return NextResponse.json({ card, created: true });
  } catch (error) {
    console.error("POST /api/review-cards error:", error);
    return NextResponse.json(
      { error: "Failed to add review card" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/review-cards — Remove a question from review
 * Body: { questionId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId } = await req.json();
    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    await prisma.reviewCard.deleteMany({
      where: {
        userId: session.user.id,
        questionId,
      },
    });

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("DELETE /api/review-cards error:", error);
    return NextResponse.json(
      { error: "Failed to remove review card" },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse(str: string, fallback: any) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
