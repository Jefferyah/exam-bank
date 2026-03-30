import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { safeJsonParse } from "@/lib/safe-json";
import { getEffectiveTagsMap } from "@/lib/effective-tags";

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
      select: { id: true, tags: true },
    });

    // Batch-load user tag overrides
    const overrideMap = await getEffectiveTagsMap(
      questions.map((q) => q.id),
      session.user.id
    );

    // Count questions per tag (using effective tags)
    const tagCounts = new Map<string, number>();
    for (const q of questions) {
      const tags: string[] = overrideMap.get(q.id) ?? safeJsonParse(q.tags, []);
      for (const tag of tags) {
        const t = tag.trim();
        if (t) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    // Get user's knowledge entries (with content for word count)
    const entries = await prisma.knowledgeEntry.findMany({
      where: { userId: session.user.id },
      select: { tag: true, content: true, updatedAt: true },
    });
    const entryMap = new Map(
      entries.map((e) => [e.tag, { content: e.content, updatedAt: e.updatedAt }])
    );

    // Get per-tag accuracy — respect hidden bank filter
    const tagAccuracy = new Map<string, { total: number; correct: number }>();
    {
      const answers = await prisma.examAnswer.findMany({
        where: {
          exam: { userId: session.user.id },
          userAnswer: { not: null },
          isCorrect: { not: null },
          ...(hiddenBankIds.length > 0
            ? { question: { questionBankId: { notIn: hiddenBankIds } } }
            : {}),
        },
        select: {
          isCorrect: true,
          question: { select: { id: true, tags: true } },
        },
      });

      // Batch-load user tag overrides for accuracy answers
      const accOverrideMap = await getEffectiveTagsMap(
        answers.map((a) => a.question.id),
        session.user.id
      );

      for (const ans of answers) {
        const ansTags: string[] = accOverrideMap.get(ans.question.id) ?? safeJsonParse(ans.question.tags, []);
        for (const tag of ansTags) {
          const t = tag.trim();
          if (!t) continue;
          const stat = tagAccuracy.get(t) || { total: 0, correct: 0 };
          stat.total++;
          if (ans.isCorrect) stat.correct++;
          tagAccuracy.set(t, stat);
        }
      }
    }

    // Standalone knowledge entries (user-created, no matching question tag)
    const customEntries = entries
      .filter((e) => !tagCounts.has(e.tag))
      .map((e) => ({
        tag: e.tag,
        wordCount: e.content.length,
        updatedAt: e.updatedAt.toISOString(),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Parse wiki-links [[tag]] from all entries to build link graph
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const allTagNames = [...tagCounts.keys(), ...customEntries.map((e) => e.tag)];
    // Case-insensitive lookup: lowercase → actual stored name
    const tagNameMap = new Map<string, string>();
    for (const t of allTagNames) tagNameMap.set(t.toLowerCase(), t);
    const linkWeightMap = new Map<string, number>();

    for (const entry of entries) {
      let match: RegExpExecArray | null;
      wikiLinkRegex.lastIndex = 0;
      while ((match = wikiLinkRegex.exec(entry.content)) !== null) {
        const raw = match[1].trim();
        const resolved = tagNameMap.get(raw.toLowerCase());
        if (resolved && resolved.toLowerCase() !== entry.tag.toLowerCase()) {
          // Normalize key so A→B and B→A are the same edge (use canonical names)
          const key = [entry.tag, resolved].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join("\0");
          linkWeightMap.set(key, (linkWeightMap.get(key) || 0) + 1);
        }
      }
    }

    const links = [...linkWeightMap.entries()].map(([key, weight]) => {
      const [source, target] = key.split("\0");
      return { source, target, weight };
    });

    const tags = [...tagCounts.entries()]
      .map(([tag, questionCount]) => {
        const entry = entryMap.get(tag);
        const acc = tagAccuracy.get(tag);
        return {
          tag,
          questionCount,
          wordCount: entry?.content ? entry.content.length : 0,
          accuracy: acc && acc.total > 0
            ? Math.round((acc.correct / acc.total) * 100)
            : null,
          hasEntry: entryMap.has(tag),
          updatedAt: entry?.updatedAt?.toISOString() || null,
        };
      })
      .sort((a, b) => b.questionCount - a.questionCount);

    return NextResponse.json({ tags, links, customEntries });
  } catch (error) {
    console.error("GET /api/knowledge error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge data" },
      { status: 500 }
    );
  }
}
