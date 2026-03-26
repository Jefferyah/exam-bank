import { NextResponse } from "next/server";

/**
 * Safe error handler for API routes.
 * Logs the full error server-side but only returns a generic message to the client.
 * Prevents leaking stack traces, query details, or internal structure.
 */
export function handleApiError(
  context: string,
  error: unknown,
  fallbackMessage = "Internal server error"
) {
  // Always log full error server-side
  console.error(`${context}:`, error);

  // Never expose internal error details to the client
  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  );
}
