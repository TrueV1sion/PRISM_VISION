/**
 * Slide Annotations API
 *
 * GET  /api/presentations/[id]/slides/[slideNumber]/annotations — List annotations for slide
 * POST /api/presentations/[id]/slides/[slideNumber]/annotations — Create annotation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteParams = {
  params: Promise<{ id: string; slideNumber: string }>;
};

const CreateAnnotationSchema = z.object({
  content: z.string().min(1, "Content is required"),
  targetField: z.string().optional(),
  authorName: z.string().optional(),
});

/**
 * Resolve the SlideVersion ID from presentation ID + slideNumber using currentVersionId
 */
async function resolveSlideId(
  presentationId: string,
  slideNumber: number,
): Promise<{ slideId: string } | { error: string; status: number }> {
  const presentation = await prisma.presentation.findUnique({
    where: { id: presentationId },
    select: { currentVersionId: true },
  });

  if (!presentation) {
    return { error: "Presentation not found", status: 404 };
  }

  if (!presentation.currentVersionId) {
    return { error: "No current version set for this presentation", status: 404 };
  }

  const slide = await prisma.slideVersion.findUnique({
    where: {
      versionId_slideNumber: {
        versionId: presentation.currentVersionId,
        slideNumber,
      },
    },
    select: { id: true },
  });

  if (!slide) {
    return { error: "Slide not found", status: 404 };
  }

  return { slideId: slide.id };
}

/**
 * GET — List annotations for a slide, include replies, ordered by createdAt
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
    const result = await resolveSlideId(id, slideNumber);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const annotations = await prisma.slideAnnotation.findMany({
      where: { slideId: result.slideId },
      orderBy: { createdAt: "asc" },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      slideNumber,
      annotations: annotations.map((a) => ({
        id: a.id,
        content: a.content,
        targetField: a.targetField,
        authorId: a.authorId,
        authorName: a.authorName,
        resolved: a.resolved,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        replies: a.replies.map((r) => ({
          id: r.id,
          content: r.content,
          authorId: r.authorId,
          authorName: r.authorName,
          createdAt: r.createdAt,
        })),
      })),
    });
  } catch (error) {
    console.error(
      "GET /api/presentations/[id]/slides/[slideNumber]/annotations error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST — Create a new annotation on a slide
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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
    const parsed = CreateAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await resolveSlideId(id, slideNumber);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const annotation = await prisma.slideAnnotation.create({
      data: {
        slideId: result.slideId,
        content: parsed.data.content,
        targetField: parsed.data.targetField,
        authorName: parsed.data.authorName ?? "Anonymous",
      },
    });

    return NextResponse.json(
      {
        id: annotation.id,
        content: annotation.content,
        targetField: annotation.targetField,
        authorId: annotation.authorId,
        authorName: annotation.authorName,
        resolved: annotation.resolved,
        createdAt: annotation.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/presentations/[id]/slides/[slideNumber]/annotations error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
