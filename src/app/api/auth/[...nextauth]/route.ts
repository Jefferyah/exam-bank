import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, AUTH_RATE_LIMIT } from "@/lib/rate-limit";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  // Rate limit login attempts by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `請求過於頻繁，請 ${rl.retryAfterSeconds} 秒後重試` },
      { status: 429 }
    );
  }

  return handlers.POST(req);
}
