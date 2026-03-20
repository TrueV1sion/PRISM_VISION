import { describe, expect, it } from "vitest";

import { resolvePresentationPipelineMode } from "../present-orchestrator";

describe("resolvePresentationPipelineMode", () => {
  it("defaults to legacy when unset", () => {
    expect(resolvePresentationPipelineMode({})).toBe("legacy");
  });

  it("normalizes supported modes", () => {
    expect(
      resolvePresentationPipelineMode({
        PRISM_PRESENTATION_MODE: " AUTO ",
      } as NodeJS.ProcessEnv),
    ).toBe("auto");

    expect(
      resolvePresentationPipelineMode({
        PRISM_PRESENTATION_MODE: "template",
      } as NodeJS.ProcessEnv),
    ).toBe("template");
  });

  it("falls back to legacy on invalid values", () => {
    expect(
      resolvePresentationPipelineMode({
        PRISM_PRESENTATION_MODE: "ship-it",
      } as NodeJS.ProcessEnv),
    ).toBe("legacy");
  });
});
