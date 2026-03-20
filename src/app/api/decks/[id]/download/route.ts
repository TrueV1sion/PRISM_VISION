import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  stripEmbeddedStyles,
  injectCSS,
  injectJS,
} from "@/lib/pipeline/html-post-process";

/**
 * GET /api/decks/[id]/download
 *
 * Returns a fully self-contained HTML file with all CSS/JS inlined,
 * suitable for offline viewing. The `id` is the run ID.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Look up the presentation to get the file path and title
  const presentation = await prisma.presentation.findFirst({
    where: { runId: id },
    select: { htmlPath: true, title: true },
  });

  const htmlPath = presentation?.htmlPath
    ? join(process.cwd(), "public", presentation.htmlPath)
    : join(process.cwd(), "public", "decks", `${id}.html`);

  let html: string;
  try {
    html = readFileSync(htmlPath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: "Deck not found" },
      { status: 404 },
    );
  }

  // Ensure CSS/JS are inlined for offline viewing
  const publicDir = join(process.cwd(), "public");
  const cssPath = join(publicDir, "styles", "presentation.css");
  const jsPath = join(publicDir, "js", "presentation.js");

  html = stripEmbeddedStyles(html);
  html = injectCSS(html, cssPath);
  html = injectJS(html, jsPath);

  const title = presentation?.title ?? "PRISM-Intelligence-Brief";
  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}.html"`,
    },
  });
}
