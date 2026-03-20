/**
 * Archetype Registry Tests — Phase 1 Verification
 *
 * Validates all 56 archetypes exist, types are synchronized,
 * composition chemistry rules reference valid archetypes,
 * and search/forge functions operate correctly.
 */

import { describe, it, expect } from "vitest";
import {
  ARCHETYPE_REGISTRY,
  COMPOSITION_CHEMISTRY,
  searchArchetypes,
  getArchetype,
  getArchetypesForSkill,
  forgeArchetype,
  type ArchetypeCategory,
  type ArchetypeProfile,
} from "../archetypes";

// ─── Registry Completeness ──────────────────────────────────

describe("ARCHETYPE_REGISTRY", () => {
  const allArchetypes = Object.values(ARCHETYPE_REGISTRY);
  const allIds = Object.keys(ARCHETYPE_REGISTRY);

  it("contains exactly 57 archetypes (33 original + 24 expansion)", () => {
    // 33 original: RESEARCHER, RESEARCHER-WEB, RESEARCHER-DATA, RESEARCHER-DOMAIN,
    // RESEARCHER-LATERAL, ANALYST, ANALYST-FINANCIAL, ANALYST-STRATEGIC, ANALYST-TECHNICAL,
    // ANALYST-RISK, ANALYST-QUALITY, CREATOR, CREATOR-WRITER, CREATOR-PRESENTER,
    // CREATOR-TECHNICAL, CREATOR-PERSUADER, CRITIC, CRITIC-FACTUAL, CRITIC-LOGICAL,
    // CRITIC-STRATEGIC, CRITIC-EDITORIAL, SYNTHESIZER, ARBITER, ORCHESTRATOR, OPTIMIZER,
    // DEVILS_ADVOCATE, FUTURIST, HISTORIAN, RED_TEAM, CUSTOMER_PROXY,
    // LEGISLATIVE-PIPELINE, REGULATORY-RADAR, MACRO-CONTEXT
    // + 24 new: MA-SIGNAL-HUNTER, MA-INTEGRATOR, VC-SCOUT, PAYER-ANALYST, PROVIDER-MAPPER,
    // SUPPLY-CHAIN-TRACKER, UX-BENCHMARKER, PROCESS-ARCHAEOLOGIST, INFLUENCE-MAPPER,
    // TALENT-TRACKER, MARKET-SIZER, SCENARIO-MODELER, VALUE-CHAIN-ANALYST, BENCHMARKER,
    // MATURITY-ASSESSOR, WARGAMER, DILIGENCE-AUDITOR, PRICING-STRATEGIST, ECOSYSTEM-MAPPER,
    // NETWORK-ANALYST, SIGNAL-CORRELATOR, SENTINEL, DATA-CURATOR, NARRATOR
    expect(allArchetypes.length).toBe(57);
  });

  it("has id field matching the registry key for every archetype", () => {
    for (const [key, profile] of Object.entries(ARCHETYPE_REGISTRY)) {
      expect(profile.id).toBe(key);
    }
  });

  it("every archetype has required fields", () => {
    for (const profile of allArchetypes) {
      expect(profile.id).toBeTruthy();
      expect(profile.family).toBeTruthy();
      expect(profile.category).toBeTruthy();
      expect(profile.lens).toBeTruthy();
      expect(profile.bias).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.promptTemplate).toBeTruthy();
      expect(Array.isArray(profile.tags)).toBe(true);
      expect(profile.tags.length).toBeGreaterThan(0);
      expect(Array.isArray(profile.compatibleSkills)).toBe(true);
      expect(profile.minSwarmTier).toBeTruthy();
      expect(profile.synthesisRole).toBeTruthy();
    }
  });

  // ─── Phase 1 Healthcare Domain Archetypes ─────────────────

  const healthcareDomainIds = [
    "MA-SIGNAL-HUNTER", "MA-INTEGRATOR", "VC-SCOUT",
    "PAYER-ANALYST", "PROVIDER-MAPPER", "SUPPLY-CHAIN-TRACKER",
  ];

  for (const id of healthcareDomainIds) {
    it(`contains healthcare domain archetype: ${id}`, () => {
      const arch = ARCHETYPE_REGISTRY[id];
      expect(arch).toBeDefined();
      expect(arch.category).toBe("healthcare_domain");
    });
  }

  // ─── Phase 1 Specialist Archetypes ────────────────────────

  const specialistIds = [
    "UX-BENCHMARKER", "PROCESS-ARCHAEOLOGIST", "INFLUENCE-MAPPER", "TALENT-TRACKER",
    "MARKET-SIZER", "SCENARIO-MODELER", "VALUE-CHAIN-ANALYST", "BENCHMARKER",
    "MATURITY-ASSESSOR", "WARGAMER",
  ];

  for (const id of specialistIds) {
    it(`contains specialist archetype: ${id}`, () => {
      const arch = ARCHETYPE_REGISTRY[id];
      expect(arch).toBeDefined();
      expect(arch.category).toBe("specialist");
    });
  }

  // ─── Phase 1 Operational Archetypes ───────────────────────

  const operationalIds = [
    "DILIGENCE-AUDITOR", "PRICING-STRATEGIST", "ECOSYSTEM-MAPPER", "NETWORK-ANALYST",
  ];

  for (const id of operationalIds) {
    it(`contains operational archetype: ${id}`, () => {
      const arch = ARCHETYPE_REGISTRY[id];
      expect(arch).toBeDefined();
      expect(arch.category).toBe("operational");
    });
  }

  // ─── Phase 1 Meta Archetypes ──────────────────────────────

  const metaIds = [
    "SIGNAL-CORRELATOR", "SENTINEL", "DATA-CURATOR", "NARRATOR",
  ];

  for (const id of metaIds) {
    it(`contains meta archetype: ${id}`, () => {
      const arch = ARCHETYPE_REGISTRY[id];
      expect(arch).toBeDefined();
      expect(arch.category).toBe("meta");
    });
  }

  it("has valid category for every archetype", () => {
    const validCategories: ArchetypeCategory[] = [
      "core", "core_variant", "specialist", "meta", "healthcare_domain", "operational",
    ];
    for (const profile of allArchetypes) {
      expect(validCategories).toContain(profile.category);
    }
  });
});

