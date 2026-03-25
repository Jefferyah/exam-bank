import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ── helpers ──

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Strip HTML tags and convert <br> to newlines */
function cleanHtml(text: unknown): string {
  if (typeof text !== "string") return String(text ?? "");
  return text
    .replace(/<br\s*\/?>/gi, "\n")  // <br> → newline
    .replace(/<[^>]*>/g, "")         // strip remaining HTML tags
    .replace(/\n{3,}/g, "\n\n")      // collapse excessive newlines
    .trim();
}

/** Map external type strings to our internal enum values */
function normalizeType(raw?: string): string {
  if (!raw) return "SINGLE";
  const lower = raw.toLowerCase().trim();
  if (["mc", "single", "single_choice", "singlechoice"].includes(lower))
    return "SINGLE";
  if (["multi", "multiple", "multi_choice", "multiplechoice"].includes(lower))
    return "MULTIPLE";
  return "SINGLE";
}

/**
 * Normalize a single question object.
 * Accepts both our internal format and the common external format:
 *   External: { question, options: ["str",...], answer: "B", ... }
 *   Internal: { stem, options: [{label,text},...], answer: "B", ... }
 */
function normalizeQuestion(q: Record<string, unknown>): Record<string, unknown> {
  // 1. stem: support "question" alias, clean HTML
  const stem = cleanHtml(q.stem || q.question || "");

  // 2. explanation: clean HTML
  const explanation = cleanHtml(q.explanation || "");

  // 3. options: convert plain string array → { label, text } objects, clean HTML
  let options = q.options;
  if (Array.isArray(options)) {
    if (options.length > 0 && typeof options[0] === "string") {
      // Plain string array → auto-assign A, B, C, D labels, clean HTML
      options = (options as string[]).map((text, i) => ({
        label: LABELS[i] || String(i + 1),
        text: cleanHtml(text),
      }));
    } else {
      // Already [{label, text}] format — still clean HTML in text
      options = (options as { label: string; text: string }[]).map((opt) => ({
        ...opt,
        text: typeof opt.text === "string" ? cleanHtml(opt.text) : opt.text,
      }));
    }
  }

  // 4. type normalization
  const type = normalizeType(q.type as string | undefined);

  // 5. other text fields: clean HTML
  const extendedKnowledge = q.extendedKnowledge ? cleanHtml(q.extendedKnowledge) : null;
  const wrongOptionExplanations = q.wrongOptionExplanations;
  let cleanedWrongExplanations = wrongOptionExplanations;
  if (wrongOptionExplanations && typeof wrongOptionExplanations === "object" && !Array.isArray(wrongOptionExplanations)) {
    cleanedWrongExplanations = Object.fromEntries(
      Object.entries(wrongOptionExplanations as Record<string, string>).map(([k, v]) => [k, cleanHtml(v)])
    );
  }

  return {
    ...q,
    stem,
    explanation,
    options,
    type,
    extendedKnowledge,
    wrongOptionExplanations: cleanedWrongExplanations,
  };
}

// ── GET: export ──

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

// ── POST: import ──

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

    // Support: plain array [...], or { questions: [...] }, or { questionBankName, questions: [...] }
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

    let questionBank: { id: string; name: string } | null = null;

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
      const raw = questionList[i];
      const q = normalizeQuestion(raw);

      try {
        // Validate required fields
        if (!q.stem || !q.options || !q.answer || !q.explanation) {
          results.errors.push(
            `Question ${i + 1}: Missing required fields (stem/question, options, answer, explanation)`
          );
          results.skipped++;
          continue;
        }

        await prisma.question.create({
          data: {
            stem: q.stem as string,
            type: q.type as string,
            options:
              typeof q.options === "string"
                ? q.options
                : JSON.stringify(q.options),
            answer: q.answer as string,
            explanation: q.explanation as string,
            wrongOptionExplanations: q.wrongOptionExplanations
              ? typeof q.wrongOptionExplanations === "string"
                ? q.wrongOptionExplanations
                : JSON.stringify(q.wrongOptionExplanations)
              : null,
            extendedKnowledge: (q.extendedKnowledge as string) || null,
            questionBankId: questionBank.id,
            category: (q.category as string) || null,
            chapter: (q.chapter as string) || null,
            difficulty: (q.difficulty as number) || 3,
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
