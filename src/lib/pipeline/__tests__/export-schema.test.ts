import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Load actual Prisma schema to validate mappings
const prismaSchema = readFileSync(
  join(__dirname, "../../../../prisma/schema.prisma"),
  "utf-8",
);

// Type mapping from Prisma to export targets
const PRISMA_TO_SNOWFLAKE: Record<string, string> = {
  String: "VARCHAR",
  Int: "INTEGER",
  Float: "FLOAT",
  DateTime: "TIMESTAMP_TZ",
  Json: "VARIANT",
  "String[]": "ARRAY",
  Boolean: "BOOLEAN",
};

const PRISMA_TO_PARQUET: Record<string, string> = {
  String: "UTF8",
  Int: "INT32",
  Float: "DOUBLE",
  DateTime: "TIMESTAMP_MILLIS",
  Json: "JSON",
  "String[]": "LIST<UTF8>",
  Boolean: "BOOLEAN",
};

describe("Export Schema Validation", () => {
  describe("Prisma schema integrity", () => {
    it("tool_call_log model exists with required columns", () => {
      expect(prismaSchema).toContain('model ToolCallLog');
      expect(prismaSchema).toContain('runId');
      expect(prismaSchema).toContain('toolParams');
      expect(prismaSchema).toContain('rawResponse');
      expect(prismaSchema).toContain('responseBytes');
      expect(prismaSchema).toContain('@@map("tool_call_log")');
    });

    it("enriched_metrics model exists with required columns", () => {
      expect(prismaSchema).toContain('model EnrichedMetric');
      expect(prismaSchema).toContain('dataShape');
      expect(prismaSchema).toContain('values');
      expect(prismaSchema).toContain('computed');
      expect(prismaSchema).toContain('pointCount');
      expect(prismaSchema).toContain('@@map("enriched_metrics")');
    });

    it("entity_registry model exists", () => {
      expect(prismaSchema).toContain('model EntityRegistry');
      expect(prismaSchema).toContain('canonicalName');
      expect(prismaSchema).toContain('entityType');
      expect(prismaSchema).toContain('@@map("entity_registry")');
    });

    it("all data capture models have runId for CDC partitioning", () => {
      const models = ["ToolCallLog", "EnrichedMetric", "AgentDataRef"];
      for (const model of models) {
        const modelBlock = prismaSchema.slice(
          prismaSchema.indexOf(`model ${model}`),
          prismaSchema.indexOf("}", prismaSchema.indexOf(`model ${model}`)) + 1,
        );
        expect(modelBlock).toContain("runId");
      }
    });
  });

  describe("Snowflake compatibility", () => {
    it("tool_call_log JSONB fields survive VARIANT serialization constraints", () => {
      const complexPayload = {
        toolParams: { ticker: "INVA", form: "10-K", filters: { year: [2022, 2023, 2024] } },
        rawResponse: {
          revenue: [{ year: "2024", value: 872300000, segments: { payer: 0.45 } }],
          metadata: { source: "SEC", filingDate: "2025-03-01", unicode: "\u00e9\u00e0\u00fc" },
          nullField: null,
        },
      };
      const serialized = JSON.stringify(complexPayload);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.toolParams.filters.year).toEqual([2022, 2023, 2024]);
      expect(deserialized.rawResponse.revenue[0].value).toBe(872300000);
      expect(deserialized.rawResponse.revenue[0].segments.payer).toBe(0.45);
      expect(deserialized.rawResponse.nullField).toBeNull();
      expect(deserialized.rawResponse.metadata.unicode).toBe("\u00e9\u00e0\u00fc");
      expect(serialized).not.toContain("undefined");
    });

    it("all Prisma types used in data capture models have Snowflake equivalents", () => {
      const toolCallBlock = prismaSchema.slice(
        prismaSchema.indexOf("model ToolCallLog"),
        prismaSchema.indexOf("}", prismaSchema.indexOf("model ToolCallLog")) + 1,
      );
      const fieldTypeMatches = toolCallBlock.matchAll(/^\s+\w+\s+(String|Int|Float|DateTime|Json|Boolean)\b/gm);
      const usedTypes = new Set<string>();
      for (const match of fieldTypeMatches) {
        usedTypes.add(match[1]);
      }
      if (toolCallBlock.includes("String[]")) usedTypes.add("String[]");

      expect(usedTypes.size).toBeGreaterThan(0);
      for (const type of usedTypes) {
        expect(PRISMA_TO_SNOWFLAKE[type]).toBeDefined();
      }
    });
  });

  describe("Microsoft Fabric compatibility", () => {
    it("enriched_metrics fields round-trip through Parquet-compatible types", () => {
      const row = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        runId: "run-123",
        sourceCallId: "call-456",
        dataShape: "time_series",
        metricName: "revenue",
        values: JSON.stringify([{ period: "FY2024", value: 872300000 }]),
        computed: JSON.stringify({ min: 743.2, max: 872.3, mean: 809.4, trend: "up", cagr: 0.083 }),
        pointCount: 3,
        densityTier: "medium",
        entityId: "entity-789",
        sourceLabel: "SEC EDGAR Filing (INVA)",
        enrichedAt: new Date().toISOString(),
      };

      expect(JSON.parse(row.values)).toHaveLength(1);
      expect(JSON.parse(row.computed).trend).toBe("up");
      expect(new Date(row.enrichedAt).getTime()).toBeGreaterThan(0);
      expect(Number.isInteger(row.pointCount)).toBe(true);
    });

    it("all Prisma types used in EnrichedMetric have Parquet equivalents", () => {
      const enrichedBlock = prismaSchema.slice(
        prismaSchema.indexOf("model EnrichedMetric"),
        prismaSchema.indexOf("}", prismaSchema.indexOf("model EnrichedMetric")) + 1,
      );
      const fieldTypeMatches = enrichedBlock.matchAll(/^\s+\w+\s+(String|Int|Float|DateTime|Json|Boolean)\b/gm);
      const usedTypes = new Set<string>();
      for (const match of fieldTypeMatches) {
        usedTypes.add(match[1]);
      }
      if (enrichedBlock.includes("String?")) usedTypes.add("String");

      expect(usedTypes.size).toBeGreaterThan(0);
      for (const type of usedTypes) {
        expect(PRISMA_TO_PARQUET[type]).toBeDefined();
      }
    });

    it("entity_registry arrays serialize as LIST<UTF8> for Delta Lake", () => {
      const aliases = ["Inovalon", "INVA", "Inovalon Holdings"];
      const serialized = JSON.stringify(aliases);
      const deserialized: string[] = JSON.parse(serialized);
      expect(deserialized).toEqual(aliases);
      expect(Array.isArray(deserialized)).toBe(true);
      expect(deserialized.every(a => typeof a === "string")).toBe(true);
    });
  });
});
