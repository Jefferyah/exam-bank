import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
          include: { question: true },
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

    return NextResponse.json({
      ...exam,
      config: JSON.parse(exam.config),
      answers: exam.answers.map((a) => ({
        ...a,
        question: {
          ...a.question,
          options: JSON.parse(a.question.options),
          tags: JSON.parse(a.question.tags),
          wrongOptionExplanations: a.question.wrongOptionExplanations
            ? JSON.parse(a.question.wrongOptionExplanations)
            : null,
        },
      })),
    });
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
          include: { question: true },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { answers: submittedAnswers, finish = false } = body;

    // Update individual answers if provided
    if (submittedAnswers && Array.isArray(submittedAnswers)) {
      for (const submitted of submittedAnswers) {
        const { questionId, userAnswer, timeSpent, flagged } = submitted;

        const examAnswer = exam.answers.find(
          (a) => a.questionId === questionId
        );
        if (!examAnswer) continue;

        const question = examAnswer.question;
        const isCorrect =
          userAnswer != null
            ? userAnswer.toString().toUpperCase() === question.answer.toUpperCase()
            : null;

        await prisma.examAnswer.update({
          where: { id: examAnswer.id },
          data: {
            userAnswer: userAnswer ?? examAnswer.userAnswer,
            isCorrect,
            timeSpent: timeSpent ?? examAnswer.timeSpent,
            flagged: flagged ?? examAnswer.flagged,
          },
        });
      }
    }

    // Finish exam: calculate score and update wrong records
    if (finish) {
      const updatedAnswers = await prisma.examAnswer.findMany({
        where: { examId: id },
        include: { question: true },
      });

      const totalAnswered = updatedAnswers.filter(
        (a) => a.userAnswer != null
      ).length;
      const correctCount = updatedAnswers.filter(
        (a) => a.isCorrect === true
      ).length;
      const score = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

      // Update wrong records for incorrect answers
      const wrongAnswers = updatedAnswers.filter(
        (a) => a.isCorrect === false
      );

      for (const wrong of wrongAnswers) {
        await prisma.wrongRecord.upsert({
          where: {
            userId_questionId: {
              userId: session.user.id,
              questionId: wrong.questionId,
            },
          },
          create: {
            userId: session.user.id,
            questionId: wrong.questionId,
            count: 1,
            lastWrongAt: new Date(),
          },
          update: {
            count: { increment: 1 },
            lastWrongAt: new Date(),
          },
        });
      }

      const finishedExam = await prisma.exam.update({
        where: { id },
        data: {
          status: "COMPLETED",
          score,
          finishedAt: new Date(),
        },
        include: {
          answers: {
            include: { question: true },
            orderBy: { order: "asc" },
          },
        },
      });

      return NextResponse.json({
        ...finishedExam,
        config: JSON.parse(finishedExam.config),
        answers: finishedExam.answers.map((a) => ({
          ...a,
          question: {
            ...a.question,
            options: JSON.parse(a.question.options),
            tags: JSON.parse(a.question.tags),
            wrongOptionExplanations: a.question.wrongOptionExplanations
              ? JSON.parse(a.question.wrongOptionExplanations)
              : null,
          },
        })),
      });
    }

    // Return updated exam without finishing
    const updatedExam = await prisma.exam.findUnique({
      where: { id },
      include: {
        answers: {
          include: { question: true },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({
      ...updatedExam!,
      config: JSON.parse(updatedExam!.config),
      answers: updatedExam!.answers.map((a) => ({
        ...a,
        question: {
          ...a.question,
          options: JSON.parse(a.question.options),
          tags: JSON.parse(a.question.tags),
          wrongOptionExplanations: a.question.wrongOptionExplanations
            ? JSON.parse(a.question.wrongOptionExplanations)
            : null,
        },
      })),
    });
  } catch (error) {
    console.error("PUT /api/exams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update exam" },
      { status: 500 }
    );
  }
}
