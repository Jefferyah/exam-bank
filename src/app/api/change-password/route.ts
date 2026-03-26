import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { checkRateLimit, AUTH_RATE_LIMIT } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`change-pwd:${session.user.id}`, AUTH_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `請求過於頻繁，請 ${rl.retryAfterSeconds} 秒後重試` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password (required if user has one set)
    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "密碼驗證失敗" },
          { status: 400 }
        );
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json(
          { error: "密碼驗證失敗" },
          { status: 403 }
        );
      }
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    return NextResponse.json({ message: "密碼已更新" });
  } catch (error) {
    console.error("POST /api/change-password error:", error);
    return NextResponse.json(
      { error: "密碼變更失敗，請稍後重試" },
      { status: 500 }
    );
  }
}
