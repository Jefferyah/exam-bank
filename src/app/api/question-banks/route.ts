import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // Users see: their own banks + all public banks
    // Admin sees all
    const where = isAdmin
      ? {}
      : {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
          ],
        };

    const questionBanks = await prisma.questionBank.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ questionBanks });
  } catch (error) {
    console.error("GET /api/question-banks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch question banks" },
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
    const { name, description, isPublic } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const questionBank = await prisma.questionBank.create({
      data: {
        name,
        description: description || null,
        isPublic: isPublic === true,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(questionBank, { status: 201 });
  } catch (error) {
    console.error("POST /api/question-banks error:", error);
    return NextResponse.json(
      { error: "Failed to create question bank" },
      { status: 500 }
    );
  }
}
