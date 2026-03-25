import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: fetch user's difficulty ratings (optionally filter by questionId)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const questionId = req.nextUrl.searchParams.get("questionId");
    const where: { userId: string; questionId?: string } = { userId: session.user.id };
    if (questionId) where.questionId = questionId;

    const ratings = await prisma.userDifficulty.findMany({ where });
    return NextResponse.json({ ratings });
  } catch (error) {
    console.error("GET /api/user-difficulty error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST: set/update user's difficulty for a question
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId, difficulty } = await req.json();
    if (!questionId || !difficulty || difficulty < 1 || difficulty > 5) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const rating = await prisma.userDifficulty.upsert({
      where: {
        userId_questionId: {
          userId: session.user.id,
          questionId,
        },
      },
      update: { difficulty },
      create: {
        userId: session.user.id,
        questionId,
        difficulty,
      },
    });

    return NextResponse.json(rating);
  } catch (error) {
    console.error("POST /api/user-difficulty error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
