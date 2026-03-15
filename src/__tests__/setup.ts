import { beforeEach, afterEach, vi } from "vitest";
import { resetDbMock } from "@/__mocks__/prisma";
import { resetAnthropicMock } from "@/__mocks__/anthropic";
import { resetMCPMock } from "@/__mocks__/mcp";

beforeEach(() => {
  resetDbMock();
  resetAnthropicMock();
  resetMCPMock();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
