import type { IRGraph } from "@/lib/pipeline/ir-types";

export type RenderFormat =
  | "html-brief"
  | "executive-memo"
  | "pdf"
  | "data-export-json"
  | "data-export-csv"
  | "data-room";

export interface RenderOutput {
  format: RenderFormat;
  mimeType: string;
  content: string | Buffer;
  filename: string;
}

export interface Renderer {
  format: RenderFormat;
  name: string;
  description: string;
  canRender(ir: IRGraph): boolean;
  render(ir: IRGraph, options?: Record<string, unknown>): Promise<RenderOutput>;
}
