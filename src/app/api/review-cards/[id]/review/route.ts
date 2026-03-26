import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeNextState, type SRSRating } from "@/lib/srs";

/**
 * POST /api/review-cards/[id]/review
 * Submit a rating for a review card.
 * Body: { rating: 1|2|3|4 }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { rating } = await req.json();

    if (![1, 2, 3, 4].includes(rating)) {
      return NextResponse.json(
        { error: "rating must be 1, 2, 3, or 4" },
        { status: 400 }
      );
    }

    // Fetch the card
    const card = await prisma.reviewCard.findUnique({ where: { id } });

    if (!card) {
      return NextResponse.json({ error: "Review card not found" }, { status: 404 });
    }

    if (card.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Compute next state
    const currentState = {
      status: card.status as "NEW" | "LEARNING" | "REVIEW" | "MASTERED",
      interval: card.interval,
      easeFactor: card.easeFactor,
      repetitions: card.repetitions,
      lapses: card.lapses,
    };

    const next = computeNextState(currentState, rating as SRSRating);

    // Update card + create log in transaction
    const [updatedCard] = await prisma.$transaction([
      prisma.reviewCard.update({
        where: { id },
        data: {
          status: next.status,
          interval: next.interval,
          easeFactor: next.easeFactor,
          repetitions: next.repetitions,
          lapses: next.lapses,
          nextDueAt: next.nextDueAt,
          lastReviewedAt: new Date(),
        },
      }),
      prisma.reviewLog.create({
        data: {
          userId: session.user.id,
          questionId: card.questionId,
          reviewCardId: card.id,
          rating,
          intervalBefore: card.interval,
          intervalAfter: next.interval,
        },
      }),
    ]);

    return NextResponse.json({
      card: updatedCard,
      nextDueAt: next.nextDueAt,
      intervalDays: next.interval,
    });
  } catch (error) {
    console.error("POST /api/review-cards/[id]/review error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
