import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderFormat } from "@/lib/renderers";
import type { RenderFormat } from "@/lib/renderers";
import type { IRGraph } from "@/lib/pipeline/ir-types";

const VALID_FORMATS: RenderFormat[] = [
  "executive-memo",
  "pdf",
  "data-export-json",
  "data-export-csv",
  "data-room",
];

/**
 * GET /api/run/[id]/export?format=executive-memo|pdf|data-export-json|data-export-csv|data-room
 *
 * Renders the run's IR Graph in the requested format and returns the result
 * as a downloadable file.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") as RenderFormat | null;

  if (!format || !VALID_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Invalid format. Valid: ${VALID_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }

  // Load the IR Graph from the database
  const irRecord = await prisma.irGraph.findUnique({
    where: { runId: id },
    select: { graph: true },
  });

  if (!irRecord) {
    return NextResponse.json(
      { error: "IR Graph not found for this run" },
      { status: 404 },
    );
  }

  let ir: IRGraph;
  try {
    ir = JSON.parse(irRecord.graph as string) as IRGraph;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse IR Graph" },
      { status: 500 },
    );
  }

  // Load the run query for context
  const run = await prisma.run.findUnique({
    where: { id },
    select: { query: true },
  });

  try {
    const output = await renderFormat(format, ir, { query: run?.query });
    const body =
      typeof output.content === "string"
        ? output.content
        : new Uint8Array(output.content);
    return new NextResponse(body, {
      headers: {
        "Content-Type": output.mimeType,
        "Content-Disposition": `attachment; filename="${output.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
