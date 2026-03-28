import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";
import { getEffectiveTagsMap } from "@/lib/effective-tags";
import { autoRateFromExamAnswer, computeNextState, type CardStatus } from "@/lib/srs";

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
  id: string;
  config: string;
  answers: Array<{
    question: {
      id: string;
      options: string;
      tags: string;
      wrongOptionExplanations: string | null;
    };
  }>;
} & Record<string, unknown>, tagOverrideMap?: Map<string, string[]>) {
  const config = safeJsonParse(exam.config, {}) as Record<string, unknown>;
  const shouldShuffle = config.shuffleOptions === true;
  return {
    ...exam,
    config,
    answers: exam.answers.map((a) => {
      let options = safeJsonParse(a.question.options, []);
      if (shouldShuffle && Array.isArray(options) && options.length > 1) {
        const seed = hashSeed(exam.id + a.question.id);
        options = seededShuffle(options, seed);
      }
      return {
        ...a,
        question: {
          ...a.question,
          options,
          tags: tagOverrideMap?.get(a.question.id) ?? safeJsonParse(a.question.tags, []),
          wrongOptionExplanations: a.question.wrongOptionExplanations
            ? safeJsonParse(a.question.wrongOptionExplanations, null)
            : null,
        },
      };
    }),
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

    // Auto-recover exams stuck in COMPLETING for > 5 minutes (server crash recovery)
    // Use exam.updatedAt which is auto-set when status changes to COMPLETING
    if (exam.status === "COMPLETING") {
      const stuckThreshold = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - exam.updatedAt.getTime() > stuckThreshold) {
        await prisma.exam.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
        exam.status = "IN_PROGRESS";
      }
    }

    // Load user tag overrides for all questions in this exam
    const tagOverrideMap = await getEffectiveTagsMap(
      exam.answers.map((a) => a.question.id),
      session.user.id
    );

    return NextResponse.json(serializeExam(exam, tagOverrideMap));
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

    // Auto-recover stuck COMPLETING state (server crash recovery)
    if (exam.status === "COMPLETING") {
      const stuckThreshold = 5 * 60 * 1000;
      if (Date.now() - exam.updatedAt.getTime() > stuckThreshold) {
        await prisma.exam.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
        exam.status = "IN_PROGRESS";
      }
    }

    if (exam.status === "COMPLETED" || exam.status === "COMPLETING") {
      return NextResponse.json(
        { error: "此考試已完成或正在處理中，無法修改" },
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

      // ── Auto-feed SRS review cards (best-effort, non-blocking) ──
      // Uses interactive transaction to upsert cards and create logs atomically.
      try {
        const answeredQuestions = updatedAnswers.filter((a) => a.userAnswer != null);

        // Compute average time for auto-rating
        const withTime = answeredQuestions.filter((a) => (a.timeSpent ?? 0) > 0);
        const avgTime =
          withTime.length > 0
            ? withTime.reduce((s, a) => s + (a.timeSpent ?? 0), 0) / withTime.length
            : 60;

        // Fetch existing review cards for these questions
        const existingCards = await prisma.reviewCard.findMany({
          where: {
            userId: session.user!.id!,
            questionId: { in: answeredQuestions.map((a) => a.questionId) },
          },
        });
        const cardMap = new Map(existingCards.map((c) => [c.questionId, c]));

        // Interactive transaction: upsert each card then immediately create its log
        await prisma.$transaction(async (tx) => {
          for (const answer of answeredQuestions) {
            const rating = autoRateFromExamAnswer(answer.isCorrect, answer.timeSpent, avgTime);
            const existing = cardMap.get(answer.questionId);

            const currentState = existing
              ? {
                  status: existing.status as CardStatus,
                  interval: existing.interval,
                  easeFactor: existing.easeFactor,
                  repetitions: existing.repetitions,
                  lapses: existing.lapses,
                }
              : {
                  status: "NEW" as CardStatus,
                  interval: 1,
                  easeFactor: 2.5,
                  repetitions: 0,
                  lapses: 0,
                };

            const next = computeNextState(currentState, rating);

            // Upsert review card — returns the card with its ID
            const card = await tx.reviewCard.upsert({
              where: {
                userId_questionId: {
                  userId: session.user!.id!,
                  questionId: answer.questionId,
                },
              },
              create: {
                userId: session.user!.id!,
                questionId: answer.questionId,
                status: next.status,
                interval: next.interval,
                easeFactor: next.easeFactor,
                repetitions: next.repetitions,
                lapses: next.lapses,
                nextDueAt: next.nextDueAt,
                lastReviewedAt: new Date(),
              },
              update: {
                status: next.status,
                interval: next.interval,
                easeFactor: next.easeFactor,
                repetitions: next.repetitions,
                lapses: next.lapses,
                nextDueAt: next.nextDueAt,
                lastReviewedAt: new Date(),
              },
            });

            // Create review log (always has card.id now, even for new cards)
            await tx.reviewLog.create({
              data: {
                userId: session.user!.id!,
                questionId: answer.questionId,
                reviewCardId: card.id,
                rating,
                intervalBefore: existing?.interval ?? 1,
                intervalAfter: next.interval,
                examAnswerId: answer.id,
              },
            });
          }
        });
      } catch (srsError) {
        // SRS failures should never break exam completion
        console.error("SRS auto-feed error (non-fatal):", srsError);
      }

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

      const completedTagMap = await getEffectiveTagsMap(
        completedExam!.answers.map((a) => a.question.id),
        session.user.id
      );
      return NextResponse.json(serializeExam(completedExam!, completedTagMap));
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

    const updatedTagMap = await getEffectiveTagsMap(
      updatedExam!.answers.map((a) => a.question.id),
      session.user.id
    );
    return NextResponse.json(serializeExam(updatedExam!, updatedTagMap));
  } catch (error) {
    console.error("PUT /api/exams/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update exam" },
      { status: 500 }
    );
  }
}
