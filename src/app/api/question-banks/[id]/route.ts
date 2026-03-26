import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET single question bank with stats
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!bank) {
      return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
    }

    // Non-admin users can only see their own banks or public banks
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && !bank.isPublic && bank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(bank);
  } catch (error) {
    console.error("GET /api/question-banks/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch question bank" }, { status: 500 });
  }
}

// PUT update question bank
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
    const body = await req.json();
    const { name, description, isPublic } = body;

    const bank = await prisma.questionBank.findUnique({ where: { id } });
    if (!bank) {
      return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
    }

    // Only creator or admin can update
    if (bank.createdById !== session.user.id && (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const updated = await prisma.questionBank.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/question-banks/[id] error:", error);
    return NextResponse.json({ error: "Failed to update question bank" }, { status: 500 });
  }
}

// DELETE question bank (cascades to all questions)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });

    if (!bank) {
      return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
    }

    // Only creator or admin can delete
    if (bank.createdById !== session.user.id && (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Delete all questions first (explicit for DBs without cascade), then the bank
    await prisma.question.deleteMany({ where: { questionBankId: id } });
    await prisma.questionBank.delete({ where: { id } });

    return NextResponse.json({
      message: "Question bank deleted successfully",
      deletedQuestions: bank._count.questions,
    });
  } catch (error) {
    console.error("DELETE /api/question-banks/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete question bank" }, { status: 500 });
  }
}
