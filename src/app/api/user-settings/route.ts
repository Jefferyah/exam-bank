import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: fetch current user's settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiPromptTemplate: true, dailyGoal: true },
    });

    return NextResponse.json({
      aiPromptTemplate: user?.aiPromptTemplate || null,
      dailyGoal: user?.dailyGoal || null,
    });
  } catch (error) {
    console.error("GET /api/user-settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT: update current user's settings
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { aiPromptTemplate, dailyGoal } = body;

    const data: Record<string, unknown> = {};

    // AI prompt template
    if (aiPromptTemplate !== undefined) {
      const template = typeof aiPromptTemplate === "string" && aiPromptTemplate.trim()
        ? aiPromptTemplate.trim()
        : null;
      if (template && template.length > 2000) {
        return NextResponse.json({ error: "Prompt 長度不得超過 2000 字元" }, { status: 400 });
      }
      data.aiPromptTemplate = template;
    }

    // Daily goal
    if (dailyGoal !== undefined) {
      if (dailyGoal === null) {
        data.dailyGoal = null;
      } else {
        const parsed = parseInt(dailyGoal, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 500) {
          return NextResponse.json({ error: "每日目標需在 1-500 之間的整數" }, { status: 400 });
        }
        data.dailyGoal = parsed;
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { aiPromptTemplate: true, dailyGoal: true },
    });

    return NextResponse.json({
      aiPromptTemplate: updated.aiPromptTemplate,
      dailyGoal: updated.dailyGoal,
    });
  } catch (error) {
    console.error("PUT /api/user-settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
