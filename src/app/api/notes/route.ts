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

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          question: {
            select: {
              id: true,
              stem: true,
              questionBankId: true,
              difficulty: true,
              type: true,
              questionBank: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.note.count({ where }),
    ]);

    return NextResponse.json({
      notes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
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
    const { questionId, content } = body;

    if (!questionId || !content) {
      return NextResponse.json(
        { error: "Missing required fields: questionId, content" },
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

    // Upsert: create or update note for this user+question
    const note = await prisma.note.upsert({
      where: {
        userId_questionId: {
          userId: session.user.id,
          questionId,
        },
      },
      create: {
        userId: session.user.id,
        questionId,
        content,
      },
      update: {
        content,
      },
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
    });

    return NextResponse.json(note, { status: 200 });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
