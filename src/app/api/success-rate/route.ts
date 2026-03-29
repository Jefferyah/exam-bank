import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateSuccessRate } from "@/lib/success-rate";

/**
 * GET /api/success-rate
 * Calculate per-category success rate for the currently logged-in user.
 * Automatically excludes hidden banks.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's hidden bank IDs
    const hiddenBanks = await prisma.hiddenBank.findMany({
      where: { userId: session.user.id },
      select: { questionBankId: true },
    });
    const hiddenBankIds = hiddenBanks.map((h) => h.questionBankId);

    const result = await calculateSuccessRate(session.user.id, hiddenBankIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/success-rate error:", error);
    return NextResponse.json({ error: "Failed to calculate success rate" }, { status: 500 });
  }
}
