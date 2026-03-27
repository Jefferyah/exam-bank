import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        questionBank: { select: { id: true, name: true, isPublic: true, createdById: true } },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only see questions from their own banks or public banks
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && !question.questionBank.isPublic && question.questionBank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ...question,
      options: safeJsonParse(question.options, []),
      tags: safeJsonParse(question.tags, []),
      wrongOptionExplanations: question.wrongOptionExplanations
        ? safeJsonParse(question.wrongOptionExplanations, null)
        : null,
    });
  } catch (error) {
    console.error("GET /api/questions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.question.findUnique({
      where: { id },
      include: { questionBank: { select: { createdById: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    const isOwner = existing.createdById === session.user.id || existing.questionBank.createdById === session.user.id;

    const body = await req.json();
    const {
      stem,
      type,
      options,
      answer,
      explanation,
      wrongOptionExplanations,
      extendedKnowledge,
      questionBankId,
      category,
      chapter,
      difficulty,
      tags,
    } = body;

    // Tags can be updated by any authenticated user; other fields require owner/admin
    const isTagsOnly = tags !== undefined && [stem, type, options, answer, explanation, wrongOptionExplanations, extendedKnowledge, questionBankId, category, chapter, difficulty].every((v) => v === undefined);
    if (!isTagsOnly && !isAdmin && !isOwner) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (stem !== undefined) data.stem = stem;
    if (type !== undefined) data.type = type;
    if (options !== undefined) {
      data.options = typeof options === "string" ? options : JSON.stringify(options);
    }
    if (answer !== undefined) data.answer = answer;
    if (explanation !== undefined) data.explanation = explanation;
    if (wrongOptionExplanations !== undefined) {
      data.wrongOptionExplanations = wrongOptionExplanations
        ? typeof wrongOptionExplanations === "string"
          ? wrongOptionExplanations
          : JSON.stringify(wrongOptionExplanations)
        : null;
    }
    if (extendedKnowledge !== undefined) data.extendedKnowledge = extendedKnowledge;
    if (questionBankId !== undefined && questionBankId !== existing.questionBankId) {
      // Verify user has write access to the TARGET bank
      const targetBank = await prisma.questionBank.findUnique({
        where: { id: questionBankId },
        select: { createdById: true },
      });
      if (!targetBank) {
        return NextResponse.json({ error: "目標題庫不存在" }, { status: 404 });
      }
      if (!isAdmin && targetBank.createdById !== session.user.id) {
        return NextResponse.json(
          { error: "你沒有權限將題目移到該題庫" },
          { status: 403 }
        );
      }
      data.questionBankId = questionBankId;
    }
    if (category !== undefined) data.category = category;
    if (chapter !== undefined) data.chapter = chapter;
    if (difficulty !== undefined) data.difficulty = difficulty;
    if (tags !== undefined) {
      data.tags = typeof tags === "string" ? tags : JSON.stringify(tags);
    }
    data.version = existing.version + 1;

    const question = await prisma.question.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...question,
      options: safeJsonParse(question.options, []),
      tags: safeJsonParse(question.tags, []),
      wrongOptionExplanations: question.wrongOptionExplanations
        ? safeJsonParse(question.wrongOptionExplanations, null)
        : null,
    });
  } catch (error) {
    console.error("PUT /api/questions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.question.findUnique({
      where: { id },
      include: { questionBank: { select: { createdById: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Only the bank creator or admin can delete questions
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && existing.createdById !== session.user.id && existing.questionBank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    await prisma.question.delete({ where: { id } });

    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/questions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}
