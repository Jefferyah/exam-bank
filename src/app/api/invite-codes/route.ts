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
      { error: "操作失敗，請稍後重試" },
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
      let created = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const code = await prisma.inviteCode.create({
            data: {
              code: generateCode(),
              createdById: session.user.id,
              maxUses,
            },
          });
          codes.push(code);
          created = true;
          break;
        } catch (err: unknown) {
          // Retry on unique constraint violation (code collision)
          const prismaError = err as { code?: string };
          if (prismaError.code === "P2002" && attempt < 4) continue;
          throw err;
        }
      }
      if (!created) {
        return NextResponse.json(
          { error: "Failed to generate unique invite code after retries" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { inviteCodes: codes, message: `Generated ${codes.length} invite code(s)` },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/invite-codes error:", error);
    return NextResponse.json(
      { error: "邀請碼產生失敗，請稍後重試" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, bulkUsed } = await req.json().catch(() => ({}));

    if (bulkUsed) {
      // Delete all fully-used codes
      const where = role === "ADMIN"
        ? { maxUses: { gt: 0 } }
        : { maxUses: { gt: 0 }, createdById: session.user.id };

      // Find codes where usedCount >= maxUses
      const usedCodes = await prisma.inviteCode.findMany({ where });
      const idsToDelete = usedCodes
        .filter((c) => c.usedCount >= c.maxUses)
        .map((c) => c.id);

      if (idsToDelete.length > 0) {
        await prisma.inviteCode.deleteMany({ where: { id: { in: idsToDelete } } });
      }

      return NextResponse.json({ deleted: idsToDelete.length });
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check ownership (ADMIN can delete any, TEACHER only own)
    const code = await prisma.inviteCode.findUnique({ where: { id } });
    if (!code) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (role !== "ADMIN" && code.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.inviteCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/invite-codes error:", error);
    return NextResponse.json(
      { error: "刪除失敗，請稍後重試" },
      { status: 500 }
    );
  }
}
