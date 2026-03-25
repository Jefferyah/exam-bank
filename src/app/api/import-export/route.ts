import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questions = await prisma.question.findMany({
      orderBy: { createdAt: "asc" },
    });

    const exported = questions.map((q) => ({
      stem: q.stem,
      type: q.type,
      options: JSON.parse(q.options),
      answer: q.answer,
      explanation: q.explanation,
      wrongOptionExplanations: q.wrongOptionExplanations
        ? JSON.parse(q.wrongOptionExplanations)
        : null,
      extendedKnowledge: q.extendedKnowledge,
      domain: q.domain,
      chapter: q.chapter,
      difficulty: q.difficulty,
      tags: JSON.parse(q.tags),
    }));

    return NextResponse.json(exported);
  } catch (error) {
    console.error("GET /api/import-export error:", error);
    return NextResponse.json(
      { error: "Failed to export questions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON array of questions" },
        { status: 400 }
      );
    }

    if (body.length === 0) {
      return NextResponse.json(
        { error: "No questions to import" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < body.length; i++) {
      const q = body[i];
      try {
        // Validate required fields
        if (!q.stem || !q.options || !q.answer || !q.explanation || !q.domain) {
          results.errors.push(
            `Question ${i + 1}: Missing required fields (stem, options, answer, explanation, domain)`
          );
          results.skipped++;
          continue;
        }

        await prisma.question.create({
          data: {
            stem: q.stem,
            type: q.type || "SINGLE",
            options:
              typeof q.options === "string"
                ? q.options
                : JSON.stringify(q.options),
            answer: q.answer,
            explanation: q.explanation,
            wrongOptionExplanations: q.wrongOptionExplanations
              ? typeof q.wrongOptionExplanations === "string"
                ? q.wrongOptionExplanations
                : JSON.stringify(q.wrongOptionExplanations)
              : null,
            extendedKnowledge: q.extendedKnowledge || null,
            domain: q.domain,
            chapter: q.chapter || null,
            difficulty: q.difficulty || 3,
            tags:
              q.tags != null
                ? typeof q.tags === "string"
                  ? q.tags
                  : JSON.stringify(q.tags)
                : "[]",
            createdById: session.user.id,
          },
        });

        results.imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`Question ${i + 1}: ${message}`);
        results.skipped++;
      }
    }

    return NextResponse.json(
      {
        message: `Import complete: ${results.imported} imported, ${results.skipped} skipped`,
        ...results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/import-export error:", error);
    return NextResponse.json(
      { error: "Failed to import questions" },
      { status: 500 }
    );
  }
}
