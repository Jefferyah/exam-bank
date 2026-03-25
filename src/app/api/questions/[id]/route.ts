import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        questionBank: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...question,
      options: JSON.parse(question.options),
      tags: JSON.parse(question.tags),
      wrongOptionExplanations: question.wrongOptionExplanations
        ? JSON.parse(question.wrongOptionExplanations)
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

    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

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
    if (questionBankId !== undefined) data.questionBankId = questionBankId;
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
      options: JSON.parse(question.options),
      tags: JSON.parse(question.tags),
      wrongOptionExplanations: question.wrongOptionExplanations
        ? JSON.parse(question.wrongOptionExplanations)
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

    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
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
