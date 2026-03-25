import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import crypto from "crypto";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // 8-char hex code
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const where = role === "ADMIN" ? {} : { createdById: session.user.id };

    const inviteCodes = await prisma.inviteCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        usedBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ inviteCodes });
  } catch (error) {
    console.error("GET /api/invite-codes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite codes" },
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

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(body.count || 1, 1), 20); // 1-20 codes at a time
    const maxUses = Math.max(body.maxUses ?? 0, 0); // 0 = unlimited

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = await prisma.inviteCode.create({
        data: {
          code: generateCode(),
          createdById: session.user.id,
          maxUses,
        },
      });
      codes.push(code);
    }

    return NextResponse.json(
      { inviteCodes: codes, message: `Generated ${codes.length} invite code(s)` },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/invite-codes error:", error);
    return NextResponse.json(
      { error: "Failed to generate invite codes" },
      { status: 500 }
    );
  }
}
