import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";

function normalizeAnswerSet(answer: string | null | undefined) {
  return (answer || "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

function isAnswerCorrect(userAnswer: string | null | undefined, correctAnswer: string) {
  const userParts = normalizeAnswerSet(userAnswer);
  const correctParts = normalizeAnswerSet(correctAnswer);

  if (userParts.length === 0 || userParts.length !== correctParts.length) {
    return false;
  }

  return userParts.every((part, index) => part === correctParts[index]);
}

function serializeExam(exam: {
  config: string;
  answers: Array<{
    question: {
      options: string;
      tags: string;
      wrongOptionExplanations: string | null;
    };
  }>;
} & Record<string, unknown>) {
  return {
    ...exam,
    config: safeJsonParse(exam.config, {}),
    answers: exam.answers.map((a) => ({
      ...a,
      question: {
        ...a.question,
        options: safeJsonParse(a.question.options, []),
        tags: safeJsonParse(a.question.tags, []),
        wrongOptionExplanations: a.question.wrongOptionExplanations
          ? safeJsonParse(a.question.wrongOptionExplanations, null)
          : null,
      },
    })),
  };
}

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

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        answers: {
          include: { question: { include: { questionBank: { select: { name: true } } } } },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(serializeExam(exam));
  } catch (error) {
    console.error("GET /api/exams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exam" },
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

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        answers: {
          include: { question: { include: { questionBank: { select: { name: true } } } } },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (exam.status === "COMPLETED" || exam.status === "COMPLETING") {
      return NextResponse.json(
        { error: "此考試已完成，無法修改" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { answers: submittedAnswers, finish = false } = body;

    // Update individual answers if provided — use transaction for atomicity
    if (submittedAnswers && Array.isArray(submittedAnswers)) {
      const updates = [];
      for (const submitted of submittedAnswers) {
        const { questionId, userAnswer, timeSpent, flagged } = submitted;

        const examAnswer = exam.answers.find(
          (a) => a.questionId === questionId
        );
        if (!examAnswer) continue;

        const question = examAnswer.question;

        const data: Record<string, unknown> = {};
        if (userAnswer != null) {
          data.userAnswer = userAnswer.toString();
          data.isCorrect = isAnswerCorrect(userAnswer.toString(), question.answer);
        }
        if (timeSpent != null) data.timeSpent = timeSpent;
        if (flagged != null) data.flagged = flagged;

        if (Object.keys(data).length > 0) {
          updates.push(
            prisma.examAnswer.update({
              where: { id: examAnswer.id },
              data,
            })
          );
        }
      }
      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }
    }

    // Finish exam: calculate score and update wrong records
    if (finish) {
      // Optimistic lock: atomically set status to COMPLETED, fail if already completed
      const lockResult = await prisma.exam.updateMany({
        where: { id, status: "IN_PROGRESS" },
        data: { status: "COMPLETING" },
      });
      if (lockResult.count === 0) {
        return NextResponse.json(
          { error: "此考試已完成或正在處理中" },
          { status: 400 }
        );
      }

      const updatedAnswers = await prisma.examAnswer.findMany({
        where: { examId: id },
        include: { question: { include: { questionBank: { select: { name: true } } } } },
      });

      const correctCount = updatedAnswers.filter(
        (a) => a.isCorrect === true
      ).length;
      const totalQuestions = updatedAnswers.length;
      const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      // Update wrong records for incorrect answers
      const wrongAnswers = updatedAnswers.filter(
        (a) => a.isCorrect === false
      );

      // Batch wrong record upserts in transaction
      const wrongOps = wrongAnswers.map((wrong) =>
        prisma.wrongRecord.upsert({
          where: {
            userId_questionId: {
              userId: session.user!.id!,
              questionId: wrong.questionId,
            },
          },
          create: {
            userId: session.user!.id!,
            questionId: wrong.questionId,
            count: 1,
            lastWrongAt: new Date(),
          },
          update: {
            count: { increment: 1 },
            lastWrongAt: new Date(),
          },
        })
      );

      await prisma.$transaction([
        ...wrongOps,
        prisma.exam.update({
          where: { id },
          data: {
            status: "COMPLETED",
            score,
            finishedAt: new Date(),
          },
        }),
      ]);

      // Refetch for serialization
      const completedExam = await prisma.exam.findUnique({
        where: { id },
        include: {
          answers: {
            include: { question: { include: { questionBank: { select: { name: true } } } } },
            orderBy: { order: "asc" },
          },
        },
      });

      return NextResponse.json(serializeExam(completedExam!));
    }

    // Return updated exam without finishing
    const updatedExam = await prisma.exam.findUnique({
      where: { id },
      include: {
        answers: {
          include: { question: { include: { questionBank: { select: { name: true } } } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(serializeExam(updatedExam!));
  } catch (error) {
    console.error("PUT /api/exams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update exam" },
      { status: 500 }
    );
  }
}
