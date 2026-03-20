/**
 * Publish Presentation API
 *
 * POST /api/presentations/[id]/publish — Publish the current version
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST — Publish the current version of a presentation
 *
 * Sets version status to "published", publishedAt to now,
 * and updates presentation.publishedVersionId.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      select: { id: true, currentVersionId: true },
    });

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    if (!presentation.currentVersionId) {
      return NextResponse.json(
        { error: "No current version set for this presentation" },
        { status: 400 },
      );
    }

    // Verify the version exists and is not already published
    const version = await prisma.presentationVersion.findUnique({
      where: { id: presentation.currentVersionId },
      select: { id: true, status: true },
    });

    if (!version) {
      return NextResponse.json(
        { error: "Current version not found" },
        { status: 404 },
      );
    }

    const now = new Date();

    // Update version status and publishedAt
    await prisma.presentationVersion.update({
      where: { id: version.id },
      data: {
        status: "published",
        publishedAt: now,
      },
    });

    // Set as the published version on the presentation
    const updatedPresentation = await prisma.presentation.update({
      where: { id },
      data: { publishedVersionId: version.id },
      include: {
        versions: {
          where: { id: version.id },
          include: {
            slides: { orderBy: { slideNumber: "asc" } },
          },
        },
        run: {
          select: { id: true, query: true, tier: true },
        },
      },
    });

    const publishedVersion = updatedPresentation.versions[0];

    return NextResponse.json({
      id: updatedPresentation.id,
      title: updatedPresentation.title,
      subtitle: updatedPresentation.subtitle,
      htmlPath: updatedPresentation.htmlPath,
      slideCount: updatedPresentation.slideCount,
      currentVersionId: updatedPresentation.currentVersionId,
      publishedVersionId: updatedPresentation.publishedVersionId,
      runId: updatedPresentation.runId,
      query: updatedPresentation.run?.query,
      tier: updatedPresentation.run?.tier,
      publishedVersion: publishedVersion
        ? {
            id: publishedVersion.id,
            versionNumber: publishedVersion.versionNumber,
            status: publishedVersion.status,
            label: publishedVersion.label,
            publishedAt: publishedVersion.publishedAt,
            slideCount: publishedVersion.slides.length,
          }
        : null,
    });
  } catch (error) {
    console.error("POST /api/presentations/[id]/publish error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
