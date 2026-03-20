/**
 * Presentation API
 *
 * GET /api/presentations/[id] — Get presentation with current version + slides
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const byRunId = req.nextUrl.searchParams.get("byRunId") === "true";

    const presentation = byRunId
      ? await prisma.presentation.findUnique({ where: { runId: id } })
      : await prisma.presentation.findUnique({ where: { id } });

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    // If currentVersionId is set, load that specific version; otherwise fall back to latest
    const versionWhere = presentation.currentVersionId
      ? { id: presentation.currentVersionId }
      : undefined;

    const fullPresentation = await prisma.presentation.findUnique({
      where: { id: presentation.id },
      include: {
        versions: versionWhere
          ? {
              where: versionWhere,
              include: {
                slides: { orderBy: { slideNumber: "asc" } },
              },
            }
          : {
              orderBy: { versionNumber: "desc" },
              take: 1,
              include: {
                slides: { orderBy: { slideNumber: "asc" } },
              },
            },
        run: {
          select: { id: true, query: true, tier: true },
        },
      },
    });

    if (!fullPresentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    const currentVersion = fullPresentation.versions[0] ?? null;

    return NextResponse.json({
      id: fullPresentation.id,
      title: fullPresentation.title,
      subtitle: fullPresentation.subtitle,
      htmlPath: fullPresentation.htmlPath,
      slideCount: fullPresentation.slideCount,
      currentVersionId: fullPresentation.currentVersionId,
      publishedVersionId: fullPresentation.publishedVersionId,
      runId: fullPresentation.runId,
      query: fullPresentation.run?.query,
      tier: fullPresentation.run?.tier,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            status: currentVersion.status,
            label: currentVersion.label,
            createdAt: currentVersion.createdAt,
            publishedAt: currentVersion.publishedAt,
            slides: currentVersion.slides.map((s) => ({
              id: s.id,
              slideNumber: s.slideNumber,
              templateId: s.templateId,
              backgroundVariant: s.backgroundVariant,
              animationType: s.animationType,
              content: s.content,
              sourceAgentIds: s.sourceAgentIds,
              sourceFindingIds: s.sourceFindingIds,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/presentations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
