import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { solveWithClaude } from "@/lib/ai/claude";
import { solveWithGPT } from "@/lib/ai/openai";
import { solveWithGemini } from "@/lib/ai/gemini";
import { checkRateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`ai-solve:${session.user.id}`, AI_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `請求過於頻繁，請 ${rl.retryAfterSeconds} 秒後重試` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: "Missing required field: questionId" },
        { status: 400 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { questionBank: { select: { isPublic: true, createdById: true } } },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this question's bank
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin && !question.questionBank.isPublic && question.questionBank.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let options;
    try {
      options = JSON.parse(question.options);
    } catch {
      return NextResponse.json({ error: "Invalid question data" }, { status: 500 });
    }

    const [claudeResult, openaiResult, geminiResult] = await Promise.allSettled([
      solveWithClaude(question.stem, options, question.type),
      solveWithGPT(question.stem, options, question.type),
      solveWithGemini(question.stem, options, question.type),
    ]);

    const results = {
      claude:
        claudeResult.status === "fulfilled"
          ? { success: true, data: claudeResult.value }
          : { success: false, error: claudeResult.reason?.message || "Claude API failed" },
      openai:
        openaiResult.status === "fulfilled"
          ? { success: true, data: openaiResult.value }
          : { success: false, error: openaiResult.reason?.message || "OpenAI API failed" },
      gemini:
        geminiResult.status === "fulfilled"
          ? { success: true, data: geminiResult.value }
          : { success: false, error: geminiResult.reason?.message || "Gemini API failed" },
    };

    return NextResponse.json({
      questionId,
      results,
    });
  } catch (error) {
    console.error("POST /api/ai-solve error:", error);
    return NextResponse.json(
      { error: "AI 解題失敗，請稍後重試" },
      { status: 500 }
    );
  }
}
