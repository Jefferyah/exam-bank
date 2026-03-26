import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: session.user.id };
    const validStatuses = ["IN_PROGRESS", "COMPLETED", "ABANDONED"];
    if (status) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Must be IN_PROGRESS, COMPLETED, or ABANDONED" },
          { status: 400 }
        );
      }
      where.status = status;
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          _count: { select: { answers: true } },
        },
      }),
      prisma.exam.count({ where }),
    ]);

    const parsed = exams.map((e) => ({
      ...e,
      config: JSON.parse(e.config),
    }));

    return NextResponse.json({
      exams: parsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/exams error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exams" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      questionBankIds,
      difficulty,
      count = 20,
      mode = "PRACTICE",
      timeLimit,
      wrongOnly = false,
      favoriteOnly = false,
      notedOnly = false,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    // Build question filter
    const questionWhere: Record<string, unknown> = {};
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    if (questionBankIds && questionBankIds.length > 0) {
      // Verify user has access to all specified question banks
      if (!isAdmin) {
        const accessibleBanks = await prisma.questionBank.findMany({
          where: {
            id: { in: questionBankIds },
            OR: [
              { createdById: session.user.id },
              { isPublic: true },
            ],
          },
          select: { id: true },
        });
        const accessibleIds = new Set(accessibleBanks.map((b) => b.id));
        const forbidden = questionBankIds.filter((id: string) => !accessibleIds.has(id));
        if (forbidden.length > 0) {
          return NextResponse.json(
            { error: "You do not have access to some of the specified question banks" },
            { status: 403 }
          );
        }
      }
      questionWhere.questionBankId = { in: questionBankIds };
    } else if (!isAdmin) {
      // No specific banks requested — limit to accessible banks
      questionWhere.questionBank = {
        OR: [
          { createdById: session.user.id },
          { isPublic: true },
        ],
      };
    }
    if (difficulty) {
      if (Array.isArray(difficulty)) {
        questionWhere.difficulty = { in: difficulty };
      } else {
        questionWhere.difficulty = difficulty;
      }
    }

    // Filter for wrong-only questions
    if (wrongOnly) {
      const wrongRecords = await prisma.wrongRecord.findMany({
        where: { userId: session.user.id },
        select: { questionId: true },
      });
      const wrongIds = wrongRecords.map((r) => r.questionId);
      if (wrongIds.length === 0) {
        return NextResponse.json(
          { error: "No wrong records found" },
          { status: 400 }
        );
      }
      questionWhere.id = { in: wrongIds };
    }

    // Filter for favorite-only questions
    if (favoriteOnly) {
      const favorites = await prisma.favorite.findMany({
        where: { userId: session.user.id },
        select: { questionId: true },
      });
      const favIds = favorites.map((f) => f.questionId);
      if (favIds.length === 0) {
        return NextResponse.json(
          { error: "No favorites found" },
          { status: 400 }
        );
      }
      if (questionWhere.id) {
        const existingIds = (questionWhere.id as { in: string[] }).in;
        questionWhere.id = { in: existingIds.filter((id: string) => favIds.includes(id)) };
      } else {
        questionWhere.id = { in: favIds };
      }
    }

    // Filter for noted-only questions
    if (notedOnly) {
      const notes = await prisma.note.findMany({
        where: { userId: session.user.id },
        select: { questionId: true },
      });
      const noteIds = notes.map((n) => n.questionId);
      if (noteIds.length === 0) {
        return NextResponse.json(
          { error: "No noted questions found" },
          { status: 400 }
        );
      }
      if (questionWhere.id) {
        const existingIds = (questionWhere.id as { in: string[] }).in;
        questionWhere.id = { in: existingIds.filter((id: string) => noteIds.includes(id)) };
      } else {
        questionWhere.id = { in: noteIds };
      }
    }

    // Get total matching questions count
    const totalAvailable = await prisma.question.count({ where: questionWhere });
    const actualCount = Math.min(count, totalAvailable);

    if (actualCount === 0) {
      return NextResponse.json(
        { error: "No questions match the specified criteria" },
        { status: 400 }
      );
    }

    // Randomly select questions using a shuffle approach
    const allMatchingQuestions = await prisma.question.findMany({
      where: questionWhere,
      select: { id: true },
    });

    // Fisher-Yates shuffle and take first N
    const shuffled = [...allMatchingQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedQuestions = shuffled.slice(0, actualCount);

    const config = {
      questionBankIds: questionBankIds || [],
      difficulty: difficulty || null,
      count: actualCount,
      mode,
      timeLimit: timeLimit || null,
      wrongOnly,
      favoriteOnly,
      notedOnly,
    };

    // Create exam with answers in a transaction
    const exam = await prisma.exam.create({
      data: {
        userId: session.user.id,
        title,
        mode,
        config: JSON.stringify(config),
        timeLimit: timeLimit || null,
        answers: {
          create: selectedQuestions.map((q, index) => ({
            questionId: q.id,
            order: index + 1,
          })),
        },
      },
      include: {
        answers: {
          include: { question: true },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        ...exam,
        config: JSON.parse(exam.config),
        answers: exam.answers.map((a) => ({
          ...a,
          question: {
            ...a.question,
            options: JSON.parse(a.question.options),
            tags: JSON.parse(a.question.tags),
            wrongOptionExplanations: a.question.wrongOptionExplanations
              ? JSON.parse(a.question.wrongOptionExplanations)
              : null,
          },
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/exams error:", error);
    return NextResponse.json(
      { error: "Failed to create exam" },
      { status: 500 }
    );
  }
}
