import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/run/[id] — Get full run details with all relations
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const run = await prisma.run.findUnique({
        where: { id },
        include: {
            dimensions: true,
            agents: {
                include: {
                    findings: true,
                },
            },
            findings: true,
            synthesis: {
                orderBy: { order: "asc" },
            },
            presentation: true,
        },
    });

    if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({ run });
}

// PATCH /api/run/[id] — Update run status
const VALID_STATUSES = [
    "INITIALIZE", "THINK", "CONSTRUCT", "DEPLOY", "SPAWN", "EXECUTE",
    "MONITOR", "SYNTHESIZE", "VERIFY", "PRESENT", "DELIVER", "COMPLETE", "FAILED", "CANCELLED",
];

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    try {
        const run = await prisma.run.update({
            where: { id },
            data: {
                status: body.status,
                ...(body.status === "DELIVER" ? { completedAt: new Date() } : {}),
            },
        });
        return NextResponse.json({ run });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Record to update not found") || message.includes("P2025")) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
