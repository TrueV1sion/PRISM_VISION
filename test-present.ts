import { present } from "./src/lib/pipeline/present";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    console.log("Starting presentation generation test...");
    try {
        const result = await present({
            synthesis: {
                layers: [
                    { name: "foundation", description: "Uncontested Ground", insights: ["GLP-1 adoption is accelerating across all payer segments"] },
                    { name: "convergence", description: "Cross-agent agreement", insights: ["Cost offsets materialize in 18-24 months"] },
                ],
                emergentInsights: [],
                tensionPoints: [],
                overallConfidence: "MEDIUM",
                criticRevisions: [],
            },
            agentResults: [
                {
                    agentName: "Clinical Analyst",
                    archetype: "Analyst",
                    dimension: "Clinical",
                    findings: [{
                        statement: "GLP-1 cost offsets are delayed by 18-24 months.",
                        evidence: "Phase III trial data and real-world evidence studies",
                        implication: "Budget impact models must account for lag",
                        sourceTier: "PRIMARY",
                        confidence: "HIGH",
                        evidenceType: "direct",
                        source: "NEJM 2025 meta-analysis",
                        tags: ["cost", "GLP-1"],
                    }],
                    gaps: [],
                    signals: ["Rising formulary coverage"],
                    minorityViews: [],
                    toolsUsed: ["web_search"],
                    tokensUsed: 1500,
                },
                {
                    agentName: "Market Strategist",
                    archetype: "Strategist",
                    dimension: "Market",
                    findings: [{
                        statement: "Payer adoption curves follow predictable S-curve patterns.",
                        evidence: "Historical formulary data across top 20 PBMs",
                        implication: "Market penetration models can be calibrated",
                        sourceTier: "SECONDARY",
                        confidence: "MEDIUM",
                        evidenceType: "inferred",
                        source: "PBM formulary tracking database",
                        tags: ["market", "adoption"],
                    }],
                    gaps: ["Limited data on Medicaid adoption"],
                    signals: [],
                    minorityViews: [],
                    toolsUsed: ["web_search"],
                    tokensUsed: 1200,
                },
            ],
            blueprint: {
                query: "GLP-1 Impact on Payer Economics 2026",
                tier: "STANDARD",
                dimensions: [
                    { name: "Clinical", description: "Clinical efficacy and outcomes", justification: "Core therapeutic analysis", dataSources: ["PubMed", "ClinicalTrials.gov"], lens: "Evidence-based", signalMatch: "High" },
                    { name: "Market", description: "Market dynamics and adoption", justification: "Commercial impact assessment", dataSources: ["PBM data", "Formulary tracking"], lens: "Strategic", signalMatch: "Medium" },
                ],
                agents: [
                    { name: "Clinical Analyst", archetype: "Analyst", dimension: "Clinical", mandate: "Analyze clinical evidence", tools: ["web_search"], lens: "Cost", bias: "Evidence-focused" },
                    { name: "Market Strategist", archetype: "Strategist", dimension: "Market", mandate: "Assess market dynamics", tools: ["web_search"], lens: "Adoption", bias: "Growth-oriented" },
                ],
                interconnections: [{ dimensionA: "Clinical", dimensionB: "Market", coupling: 4, mechanism: "Clinical evidence drives formulary decisions" }],
                complexityScore: { breadth: 3, depth: 3, interconnection: 4, total: 10, urgency: 1.0, adjusted: 10, reasoning: "Moderate complexity" },
                estimatedTime: "5 minutes",
                ethicalConcerns: [],
            },
            emitEvent: (e) => console.log("Event:", e.type),
        });

        console.log("Presentation generated successfully!");
        console.log("Title:", result.title);
        console.log("Slide Count:", result.slideCount);
        console.log("HTML Size:", result.html.length, "bytes");

        // Write to a test file
        const fs = require("fs");
        fs.writeFileSync("./public/decks/test-css-exclusion.html", result.html);
        console.log("Saved to public/decks/test-css-exclusion.html");
    } catch (error) {
        console.error("Error generating presentation:", error);
    }
}

run();
