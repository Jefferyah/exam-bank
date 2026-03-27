import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/safe-json";

/**
 * Batch-load user tag overrides for a set of questions.
 * Returns a Map<questionId, parsedTags[]>.
 * If a questionId has no override, it won't be in the map.
 */
export async function getEffectiveTagsMap(
  questionIds: string[],
  userId: string
): Promise<Map<string, string[]>> {
  if (questionIds.length === 0) return new Map();

  const overrides = await prisma.userTagOverride.findMany({
    where: {
      userId,
      questionId: { in: questionIds },
    },
    select: { questionId: true, tags: true },
  });

  return new Map(
    overrides.map((o) => [o.questionId, safeJsonParse(o.tags, [])])
  );
}

/**
 * Get effective tags for a question, preferring user override over base tags.
 */
export function getEffectiveTags(
  question: { id: string; tags: string },
  overrideMap: Map<string, string[]>
): string[] {
  return overrideMap.get(question.id) ?? safeJsonParse(question.tags, []);
}
