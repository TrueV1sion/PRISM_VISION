/**
 * Slide API
 *
 * GET   /api/presentations/[id]/slides/[slideNumber] — Get slide by number from current version
 * PATCH /api/presentations/[id]/slides/[slideNumber] — Update slide content
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string; slideNumber: string }> };

const PatchSlideSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  templateId: z.string().optional(),
  backgroundVariant: z.string().optional(),
  animationType: z.string().optional(),
});

/**
 * GET — Load slide by slideNumber from the presentation's currentVersionId
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id, slideNumber: slideNumberRaw } = await params;
  const slideNumber = parseInt(slideNumberRaw, 10);

  if (isNaN(slideNumber)) {
    return NextResponse.json(
      { error: "Invalid slide number" },
      { status: 400 },
    );
  }

  try {
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      select: { currentVersionId: true },
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
        { status: 404 },
      );
    }

    const slide = await prisma.slideVersion.findUnique({
      where: {
        versionId_slideNumber: {
          versionId: presentation.currentVersionId,
          slideNumber,
        },
      },
      include: {
        _count: { select: { annotations: true } },
      },
    });

    if (!slide) {
      return NextResponse.json(
        { error: "Slide not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: slide.id,
      versionId: slide.versionId,
      slideNumber: slide.slideNumber,
      templateId: slide.templateId,
      backgroundVariant: slide.backgroundVariant,
      animationType: slide.animationType,
      content: slide.content,
      sourceAgentIds: slide.sourceAgentIds,
      sourceFindingIds: slide.sourceFindingIds,
      createdAt: slide.createdAt,
      updatedAt: slide.updatedAt,
      annotationCount: slide._count.annotations,
    });
  } catch (error) {
    console.error(
      "GET /api/presentations/[id]/slides/[slideNumber] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH — Update slide content fields in the current version
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, slideNumber: slideNumberRaw } = await params;
  const slideNumber = parseInt(slideNumberRaw, 10);

  if (isNaN(slideNumber)) {
    return NextResponse.json(
      { error: "Invalid slide number" },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const parsed = PatchSlideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      select: { currentVersionId: true },
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
        { status: 404 },
      );
    }

    // Build update data — only include provided fields
    const { content, templateId, backgroundVariant, animationType } =
      parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (content !== undefined) updateData.content = content;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (backgroundVariant !== undefined)
      updateData.backgroundVariant = backgroundVariant;
    if (animationType !== undefined) updateData.animationType = animationType;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.slideVersion.update({
      where: {
        versionId_slideNumber: {
          versionId: presentation.currentVersionId,
          slideNumber,
        },
      },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      versionId: updated.versionId,
      slideNumber: updated.slideNumber,
      templateId: updated.templateId,
      backgroundVariant: updated.backgroundVariant,
      animationType: updated.animationType,
      content: updated.content,
      sourceAgentIds: updated.sourceAgentIds,
      sourceFindingIds: updated.sourceFindingIds,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error(
      "PATCH /api/presentations/[id]/slides/[slideNumber] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
