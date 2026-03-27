import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeHidden = req.nextUrl.searchParams.get("includeHidden") === "true";
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // Get user's hidden banks
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    // Users see: their own banks + all public banks, excluding hidden (unless includeHidden)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = isAdmin
      ? {}
      : {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
          ],
        };

    if (!includeHidden && hiddenBankIds.length > 0) {
      where.id = { notIn: hiddenBankIds };
    }

    const questionBanks = await prisma.questionBank.findMany({
      where,
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
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

    // Only ADMIN and TEACHER can create question banks
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json(
        { error: "只有管理員和教師可以建立題庫" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, isPublic, category } = body;

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
        category: category || null,
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
