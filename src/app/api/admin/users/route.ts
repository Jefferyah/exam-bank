import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "操作失敗，請稍後重試" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: "Missing required fields: userId, newRole" },
        { status: 400 }
      );
    }

    if (!["ADMIN", "TEACHER", "STUDENT"].includes(newRole)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Prevent self-demotion
    if (userId === session.user.id && newRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    // Use transaction to atomically check last-admin invariant and update role
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true },
        });
        if (!targetUser) {
          throw new Error("USER_NOT_FOUND");
        }

        // Prevent removing the last admin
        if (newRole !== "ADMIN" && targetUser.role === "ADMIN") {
          const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
          if (adminCount <= 1) {
            throw new Error("LAST_ADMIN");
          }
        }

        return tx.user.update({
          where: { id: userId },
          data: { role: newRole },
          select: { id: true, name: true, email: true, role: true },
        });
      });
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : "";
      if (msg === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (msg === "LAST_ADMIN") {
        return NextResponse.json(
          { error: "系統至少需要一位管理員，無法降級最後一位管理員" },
          { status: 400 }
        );
      }
      throw txErr;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json(
      { error: "操作失敗，請稍後重試" },
      { status: 500 }
    );
  }
}
