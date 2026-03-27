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

    // Count questions per tag
    const tagCounts = new Map<string, number>();
    for (const q of questions) {
      const tags: string[] = safeJsonParse(q.tags, []);
      for (const tag of tags) {
        const t = tag.trim();
        if (t) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    // Get user's knowledge entries
    const entries = await prisma.knowledgeEntry.findMany({
      where: { userId: session.user.id },
      select: { tag: true, updatedAt: true },
    });
    const entryMap = new Map(entries.map((e) => [e.tag, e.updatedAt]));

    const tags = [...tagCounts.entries()]
      .map(([tag, questionCount]) => ({
        tag,
        questionCount,
        hasEntry: entryMap.has(tag),
        updatedAt: entryMap.get(tag)?.toISOString() || null,
      }))
      .sort((a, b) => b.questionCount - a.questionCount);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/knowledge error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge data" },
      { status: 500 }
    );
  }
}
