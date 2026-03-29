import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/categories
 * Returns all distinct categories.
 * ?type=question  → question categories
 * ?type=bank (default) → question bank categories
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get("type") || "bank";

    if (type === "question") {
      const questions = await prisma.question.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      });
      const categories = questions
        .map((q) => q.category)
        .filter((c): c is string => !!c);
      return NextResponse.json({ categories });
    }

    // Default: bank categories
    const banks = await prisma.questionBank.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    const categories = banks
      .map((b) => b.category)
      .filter((c): c is string => !!c);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
