import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateSuccessRate } from "@/lib/success-rate";

/**
 * GET /api/admin/stats
 * God-view stats for admins: per-user practice hours, question counts, accuracy
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get per-user exam stats in parallel
    const userIds = users.map((u) => u.id);

    const [examStats, activeToday] = await Promise.all([
      // Exam-level aggregation per user
      prisma.exam.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: "COMPLETED",
        },
        _count: { id: true },
        _sum: { score: true },
      }),

      // Users active today
      prisma.exam.findMany({
        where: {
          startedAt: {
            gte: (() => {
              const now = new Date();
              const todayKey = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
              return new Date(todayKey + "T00:00:00+08:00");
            })(),
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    // Build per-user answer stats with raw queries for better performance
    const answerAgg = await prisma.$queryRaw<
      { userId: string; totalAnswered: number; totalCorrect: number; totalTimeSpent: number }[]
    >`
      SELECT
        e."userId",
        COUNT(CASE WHEN ea."isCorrect" IS NOT NULL THEN 1 END)::int AS "totalAnswered",
        COUNT(CASE WHEN ea."isCorrect" = true THEN 1 END)::int AS "totalCorrect",
        COALESCE(SUM(ea."timeSpent"), 0)::int AS "totalTimeSpent"
      FROM "ExamAnswer" ea
      JOIN "Exam" e ON ea."examId" = e.id
      WHERE e."userId" = ANY(${userIds})
      GROUP BY e."userId"
    `;

    // Map exam stats
    const examMap = new Map(examStats.map((e) => [e.userId, e]));
    const answerMap = new Map(answerAgg.map((a) => [a.userId, a]));
    const activeTodaySet = new Set(activeToday.map((a) => a.userId));

    // Global totals
    const globalTotalAnswered = answerAgg.reduce((s, a) => s + a.totalAnswered, 0);
    const globalTotalCorrect = answerAgg.reduce((s, a) => s + a.totalCorrect, 0);
    const globalTotalTime = answerAgg.reduce((s, a) => s + a.totalTimeSpent, 0);
    const globalTotalExams = examStats.reduce((s, e) => s + e._count.id, 0);

    // Calculate success rate for users who have answered questions
    const activeUserIds = answerAgg.filter((a) => a.totalAnswered > 0).map((a) => a.userId);
    const successRateResults = await Promise.all(
      activeUserIds.map(async (uid) => {
        try {
          const result = await calculateSuccessRate(uid);
          return { userId: uid, score: result.overallScore };
        } catch {
          return { userId: uid, score: null };
        }
      })
    );
    const successRateMap = new Map(successRateResults.map((r) => [r.userId, r.score]));

    const userStats = users.map((user) => {
      const exam = examMap.get(user.id);
      const answer = answerMap.get(user.id);

      const totalExams = exam?._count?.id ?? 0;
      const totalAnswered = answer?.totalAnswered ?? 0;
      const totalCorrect = answer?.totalCorrect ?? 0;
      const totalTimeSpent = answer?.totalTimeSpent ?? 0; // seconds
      const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

      return {
        id: user.id,
        name: user.name || "匿名",
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        totalExams,
        totalAnswered,
        totalCorrect,
        accuracy,
        practiceMinutes: Math.round(totalTimeSpent / 60),
        activeToday: activeTodaySet.has(user.id),
        successRate: successRateMap.get(user.id) ?? null,
      };
    });

    return NextResponse.json({
      users: userStats,
      summary: {
        totalUsers: users.length,
        activeToday: activeTodaySet.size,
        totalExams: globalTotalExams,
        totalAnswered: globalTotalAnswered,
        totalCorrect: globalTotalCorrect,
        globalAccuracy: globalTotalAnswered > 0 ? Math.round((globalTotalCorrect / globalTotalAnswered) * 100) : 0,
        totalPracticeHours: Math.round(globalTotalTime / 3600),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch admin stats" }, { status: 500 });
  }
}
