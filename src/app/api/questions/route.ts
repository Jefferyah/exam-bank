import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || "";
    const questionBankId = searchParams.get("questionBankId");
    const difficulty = searchParams.get("difficulty");
    const type = searchParams.get("type");
    const tags = searchParams.get("tags");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {};

    // Exclude user's hidden banks
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    // Non-admin users see questions from their own banks + public banks
    if (!isAdmin) {
      where.questionBank = {
        OR: [
          { createdById: session.user.id },
          { isPublic: true },
        ],
        ...(hiddenBankIds.length > 0 ? { id: { notIn: hiddenBankIds } } : {}),
      };
    } else if (hiddenBankIds.length > 0) {
      where.questionBank = { id: { notIn: hiddenBankIds } };
    }

    if (search) {
      where.OR = [
        { stem: { contains: search } },
        { explanation: { contains: search } },
      ];
    }
    if (questionBankId) {
      where.questionBankId = questionBankId;
    }
    if (difficulty) {
      where.difficulty = parseInt(difficulty, 10);
    }
    if (type) {
      where.type = type;
    }
    if (tags) {
      where.tags = { contains: tags };
    }
    if (category) {
      where.category = { contains: category };
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          questionBank: { select: { id: true, name: true } },
        },
      }),
      prisma.question.count({ where }),
    ]);

    const parsed = questions.map((q) => ({
      ...q,
      options: safeJsonParse(q.options, []),
      tags: safeJsonParse(q.tags, []),
      wrongOptionExplanations: q.wrongOptionExplanations
        ? safeJsonParse(q.wrongOptionExplanations, null)
        : null,
    }));

    return NextResponse.json({
      questions: parsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/questions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
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

    // Only ADMIN and TEACHER can create questions
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json(
        { error: "只有管理員和教師可以建立題目" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      stem,
      type = "SINGLE",
      options,
      answer,
      explanation,
      wrongOptionExplanations,
      extendedKnowledge,
      questionBankId,
      category,
      chapter,
      difficulty = 3,
      tags = [],
    } = body;

    if (!stem || !options || !answer || !explanation || !questionBankId) {
      return NextResponse.json(
        { error: "Missing required fields: stem, options, answer, explanation, questionBankId" },
        { status: 400 }
      );
    }

    // Verify question bank exists and user has write access
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      select: { id: true, createdById: true, isPublic: true },
    });
    if (!bank) {
      return NextResponse.json(
        { error: "Question bank not found" },
        { status: 404 }
      );
    }
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && bank.createdById !== session.user.id) {
      return NextResponse.json(
        { error: "You do not have write access to this question bank" },
        { status: 403 }
      );
    }

    const question = await prisma.question.create({
      data: {
        stem,
        type,
        options: typeof options === "string" ? options : JSON.stringify(options),
        answer,
        explanation,
        wrongOptionExplanations: wrongOptionExplanations
          ? typeof wrongOptionExplanations === "string"
            ? wrongOptionExplanations
            : JSON.stringify(wrongOptionExplanations)
          : null,
        extendedKnowledge: extendedKnowledge || null,
        questionBankId,
        category: category || null,
        chapter: chapter || null,
        difficulty,
        tags: typeof tags === "string" ? tags : JSON.stringify(tags),
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      {
        ...question,
        options: safeJsonParse(question.options, []),
        tags: safeJsonParse(question.tags, []),
        wrongOptionExplanations: question.wrongOptionExplanations
          ? safeJsonParse(question.wrongOptionExplanations, null)
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/questions error:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}
