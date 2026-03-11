/**
 * Unit tests for PRISM Settings Types & Defaults (src/lib/settings-types.ts)
 *
 * Tests validate:
 * - DEFAULT_SETTINGS has all required fields (primaryModel, fallbackModel, temperature, maxTokens, maxAgents)
 * - Quality gates enabled by default
 * - Default urgency is "balanced"
 * - Healthcare skills enabled by default
 * - Type check (SettingsState assignability)
 * - Spread and override pattern works
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, type SettingsState } from "@/lib/settings-types";

describe("DEFAULT_SETTINGS", () => {
  describe("has all required fields", () => {
    it("has primaryModel set", () => {
      expect(DEFAULT_SETTINGS.primaryModel).toBe("claude-sonnet-4-6");
    });

    it("has fallbackModel set", () => {
      expect(DEFAULT_SETTINGS.fallbackModel).toBe("gpt-4o");
    });

    it("has temperature set", () => {
      expect(DEFAULT_SETTINGS.temperature).toBe(0.3);
    });

    it("has maxTokens set", () => {
      expect(DEFAULT_SETTINGS.maxTokens).toBe(8192);
    });

    it("has maxAgents set", () => {
      expect(DEFAULT_SETTINGS.maxAgents).toBe(8);
    });

    it("has all SettingsState keys present", () => {
      const requiredKeys: (keyof SettingsState)[] = [
        "primaryModel",
        "fallbackModel",
        "temperature",
        "maxTokens",
        "blueprintGateEnabled",
        "blueprintAutoApproveThreshold",
        "findingsGateEnabled",
        "findingsAutoApproveThreshold",
        "synthesisGateEnabled",
        "synthesisAutoApproveThreshold",
        "defaultUrgency",
        "maxAgents",
        "enableMemoryBus",
        "enableCriticPass",
        "enabledSkills",
      ];

      for (const key of requiredKeys) {
        expect(DEFAULT_SETTINGS).toHaveProperty(key);
      }
    });
  });

  describe("quality gates enabled by default", () => {
    it("blueprintGateEnabled is true", () => {
      expect(DEFAULT_SETTINGS.blueprintGateEnabled).toBe(true);
    });

    it("findingsGateEnabled is true", () => {
      expect(DEFAULT_SETTINGS.findingsGateEnabled).toBe(true);
    });

    it("synthesisGateEnabled is true", () => {
      expect(DEFAULT_SETTINGS.synthesisGateEnabled).toBe(true);
    });

    it("has sensible auto-approve thresholds", () => {
      expect(DEFAULT_SETTINGS.blueprintAutoApproveThreshold).toBe(70);
      expect(DEFAULT_SETTINGS.findingsAutoApproveThreshold).toBe(60);
      expect(DEFAULT_SETTINGS.synthesisAutoApproveThreshold).toBe(85);
    });
  });

  describe("default urgency", () => {
    it("defaultUrgency is 'balanced'", () => {
      expect(DEFAULT_SETTINGS.defaultUrgency).toBe("balanced");
    });
  });

  describe("healthcare skills enabled by default", () => {
    it("enabledSkills array is non-empty", () => {
      expect(DEFAULT_SETTINGS.enabledSkills.length).toBeGreaterThan(0);
    });

    it("includes healthcare-quality-analytics", () => {
      expect(DEFAULT_SETTINGS.enabledSkills).toContain("healthcare-quality-analytics");
    });

    it("includes payer-financial-modeling", () => {
      expect(DEFAULT_SETTINGS.enabledSkills).toContain("payer-financial-modeling");
    });

    it("includes regulatory-intelligence", () => {
      expect(DEFAULT_SETTINGS.enabledSkills).toContain("regulatory-intelligence");
    });

    it("includes all 6 default skills", () => {
      expect(DEFAULT_SETTINGS.enabledSkills).toEqual([
        "healthcare-quality-analytics",
        "payer-financial-modeling",
        "regulatory-intelligence",
        "competitive-landscape",
        "ma-market-dynamics",
        "political-influence-mapping",
      ]);
    });
  });

  describe("feature flags", () => {
    it("enableMemoryBus is true by default", () => {
      expect(DEFAULT_SETTINGS.enableMemoryBus).toBe(true);
    });

    it("enableCriticPass is true by default", () => {
      expect(DEFAULT_SETTINGS.enableCriticPass).toBe(true);
    });
  });

  describe("type assignability", () => {
    it("DEFAULT_SETTINGS satisfies SettingsState", () => {
      // TypeScript compile-time check -- if this compiles, the type is assignable
      const settings: SettingsState = DEFAULT_SETTINGS;
      expect(settings).toBeDefined();
    });

    it("custom object satisfies SettingsState", () => {
      const custom: SettingsState = {
        primaryModel: "gpt-4o",
        fallbackModel: "claude-sonnet-4-6",
        temperature: 0.7,
        maxTokens: 4096,
        blueprintGateEnabled: false,
        blueprintAutoApproveThreshold: 50,
        findingsGateEnabled: false,
        findingsAutoApproveThreshold: 50,
        synthesisGateEnabled: false,
        synthesisAutoApproveThreshold: 50,
        defaultUrgency: "speed",
        maxAgents: 4,
        enableMemoryBus: false,
        enableCriticPass: false,
        enabledSkills: [],
      };
      expect(custom.primaryModel).toBe("gpt-4o");
      expect(custom.defaultUrgency).toBe("speed");
    });
  });

  describe("spread and override pattern", () => {
    it("can override individual fields via spread", () => {
      const overridden = {
        ...DEFAULT_SETTINGS,
        temperature: 0.9,
        maxAgents: 12,
        defaultUrgency: "thorough" as const,
      };

      // Overridden values
      expect(overridden.temperature).toBe(0.9);
      expect(overridden.maxAgents).toBe(12);
      expect(overridden.defaultUrgency).toBe("thorough");

      // Non-overridden values preserved
      expect(overridden.primaryModel).toBe("claude-sonnet-4-6");
      expect(overridden.fallbackModel).toBe("gpt-4o");
      expect(overridden.maxTokens).toBe(8192);
      expect(overridden.blueprintGateEnabled).toBe(true);
    });

    it("can override enabledSkills to empty array", () => {
      const overridden = {
        ...DEFAULT_SETTINGS,
        enabledSkills: [],
      };

      expect(overridden.enabledSkills).toEqual([]);
      // Other fields untouched
      expect(overridden.primaryModel).toBe("claude-sonnet-4-6");
    });

    it("does not mutate the original DEFAULT_SETTINGS", () => {
      const _overridden = {
        ...DEFAULT_SETTINGS,
        temperature: 1.0,
        maxAgents: 100,
      };

      expect(DEFAULT_SETTINGS.temperature).toBe(0.3);
      expect(DEFAULT_SETTINGS.maxAgents).toBe(8);
    });
  });
});
