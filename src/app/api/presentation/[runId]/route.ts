/**
 * GET /api/presentation/[runId]
 * 
 * Serves the generated HTML5 presentation for a completed run.
 * Looks up the Presentation record and reads the HTML file from public/decks/.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "fs";
import { resolve, sep } from "path";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string }> },
) {
    const { runId } = await params;

    const presentation = await prisma.presentation.findUnique({
        where: { runId },
    });

    if (!presentation) {
        return NextResponse.json(
            { error: "Presentation not found" },
            { status: 404 },
        );
    }

    try {
        const decksDir = resolve(process.cwd(), "public", "decks");
        const filePath = resolve(process.cwd(), "public", presentation.htmlPath);
        if (!filePath.startsWith(decksDir + sep)) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            );
        }
        const html = readFileSync(filePath, "utf-8");

        return new NextResponse(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Presentation file not found on disk" },
            { status: 404 },
        );
    }
}
