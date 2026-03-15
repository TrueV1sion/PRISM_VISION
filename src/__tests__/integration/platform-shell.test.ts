import { describe, it, expect } from "vitest";
import {
  getEngineRegistry,
  getDefaultEngine,
  getEngineById,
  getActiveEngines,
} from "@/lib/engines/registry";

describe("Platform Shell Integration", () => {
  describe("Engine Registry", () => {
    it("command center is the default engine", () => {
      const def = getDefaultEngine();
      expect(def.id).toBe("command-center");
      expect(def.route).toBe("/");
      expect(def.isDefault).toBe(true);
    });

    it("has 6 total engines registered", () => {
      const engines = getEngineRegistry();
      expect(engines).toHaveLength(6);
    });

    it("active engines excludes hidden", () => {
      const active = getActiveEngines();
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.every((e) => e.status !== "hidden")).toBe(true);
    });

    it("all coming-soon engines have valid routes under /engines/", () => {
      const engines = getEngineRegistry().filter(
        (e) => e.status === "coming-soon",
      );
      for (const engine of engines) {
        expect(engine.route).toMatch(/^\/engines\/[a-z-]+$/);
        expect(engine.isDefault).toBe(false);
      }
    });

    it("each engine has a unique accent color", () => {
      const engines = getEngineRegistry();
      const colors = engines.map((e) => e.accentColor);
      expect(new Set(colors).size).toBe(colors.length);
    });

    it("engine IDs are unique", () => {
      const engines = getEngineRegistry();
      const ids = engines.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all engines can be found by ID", () => {
      const engines = getEngineRegistry();
      for (const engine of engines) {
        expect(getEngineById(engine.id)).toBe(engine);
      }
    });
  });

  describe("Route Mapping", () => {
    it("command center maps to /", () => {
      const cc = getEngineById("command-center");
      expect(cc?.route).toBe("/");
    });

    it("M&A engine maps to /engines/ma", () => {
      const ma = getEngineById("ma");
      expect(ma?.route).toBe("/engines/ma");
    });

    it("all non-default engines use /engines/ prefix", () => {
      const engines = getEngineRegistry().filter((e) => !e.isDefault);
      for (const engine of engines) {
        expect(engine.route.startsWith("/engines/")).toBe(true);
      }
    });
  });
});
