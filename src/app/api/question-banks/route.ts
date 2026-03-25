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

    // Each user only sees their own question banks
    // Admin can see all
    const where = isAdmin ? {} : { createdById: session.user.id };

    const questionBanks = await prisma.questionBank.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
        createdBy: { select: { name: true, email: true } },
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
    const { name, description } = body;

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