// ─── Composition Chemistry ──────────────────────────────────

describe("COMPOSITION_CHEMISTRY", () => {
  it("contains 26 composition rules (10 original + 16 expansion)", () => {
    expect(COMPOSITION_CHEMISTRY.length).toBe(26);
  });

  it("all rules reference valid archetype IDs or families", () => {
    const allIds = new Set(Object.keys(ARCHETYPE_REGISTRY));
    // Also include base family IDs that exist as archetypes
    for (const rule of COMPOSITION_CHEMISTRY) {
      const aExists = allIds.has(rule.archetypeA);
      const bExists = allIds.has(rule.archetypeB);
      // Some rules reference base families (RESEARCHER, ANALYST, CREATOR, CRITIC)
      // which are valid registry entries
      expect(aExists).toBe(true);
      expect(bExists).toBe(true);
    }
  });

  it("all rules have valid chemistry types", () => {
    const validTypes = ["catalytic", "transformative", "additive"];
    for (const rule of COMPOSITION_CHEMISTRY) {
      expect(validTypes).toContain(rule.chemistry);
    }
  });

  it("all rules have non-empty emergent capabilities", () => {
    for (const rule of COMPOSITION_CHEMISTRY) {
      expect(rule.emergentCapability.length).toBeGreaterThan(10);
    }
  });

  it("no duplicate pairs", () => {
    const pairKeys = COMPOSITION_CHEMISTRY.map(r =>
      [r.archetypeA, r.archetypeB].sort().join("+"),
    );
    const unique = new Set(pairKeys);
    expect(unique.size).toBe(pairKeys.length);
  });
});

// ─── Search Functions ───────────────────────────────────────

describe("searchArchetypes", () => {
  it("filters by category", () => {
    const healthcare = searchArchetypes({ category: "healthcare_domain" });
    expect(healthcare.length).toBeGreaterThanOrEqual(9); // 3 original + 6 new
    expect(healthcare.every(a => a.category === "healthcare_domain")).toBe(true);
  });

  it("filters by operational category (new in Phase 1)", () => {
    const operational = searchArchetypes({ category: "operational" });
    expect(operational.length).toBe(4);
    expect(operational.every(a => a.category === "operational")).toBe(true);
  });

  it("filters by tags", () => {
    const maArchetypes = searchArchetypes({ tags: ["ma"] });
    expect(maArchetypes.length).toBeGreaterThanOrEqual(2);
    expect(maArchetypes.some(a => a.id === "MA-SIGNAL-HUNTER")).toBe(true);
  });

  it("filters by synthesis role", () => {
    const validators = searchArchetypes({ synthesisRole: "validator" });
    expect(validators.length).toBeGreaterThanOrEqual(5);
    expect(validators.every(a => a.synthesisRole === "validator")).toBe(true);
  });

  it("returns empty array for non-matching criteria", () => {
    const none = searchArchetypes({ tags: ["nonexistent-tag-xyz"] });
    expect(none.length).toBe(0);
  });
});

describe("getArchetype", () => {
  it("returns archetype for valid ID", () => {
    const arch = getArchetype("MA-SIGNAL-HUNTER");
    expect(arch).toBeDefined();
    expect(arch!.id).toBe("MA-SIGNAL-HUNTER");
  });

  it("returns undefined for invalid ID", () => {
    expect(getArchetype("NONEXISTENT")).toBeUndefined();
  });
});

describe("getArchetypesForSkill", () => {
  it("finds archetypes compatible with healthcare-ma-signal-hunter", () => {
    const archs = getArchetypesForSkill("healthcare-ma-signal-hunter");
    expect(archs.length).toBeGreaterThanOrEqual(2);
    expect(archs.some(a => a.id === "MA-SIGNAL-HUNTER")).toBe(true);
  });

  it("returns empty for unknown skill", () => {
    expect(getArchetypesForSkill("fake-skill-name").length).toBe(0);
  });
});

describe("forgeArchetype", () => {
  it("returns a valid ForgedArchetype", () => {
    const forged = forgeArchetype("supply-chain-disruption", {
      domain: "pharmaceutical manufacturing",
      lens: "What supply disruptions are imminent?",
      style: "Quantitative with timeline estimates",
      bias: "UPSTREAM FOCUS",
      successMetric: "Early warning accuracy",
    });

    expect(forged.forged).toBe(true);
    expect(forged.forgedFrom).toBe("supply-chain-disruption");
    expect(forged.id).toBe("FORGED-SUPPLY-CHAIN-DISRUPTION");
    expect(forged.category).toBe("specialist");
    expect(forged.tags).toContain("forged");
  });
});
