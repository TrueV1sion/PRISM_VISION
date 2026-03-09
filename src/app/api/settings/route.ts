/**
 * GET /api/settings — Load platform settings
 * PUT /api/settings — Save platform settings
 */

import { NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings-store";
import { z } from "zod";

const SettingsSchema = z.object({
    primaryModel: z.string(),
    fallbackModel: z.string(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(1).max(200000),
    blueprintGateEnabled: z.boolean(),
    blueprintAutoApproveThreshold: z.number().min(0).max(100),
    findingsGateEnabled: z.boolean(),
    findingsAutoApproveThreshold: z.number().min(0).max(100),
    synthesisGateEnabled: z.boolean(),
    synthesisAutoApproveThreshold: z.number().min(0).max(100),
    defaultUrgency: z.enum(["speed", "balanced", "thorough"]),
    maxAgents: z.number().int().min(1).max(20),
    enableMemoryBus: z.boolean(),
    enableCriticPass: z.boolean(),
    enabledSkills: z.array(z.string()),
});

export async function GET() {
    try {
        const settings = await loadSettings();
        return NextResponse.json(settings);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const parsed = SettingsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid settings", details: parsed.error.issues }, { status: 400 });
        }
        const saved = await saveSettings(parsed.data);
        return NextResponse.json(saved);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
