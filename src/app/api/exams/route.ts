import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash >>> 0;
}

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
      config: safeJsonParse(e.config, {}),
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
      untriedOnly = false,
      tags: filterTags,
      chapters: filterChapters,
      shuffleOptions = false,
      shuffleQuestions = true,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    // Validate count is a positive integer
    const parsedCount = Number(count);
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      return NextResponse.json(
        { error: "count must be a positive integer" },
        { status: 400 }
      );
    }

    // Build question filter
    const questionWhere: Record<string, unknown> = {};
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // Get user's hidden banks to exclude from exam
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = new Set(hiddenBanks.map((h) => h.questionBankId));

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
      // No specific banks requested — limit to accessible, non-hidden banks
      questionWhere.questionBank = {
        AND: [
          {
            OR: [
              { createdById: session.user.id },
              { isPublic: true },
            ],
          },
          ...(hiddenBankIds.size > 0
            ? [{ id: { notIn: [...hiddenBankIds] } }]
            : []),
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

    // Filter by tags (AND logic — questions must contain ALL specified tags)
    if (filterTags && Array.isArray(filterTags) && filterTags.length > 0) {
      questionWhere.AND = filterTags.map((tag: string) => ({
        tags: { contains: tag },
      }));
    }

    // Filter by chapters
    if (filterChapters && Array.isArray(filterChapters) && filterChapters.length > 0) {
      questionWhere.chapter = { in: filterChapters };
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

    // Filter for untried-only questions (never answered by this user)
    if (untriedOnly) {
      const triedAnswers = await prisma.examAnswer.findMany({
        where: {
          exam: { userId: session.user.id },
          userAnswer: { not: null },
        },
        select: { questionId: true },
        distinct: ["questionId"],
      });
      const triedIds = new Set(triedAnswers.map((a) => a.questionId));

      if (triedIds.size > 0) {
        if (questionWhere.id) {
          // Intersect with existing id filter
          const existingIds = (questionWhere.id as { in: string[] }).in;
          questionWhere.id = { in: existingIds.filter((id: string) => !triedIds.has(id)) };
        } else {
          questionWhere.id = { notIn: [...triedIds] };
        }
      }
    }

    // Get total matching questions count
    const totalAvailable = await prisma.question.count({ where: questionWhere });
    const actualCount = Math.min(parsedCount, totalAvailable);

    if (actualCount === 0) {
      return NextResponse.json(
        { error: "No questions match the specified criteria" },
        { status: 400 }
      );
    }

    // Select questions — shuffle or keep original order
    const allMatchingQuestions = await prisma.question.findMany({
      where: questionWhere,
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    let selectedQuestions: { id: string }[];
    if (shuffleQuestions) {
      // Fisher-Yates shuffle and take first N
      const shuffled = [...allMatchingQuestions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      selectedQuestions = shuffled.slice(0, actualCount);
    } else {
      // Keep original order, take first N
      selectedQuestions = allMatchingQuestions.slice(0, actualCount);
    }

    const config = {
      questionBankIds: questionBankIds || [],
      difficulty: difficulty || null,
      requestedCount: parsedCount,
      count: actualCount,
      mode,
      timeLimit: timeLimit || null,
      wrongOnly,
      favoriteOnly,
      notedOnly,
      untriedOnly,
      tags: filterTags || [],
      shuffleOptions,
      shuffleQuestions,
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
        config: safeJsonParse(exam.config, {}),
        answers: exam.answers.map((a) => {
          let options = safeJsonParse(a.question.options, []);
          if (shuffleOptions && Array.isArray(options) && options.length > 1) {
            const seed = hashSeed(exam.id + a.question.id);
            options = seededShuffle(options, seed);
          }
          return {
          ...a,
          question: {
            ...a.question,
            options,
            tags: safeJsonParse(a.question.tags, []),
            wrongOptionExplanations: a.question.wrongOptionExplanations
              ? safeJsonParse(a.question.wrongOptionExplanations, null)
              : null,
          },
        };
        }),
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
