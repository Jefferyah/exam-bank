import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
      select: { id: true, name: true, createdById: true },
    });

    if (!bank) {
      return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
    }

    // Only owner or admin can view impact
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && bank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all question IDs in this bank
    const questions = await prisma.question.findMany({
      where: { questionBankId: id },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    if (questionIds.length === 0) {
      return NextResponse.json({
        bankName: bank.name,
        questionCount: 0,
        affectedUsers: 0,
        examCount: 0,
        examAnswerCount: 0,
        noteCount: 0,
        favoriteCount: 0,
        wrongRecordCount: 0,
      });
    }

    // Count all affected data in parallel
    const [examAnswerCount, noteCount, favoriteCount, wrongRecordCount] =
      await Promise.all([
        prisma.examAnswer.count({
          where: { questionId: { in: questionIds } },
        }),
        prisma.note.count({
          where: { questionId: { in: questionIds } },
        }),
        prisma.favorite.count({
          where: { questionId: { in: questionIds } },
        }),
        prisma.wrongRecord.count({
          where: { questionId: { in: questionIds } },
        }),
      ]);

    // Count distinct affected users and exams
    const affectedExams = await prisma.examAnswer.findMany({
      where: { questionId: { in: questionIds } },
      select: { examId: true, exam: { select: { userId: true } } },
      distinct: ["examId"],
    });

    const affectedUserIds = new Set(affectedExams.map((a) => a.exam.userId));

    return NextResponse.json({
      bankName: bank.name,
      questionCount: questionIds.length,
      affectedUsers: affectedUserIds.size,
      examCount: affectedExams.length,
      examAnswerCount,
      noteCount,
      favoriteCount,
      wrongRecordCount,
    });
  } catch (error) {
    console.error("GET /api/question-banks/[id]/impact error:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact data" },
      { status: 500 }
    );
  }
}
