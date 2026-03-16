/**
 * POST /api/pipeline/triage — Save HITL triage decisions for findings.
 *
 * Receives the user's finding actions (keep/dismiss/boost/flag) and
 * persists them to the database so the synthesis phase can honor them.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_ACTIONS = ["keep", "dismiss", "boost", "flag"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, actions } = body as {
      runId: string;
      actions: Record<string, string>;
    };

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    if (!actions || typeof actions !== "object") {
      return NextResponse.json({ error: "actions map is required" }, { status: 400 });
    }

    // Validate all action values
    for (const [findingId, action] of Object.entries(actions)) {
      if (!VALID_ACTIONS.includes(action)) {
        return NextResponse.json(
          { error: `Invalid action "${action}" for finding "${findingId}"` },
          { status: 400 },
        );
      }
    }

    // Batch update findings via Supabase db layer
    // db.finding doesn't expose updateMany by id, so use the supabase client directly
    const { supabase } = await import("@/lib/supabase");
    const updates = Object.entries(actions).map(([findingId, action]) =>
      supabase
        .from("findings")
        .update({ action })
        .eq("id", findingId)
        .eq("run_id", runId),
    );

    const results = await Promise.all(updates);
    for (const { error } of results) {
      if (error) throw new Error(`Failed to update finding: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(actions).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
