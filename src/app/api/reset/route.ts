import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { scope, questionBankId } = body;

    if (!scope || !["all", "wrong", "exams"].includes(scope)) {
      return NextResponse.json(
        { error: "Invalid scope. Must be 'all', 'wrong', or 'exams'" },
        { status: 400 }
      );
    }

    let deleted: Record<string, number> = {};

    if (scope === "all") {
      // Delete all user learning data
      const [examAnswers, exams, wrongRecords, userDifficulties, notes, favorites] =
        await prisma.$transaction([
          prisma.examAnswer.deleteMany({
            where: { exam: { userId } },
          }),
          prisma.exam.deleteMany({ where: { userId } }),
          prisma.wrongRecord.deleteMany({ where: { userId } }),
          prisma.userDifficulty.deleteMany({ where: { userId } }),
          prisma.note.deleteMany({ where: { userId } }),
          prisma.favorite.deleteMany({ where: { userId } }),
        ]);

      deleted = {
        examAnswers: examAnswers.count,
        exams: exams.count,
        wrongRecords: wrongRecords.count,
        userDifficulties: userDifficulties.count,
        notes: notes.count,
        favorites: favorites.count,
      };
    } else if (scope === "wrong") {
      if (questionBankId) {
        // Delete wrong records for questions in a specific bank
        const questions = await prisma.question.findMany({
          where: { questionBankId },
          select: { id: true },
        });
        const questionIds = questions.map((q) => q.id);

        const result = await prisma.wrongRecord.deleteMany({
          where: {
            userId,
            questionId: { in: questionIds },
          },
        });
        deleted = { wrongRecords: result.count };
      } else {
        const result = await prisma.wrongRecord.deleteMany({
          where: { userId },
        });
        deleted = { wrongRecords: result.count };
      }
    } else if (scope === "exams") {
      if (questionBankId) {
        // Find exams whose config references the specific questionBankId
        const userExams = await prisma.exam.findMany({
          where: { userId },
          select: { id: true, config: true },
        });

        const matchingExamIds = userExams
          .filter((exam) => {
            try {
              const config = JSON.parse(exam.config);
              const bankIds: string[] = config.questionBankIds || [];
              return bankIds.includes(questionBankId);
            } catch {
              return false;
            }
          })
          .map((exam) => exam.id);

        if (matchingExamIds.length > 0) {
          const [answers, exams] = await prisma.$transaction([
            prisma.examAnswer.deleteMany({
              where: { examId: { in: matchingExamIds } },
            }),
            prisma.exam.deleteMany({
              where: { id: { in: matchingExamIds } },
            }),
          ]);
          deleted = { examAnswers: answers.count, exams: exams.count };
        } else {
          deleted = { examAnswers: 0, exams: 0 };
        }
      } else {
        const [answers, exams] = await prisma.$transaction([
          prisma.examAnswer.deleteMany({
            where: { exam: { userId } },
          }),
          prisma.exam.deleteMany({ where: { userId } }),
        ]);
        deleted = { examAnswers: answers.count, exams: exams.count };
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("POST /api/reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset learning records" },
      { status: 500 }
    );
  }
}
