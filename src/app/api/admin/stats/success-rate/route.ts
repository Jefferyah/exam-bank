import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateSuccessRate } from "@/lib/success-rate";

/**
 * GET /api/admin/stats/success-rate?userId=xxx
 * Calculate per-category success rate for a specific user (admin only).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const result = await calculateSuccessRate(userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/stats/success-rate error:", error);
    return NextResponse.json({ error: "Failed to calculate success rate" }, { status: 500 });
  }
}
