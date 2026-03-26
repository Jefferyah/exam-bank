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
      select: { aiPromptTemplate: true },
    });

    return NextResponse.json({
      aiPromptTemplate: user?.aiPromptTemplate || null,
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
    const { aiPromptTemplate } = body;

    // Allow null/empty to reset to default
    const template = typeof aiPromptTemplate === "string" && aiPromptTemplate.trim()
      ? aiPromptTemplate.trim()
      : null;

    // Limit length to prevent abuse
    if (template && template.length > 2000) {
      return NextResponse.json({ error: "Prompt 長度不得超過 2000 字元" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { aiPromptTemplate: template },
    });

    return NextResponse.json({ aiPromptTemplate: template });
  } catch (error) {
    console.error("PUT /api/user-settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
