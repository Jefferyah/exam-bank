import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * POST /api/admin/migrate-srs
 *
 * One-time migration: convert existing WrongRecord entries into ReviewCards.
 * Also creates ReviewCards from ExamAnswer history for all users.
 * Admin only.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Migrate WrongRecords → ReviewCards (these are questions users got wrong)
    const wrongRecords = await prisma.wrongRecord.findMany();

    let migratedFromWrong = 0;
    let skipped = 0;

    // Process in batches of 100
    for (let i = 0; i < wrongRecords.length; i += 100) {
      const batch = wrongRecords.slice(i, i + 100);
      const ops = [];

      for (const wr of batch) {
        // Penalize ease based on wrong count
        const easeFactor = Math.max(1.3, 2.5 - 0.2 * Math.min(wr.count, 5));

        ops.push(
          prisma.reviewCard.upsert({
            where: {
              userId_questionId: {
                userId: wr.userId,
                questionId: wr.questionId,
              },
            },
            create: {
              userId: wr.userId,
              questionId: wr.questionId,
              status: "LEARNING",
              interval: 1,
              easeFactor,
              repetitions: 0,
              lapses: wr.count,
              nextDueAt: new Date(), // immediately due
            },
            update: {}, // don't overwrite if already exists
          })
        );
      }

      const results = await prisma.$transaction(ops);
      migratedFromWrong += results.length;
    }

    // 2. Migrate correct answers from completed exams (create cards for questions not yet tracked)
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    let migratedFromExams = 0;

    for (const u of allUsers) {
      // Get all unique questions this user has answered correctly
      const correctAnswers = await prisma.examAnswer.findMany({
        where: {
          exam: { userId: u.id, status: "COMPLETED" },
          isCorrect: true,
        },
        select: { questionId: true },
        distinct: ["questionId"],
      });

      // Get existing review cards for this user
      const existingCards = await prisma.reviewCard.findMany({
        where: { userId: u.id },
        select: { questionId: true },
      });
      const existingSet = new Set(existingCards.map((c) => c.questionId));

      // Create cards for questions not yet in review
      const newQuestionIds = correctAnswers
        .filter((a) => !existingSet.has(a.questionId))
        .map((a) => a.questionId);

      for (let i = 0; i < newQuestionIds.length; i += 100) {
        const batch = newQuestionIds.slice(i, i + 100);
        const ops = batch.map((qId) =>
          prisma.reviewCard.create({
            data: {
              userId: u.id,
              questionId: qId,
              status: "REVIEW",
              interval: 3,
              easeFactor: 2.5,
              repetitions: 1,
              lapses: 0,
              nextDueAt: new Date(Date.now() + 3 * 86400000), // due in 3 days
            },
          })
        );
        await prisma.$transaction(ops);
        migratedFromExams += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      migratedFromWrong,
      migratedFromExams,
      skipped,
      total: migratedFromWrong + migratedFromExams,
    });
  } catch (error) {
    console.error("POST /api/admin/migrate-srs error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 }
    );
  }
}
