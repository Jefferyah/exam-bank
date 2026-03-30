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

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const questionId = searchParams.get("questionId");

    // Exclude hidden banks
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: session.user.id };

    if (questionId) {
      where.questionId = questionId;
    }

    if (hiddenBankIds.length > 0) {
      where.question = { questionBank: { id: { notIn: hiddenBankIds } } };
    }

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          question: true,
        },
      }),
      prisma.favorite.count({ where }),
    ]);

    const parsed = favorites.map((f) => ({
      ...f,
      question: {
        ...f.question,
        options: safeJsonParse(f.question.options, []),
        tags: safeJsonParse(f.question.tags, []),
        wrongOptionExplanations: f.question.wrongOptionExplanations
          ? safeJsonParse(f.question.wrongOptionExplanations, null)
          : null,
      },
    }));

    return NextResponse.json({
      favorites: parsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
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
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: "Missing required field: questionId" },
        { status: 400 }
      );
    }

    // Verify question exists and user has access
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { questionBank: { select: { isPublic: true, createdById: true } } },
    });
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && !question.questionBank.isPublic && question.questionBank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Toggle: check if favorite already exists
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_questionId: {
          userId: session.user.id,
          questionId,
        },
      },
    });

    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({
        favorited: false,
        message: "Favorite removed",
      });
    } else {
      // Add favorite — handle race condition where duplicate request arrives
      try {
        const favorite = await prisma.favorite.create({
          data: {
            userId: session.user.id,
            questionId,
          },
        });
        return NextResponse.json(
          {
            favorited: true,
            favorite,
            message: "Favorite added",
          },
          { status: 201 }
        );
      } catch (createError: unknown) {
        // Unique constraint violation → another request already created it, treat as toggle-off
        if (createError && typeof createError === "object" && "code" in createError && (createError as { code: string }).code === "P2002") {
          await prisma.favorite.deleteMany({
            where: { userId: session.user.id, questionId },
          });
          return NextResponse.json({
            favorited: false,
            message: "Favorite removed",
          });
        }
        throw createError;
      }
    }
  } catch (error) {
    console.error("POST /api/favorites error:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}
