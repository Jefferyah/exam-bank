import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateSuccessRate } from "@/lib/success-rate";

/**
 * GET /api/success-rate
 * Calculate per-category success rate for the currently logged-in user.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await calculateSuccessRate(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/success-rate error:", error);
    return NextResponse.json({ error: "Failed to calculate success rate" }, { status: 500 });
  }
}
