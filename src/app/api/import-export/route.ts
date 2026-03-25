import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const questionBankId = searchParams.get("questionBankId");

    const where: Record<string, unknown> = {};
    if (questionBankId) {
      where.questionBankId = questionBankId;
    }

    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        questionBank: { select: { name: true } },
      },
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
      category: q.category,
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
    const {
      questionBankId,
      questionBankName,
      questionBankDescription,
      questions,
    } = body;

    // Support both new format {questionBankName, questions: [...]} and legacy format [...]
    const questionList = Array.isArray(body) ? body : questions;
    const bankName = Array.isArray(body) ? null : questionBankName;

    if (!questionList || !Array.isArray(questionList)) {
      return NextResponse.json(
        { error: "Request body must include a questions array" },
        { status: 400 }
      );
    }

    if (questionList.length === 0) {
      return NextResponse.json(
        { error: "No questions to import" },
        { status: 400 }
      );
    }

    let questionBank:
      | { id: string; name: string }
      | null = null;

    if (questionBankId) {
      questionBank = await prisma.questionBank.findUnique({
        where: { id: questionBankId },
        select: { id: true, name: true },
      });

      if (!questionBank) {
        return NextResponse.json(
          { error: "Question bank not found" },
          { status: 404 }
        );
      }
    } else {
      if (!bankName) {
        return NextResponse.json(
          { error: "Missing required field: questionBankName or questionBankId" },
          { status: 400 }
        );
      }

      questionBank = await prisma.questionBank.create({
        data: {
          name: bankName,
          description: questionBankDescription || null,
          createdById: session.user.id,
        },
        select: {
          id: true,
          name: true,
        },
      });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      questionBankId: questionBank.id,
      questionBankName: questionBank.name,
    };

    for (let i = 0; i < questionList.length; i++) {
      const q = questionList[i];
      try {
        // Validate required fields
        if (!q.stem || !q.options || !q.answer || !q.explanation) {
          results.errors.push(
            `Question ${i + 1}: Missing required fields (stem, options, answer, explanation)`
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
            questionBankId: questionBank.id,
            category: q.category || null,
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
