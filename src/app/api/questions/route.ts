import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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

    // Non-admin users only see questions from their own banks
    if (!isAdmin) {
      where.questionBank = { createdById: session.user.id };
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
      options: JSON.parse(q.options),
      tags: JSON.parse(q.tags),
      wrongOptionExplanations: q.wrongOptionExplanations
        ? JSON.parse(q.wrongOptionExplanations)
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

    // Verify question bank exists
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!bank) {
      return NextResponse.json(
        { error: "Question bank not found" },
        { status: 404 }
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
        options: JSON.parse(question.options),
        tags: JSON.parse(question.tags),
        wrongOptionExplanations: question.wrongOptionExplanations
          ? JSON.parse(question.wrongOptionExplanations)
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
