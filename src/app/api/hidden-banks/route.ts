import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: fetch user's hidden bank IDs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hidden = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });

    return NextResponse.json({
      hiddenBankIds: hidden.map((h) => h.questionBankId),
    });
  } catch (error) {
    console.error("GET /api/hidden-banks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch hidden banks" },
      { status: 500 }
    );
  }
}

// POST: toggle hide/unhide a bank
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionBankId } = await req.json();

    if (!questionBankId) {
      return NextResponse.json(
        { error: "Missing required field: questionBankId" },
        { status: 400 }
      );
    }

    // Verify question bank exists AND user has access to it
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      select: { id: true, isPublic: true, createdById: true },
    });
    if (!bank) {
      return NextResponse.json(
        { error: "Question bank not found" },
        { status: 404 }
      );
    }
    // Non-admin can only hide banks they own or that are public
    if (!isAdmin && !bank.isPublic && bank.createdById !== session.user.id) {
      return NextResponse.json(
        { error: "無權操作此題庫" },
        { status: 403 }
      );
    }

    // Check if already hidden
    const existing = await prisma.hiddenBank.findUnique({
      where: {
        userId_questionBankId: {
          userId: session.user.id,
          questionBankId,
        },
      },
    });

    if (existing) {
      // Unhide
      await prisma.hiddenBank.delete({ where: { id: existing.id } });
      return NextResponse.json({ hidden: false, message: "題庫已取消隱藏" });
    } else {
      // Hide
      await prisma.hiddenBank.create({
        data: {
          userId: session.user.id,
          questionBankId,
        },
      });
      return NextResponse.json(
        { hidden: true, message: "題庫已隱藏" },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("POST /api/hidden-banks error:", error);
    return NextResponse.json(
      { error: "Failed to toggle hidden bank" },
      { status: 500 }
    );
  }
}
