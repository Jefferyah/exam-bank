import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // Exclude user's hidden banks
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    // Get all questions the user can access (excluding hidden banks)
    const where: Record<string, unknown> = {};
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

    const questions = await prisma.question.findMany({
      where,
      select: { tags: true },
    });

    // Extract unique tags
    const tagSet = new Set<string>();
    for (const q of questions) {
      const tags: string[] = safeJsonParse(q.tags, []);
      for (const tag of tags) {
        if (tag.trim()) tagSet.add(tag.trim());
      }
    }

    const tags = [...tagSet].sort((a, b) => a.localeCompare(b, "zh-Hant"));

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}
