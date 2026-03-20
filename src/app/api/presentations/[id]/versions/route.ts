/**
 * Presentation Versions API
 *
 * GET  /api/presentations/[id]/versions — List all versions for a presentation
 * POST /api/presentations/[id]/versions — Create a new version (fork from current)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateVersionSchema = z.object({
  label: z.string().optional(),
});

/**
 * GET — List all versions for a presentation, include slide count
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      select: { id: true, currentVersionId: true, publishedVersionId: true },
    });

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    const versions = await prisma.presentationVersion.findMany({
      where: { presentationId: id },
      orderBy: { versionNumber: "desc" },
      include: {
        _count: { select: { slides: true } },
      },
    });

    return NextResponse.json({
      presentationId: id,
      currentVersionId: presentation.currentVersionId,
      publishedVersionId: presentation.publishedVersionId,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        label: v.label,
        createdById: v.createdById,
        createdAt: v.createdAt,
        publishedAt: v.publishedAt,
        slideCount: v._count.slides,
      })),
    });
  } catch (error) {
    console.error("GET /api/presentations/[id]/versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST — Create a new draft version by deep-copying slides from the current version
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { slides: true },
        },
      },
    });

    if (!presentation) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 },
      );
    }

    const currentVersion = presentation.versions[0];
    const newVersionNumber = currentVersion
      ? currentVersion.versionNumber + 1
      : 1;

    const label =
      parsed.data.label ?? `Draft v${newVersionNumber}`;

    const newVersion = await prisma.presentationVersion.create({
      data: {
        presentationId: id,
        versionNumber: newVersionNumber,
        status: "draft",
        label,
        slides: currentVersion
          ? {
              create: currentVersion.slides.map((s) => ({
                slideNumber: s.slideNumber,
                templateId: s.templateId,
                backgroundVariant: s.backgroundVariant,
                animationType: s.animationType,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content: s.content as any,
                sourceAgentIds: s.sourceAgentIds,
                sourceFindingIds: s.sourceFindingIds,
              })),
            }
          : undefined,
      },
      include: {
        slides: { orderBy: { slideNumber: "asc" } },
      },
    });

    // Set as the current version
    await prisma.presentation.update({
      where: { id },
      data: { currentVersionId: newVersion.id },
    });

    return NextResponse.json(
      {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        status: newVersion.status,
        label: newVersion.label,
        createdAt: newVersion.createdAt,
        slideCount: newVersion.slides.length,
        slides: newVersion.slides.map((s) => ({
          id: s.id,
          slideNumber: s.slideNumber,
          templateId: s.templateId,
          backgroundVariant: s.backgroundVariant,
          animationType: s.animationType,
          content: s.content,
          sourceAgentIds: s.sourceAgentIds,
          sourceFindingIds: s.sourceFindingIds,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/presentations/[id]/versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
