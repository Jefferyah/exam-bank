import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bankIdsParam = searchParams.get("bankIds");
    const filterBankIds = bankIdsParam ? bankIdsParam.split(",").filter(Boolean) : [];

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    const where: Record<string, unknown> = {
      chapter: { not: null },
    };

    if (filterBankIds.length > 0) {
      where.questionBankId = { in: filterBankIds };
      const bankFilter: Record<string, unknown> = {};
      if (!isAdmin) {
        bankFilter.OR = [
          { createdById: session.user.id },
          { isPublic: true },
        ];
      }
      if (hiddenBankIds.length > 0) {
        bankFilter.id = { notIn: hiddenBankIds };
      }
      if (Object.keys(bankFilter).length > 0) {
        where.questionBank = bankFilter;
      }
    } else {
      if (!isAdmin) {
        where.questionBank = {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
          ],
          ...(hiddenBankIds.length > 0 ? { id: { notIn: hiddenBankIds } } : {}),
        };
      } else if (hiddenBankIds.length > 0) {
        where.questionBank = { id: { notIn: hiddenBankIds } };
      }
    }

    const questions = await prisma.question.findMany({
      where,
      select: { chapter: true },
    });

    const chapterSet = new Set<string>();
    for (const q of questions) {
      if (q.chapter?.trim()) chapterSet.add(q.chapter.trim());
    }

    const chapters = [...chapterSet].sort((a, b) => {
      // Sort by chapter number if present
      const numA = parseInt(a.match(/\d+/)?.[0] || "999");
      const numB = parseInt(b.match(/\d+/)?.[0] || "999");
      return numA - numB || a.localeCompare(b, "zh-Hant");
    });

    return NextResponse.json({ chapters });
  } catch (error) {
    console.error("GET /api/chapters error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapters" },
      { status: 500 }
    );
  }
}
