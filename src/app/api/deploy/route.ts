/**
 * POST /api/deploy -- Legacy endpoint.
 *
 * The real pipeline is now executed via GET /api/pipeline/stream (SSE)
 * or POST /api/pipeline/execute (synchronous). This endpoint returns
 * a redirect instruction.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use GET /api/pipeline/stream or POST /api/pipeline/execute instead.",
      redirect: "/api/pipeline/stream",
    },
    { status: 410 },
  );
}
