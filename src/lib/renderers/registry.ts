import type { IRGraph } from "@/lib/pipeline/ir-types";
import type { Renderer, RenderFormat, RenderOutput } from "./types";
import { executiveMemoRenderer } from "./executive-memo";
import { jsonExportRenderer, csvExportRenderer } from "./data-export";
import { pdfRenderer } from "./pdf-renderer";
import { dataRoomRenderer } from "./data-room";

const renderers: Map<RenderFormat, Renderer> = new Map();

function register(renderer: Renderer) {
  renderers.set(renderer.format, renderer);
}

// Register built-in renderers
register(executiveMemoRenderer);
register(jsonExportRenderer);
register(csvExportRenderer);
register(pdfRenderer);
register(dataRoomRenderer);

export function getRenderer(format: RenderFormat): Renderer | undefined {
  return renderers.get(format);
}

export function listRenderers(): Renderer[] {
  return Array.from(renderers.values());
}

export function listAvailableFormats(ir: IRGraph): RenderFormat[] {
  return Array.from(renderers.values())
    .filter((r) => r.canRender(ir))
    .map((r) => r.format);
}

export async function renderFormat(
  format: RenderFormat,
  ir: IRGraph,
  options?: Record<string, unknown>,
): Promise<RenderOutput> {
  const renderer = renderers.get(format);
  if (!renderer) {
    throw new Error(`No renderer registered for format: ${format}`);
  }
  if (!renderer.canRender(ir)) {
    throw new Error(`Renderer "${format}" cannot render this IR Graph (insufficient data)`);
  }
  return renderer.render(ir, options);
}
