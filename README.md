# Protoprism

**Multi-agent strategic intelligence platform** that decomposes complex research questions into parallel agent streams, synthesizes emergent cross-cutting insights, and renders cinematic HTML5 executive briefings.

Built for healthcare strategic intelligence with 6 specialized engines, 22 MCP data servers, and 19 domain research modules.

---

## How It Works

Protoprism orchestrates a 7-phase intelligence pipeline powered by Claude Opus and Sonnet:

```
QUERY ──► THINK ──► CONSTRUCT ──► DEPLOY ──► SYNTHESIZE ──► QA ──► PRESENT ──► COMPLETE
           │           │            │             │           │        │           │
      Decompose    Build agent   Run 2-15     4 emergence  Provenance  HTML5     DB persist
      into dims    prompts from  agents in    detection    & quality   cinematic  + export
      + roster     archetypes    parallel     algorithms   scoring     briefing
```

| Phase | Model | What Happens |
|-------|-------|-------------|
| **THINK** | Opus (extended thinking) | Decomposes query into 2-15 analytical dimensions, scores complexity, assigns tier (MICRO → CAMPAIGN), builds agent roster |
| **CONSTRUCT** | Sonnet | Personalizes system prompts per agent from 22 archetype templates, injects domain skills and tool lists |
| **DEPLOY** | Sonnet (agents) / Opus (CRITIC) | Runs agents in parallel with tool-use loops across 30+ data sources. Two-wave execution for complex runs. MemoryBus enables cross-agent context sharing |
| **SYNTHESIZE** | Opus (extended thinking) | 4 emergence detection algorithms produce 5 synthesis layers: Foundation, Convergence, Tension, Emergence, Gap |
| **QA** | — | Provenance chain validation, claim-to-source traceability, hallucination detection, quality scoring (grade A-F) |
| **PRESENT** | Opus | 10-stage agentic slide generation with template pipeline fallback. Produces self-contained HTML5 presentations with charts, animations, and full source attribution |
| **COMPLETE** | — | Database persistence, version management, export (PPTX, PDF, HTML, ZIP) |

---

## Key Features

### Multi-Agent Research Orchestration
- **Dimensional decomposition** — automatically breaks complex queries into independent analytical axes
- **22 agent archetypes** — specialized personas (Regulatory Radar, Financial Analyst, M&A Signal Hunter, Patent Landscape, etc.)
- **Parallel execution** — 2-15 agents run simultaneously with tool-use loops
- **MemoryBus** — cross-agent blackboard for findings, signals, and conflicts

### Emergence Detection
Four algorithms find insights only visible at multi-agent scale:
1. **Cross-Agent Theme Mining** — same concept surfaced from different evidence sources
2. **Tension Point Mapping** — conflicting agent positions with resolution framework
3. **Gap Triangulation** — shared absences across agents
4. **Structural Pattern Recognition** — deep principle extraction

### 6 Intelligence Engines

| Engine | Focus | Key Archetypes |
|--------|-------|----------------|
| **Command Center** | General strategic intelligence | All families |
| **M&A** | Mergers, acquisitions, deal flow | MA-Signal-Hunter, Diligence-Auditor, Network-Analyst |
| **Finance** | Financial health, valuation, markets | Financial-Analyst, Value-Chain, Pricing-Strategist |
| **Regulatory** | CMS/HHS rules, legislation, compliance | Regulatory-Radar, Legislative-Pipeline, Influence-Mapper |
| **Sales** | Competitive intel, battlecards | Creator-Persuader, Ecosystem-Mapper, Customer-Proxy |
| **Product** | Tech landscape, innovation, patents | UX-Benchmarker, Maturity-Assessor, Futurist |

### Cinematic Presentations
- **Agentic HTML5 generation** — Claude Opus directly composes interactive presentations
- **Template pipeline fallback** — 25+ layout/data-viz/composite templates (SF, DV, CL, CO families)
- **Design token system** — OKLCH color science, APCA-validated contrast, 13-layer token hierarchy
- **Chart compiler** — donut, bar, sparkline, and comparison charts from agent data
- **Animations** — scroll-reveal, parallax, animated counters, stagger effects

### Scenario Analysis (What-If)
- Fork completed runs into scenario trees
- 5 lever types: tension_flip, gap_resolve, metric_adjust, finding_suppress, finding_amplify
- Re-synthesis with mutations
- Sensitivity analysis and forecasting
- Side-by-side scenario comparison

### Real-Time Collaboration
- **Yjs CRDT** — simultaneous multi-user editing
- **Threaded annotations** — per-slide comments with replies
- **Presence awareness** — active slide tracking and cursors
- **Version management** — draft → review → published lifecycle

### SENTINEL Signal Detection
- RSS/Atom feed monitoring with entity extraction
- Signal classification (M&A convergence, regulatory shift, market movement, etc.)
- Severity levels (low → critical) with confidence scoring
- Scheduled cron-based polling

---

## Data Source Architecture

Three-layer tool system with 60+ data sources:

### Layer 1: MCP Servers (22 sidecars)

| Category | Servers |
|----------|---------|
| **Clinical & Medical** | PubMed, ClinicalTrials.gov, OpenFDA, FDA Orange Book, ICD-10, NPI Registry |
| **Regulatory & Government** | CMS Coverage, Federal Register, Congress.gov, GPO GovInfo |
| **Economic & Market** | BLS, Census Bureau, SEC EDGAR, SAM.gov, Grants.gov |
| **Healthcare Quality** | AHRQ HCUP, WHO GHO, OECD Health |
| **Innovation** | USPTO Patents, CBO |
| **Research** | bioRxiv Preprints |

### Layer 2: In-Process API Clients (20 clients)
Direct API clients with caching and rate limiting for Hospital Compare, OpenSecrets, Leapfrog, SBIR.gov, CMS Open Payments, and more.

### Layer 3: Research Intelligence Modules (19 modules)
Domain-specific research capabilities: clinical-evidence, competitive-intel, drug-safety, patent-landscape, regulatory-landscape, market-dynamics, provider-quality, and more.

**Plus**: Anthropic's native `web_search` tool for real-time web research (assigned to 7 archetypes).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, standalone output) + React 19 |
| **AI** | Anthropic SDK — Claude Opus 4.6 (reasoning) + Claude Sonnet 4.6 (execution) |
| **Database** | PostgreSQL via Prisma 7 |
| **Styling** | Tailwind CSS v4 + OKLCH design tokens (APCA contrast) |
| **Animations** | Framer Motion |
| **Collaboration** | Yjs + y-websocket (CRDT real-time sync) |
| **Validation** | Zod 4 at every pipeline boundary |
| **Caching** | Redis (Upstash) |
| **Tools** | Model Context Protocol SDK |
| **Testing** | Vitest + vitest-mock-extended |
| **Icons** | Lucide React |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Anthropic API key

### Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in:
#   ANTHROPIC_API_KEY — Claude API key (required)
#   DATABASE_URL     — PostgreSQL connection string (required)
#   MCP_*_URL        — MCP server endpoints (optional, ports 3010-3024)
#   NCBI_API_KEY, CONGRESS_API_KEY, etc. — data source keys (optional)

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the Command Center.

### Start MCP Servers (optional)

```bash
npm run mcp:start    # Start all 22 local MCP sidecar servers
npm run mcp:status   # Check which servers are running
npm run mcp:stop     # Stop all servers
```

MCP servers are optional — unavailable servers degrade gracefully and are tracked as gaps in agent results, not pipeline failures.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (auto-compiles design spec) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run type-check` | TypeScript validation (`tsc --noEmit`) |
| `npm run ci` | Full CI: lint + type-check + test + build |
| `npm run spec:compile` | Compile `design-tokens.yaml` → `presentation-system.md` |
| `npm run spec:watch` | Watch mode for spec compilation |
| `npm run mcp:start` | Start all MCP sidecar servers |
| `npm run mcp:stop` | Stop MCP servers |
| `npm run mcp:status` | Check MCP server status |
| `npm run mcp:restart` | Restart MCP servers |

---

## Project Structure

```
src/
├── app/
│   ├── (platform)/              # Main app routes (sidebar layout)
│   │   ├── page.tsx             # Command Center (default engine)
│   │   ├── engines/[engineId]/  # Engine-specific dashboards
│   │   ├── scenarios/[runId]/   # What-if scenario views
│   │   ├── history/             # Run history
│   │   └── briefs/[id]/         # Presentation viewer + editor
│   ├── auth/                    # Authentication pages
│   └── api/
│       ├── pipeline/            # Core pipeline endpoints (stream, triage, approve, execute)
│       ├── presentation/        # Presentation CRUD + versioning
│       ├── scenarios/           # Scenario management + computation
│       ├── signals/             # Signal detection
│       ├── feeds/               # RSS/Atom feed management
│       ├── cron/                # Scheduled jobs (feeds, datasets, health, sentinel)
│       └── settings/            # Platform configuration
├── components/
│   ├── engines/                 # Engine dashboards (M&A, Finance, Regulatory, Sales, Product)
│   ├── phases/                  # Pipeline phase UIs (Input, Triage, Executing, Synthesis, Complete)
│   ├── platform/                # Shell components (Header, Sidebar)
│   ├── scenarios/               # Scenario insight canvas
│   └── editor/                  # Collaborative presentation editor (Yjs)
├── lib/
│   ├── ai/                      # Anthropic client, model routing, cost tracking
│   ├── pipeline/                # 7-phase orchestration engine
│   │   ├── think.ts             # Dimensional decomposition
│   │   ├── construct.ts         # Agent prompt assembly
│   │   ├── deploy.ts            # Parallel agent execution
│   │   ├── synthesize.ts        # 4 emergence algorithms, 5 synthesis layers
│   │   ├── quality-assurance.ts # Provenance + quality scoring
│   │   ├── present-orchestrator.ts  # 3-fallback presentation generation
│   │   ├── present/             # Template pipeline (10 stages)
│   │   ├── executor.ts          # Main pipeline orchestrator
│   │   ├── memory-bus.ts        # Cross-agent state sharing
│   │   ├── ir-enricher.ts       # Progressive IR graph building
│   │   ├── archetypes.ts        # 22 agent archetype definitions
│   │   ├── skill-router.ts      # Domain skill injection
│   │   └── retry.ts             # Exponential backoff with jitter
│   ├── data-sources/
│   │   ├── registry.ts          # 3-layer tool routing
│   │   ├── clients/             # 20 in-process API clients
│   │   ├── research/            # 19 domain research modules
│   │   └── mcp-bridge.ts        # MCP protocol bridge
│   ├── engines/                 # Engine registry + type definitions
│   ├── mcp/                     # MCP client + server config (22 archetypes → servers)
│   ├── signals/                 # SENTINEL signal detection
│   ├── datasets/                # Dataset snapshot + delta tracking
│   └── scenarios/               # Scenario computation engine
├── hooks/                       # React hooks (use-research-stream, etc.)
└── generated/prisma/            # Prisma-generated types (do not edit)

mcp-servers/                     # 22 MCP sidecar server implementations
prisma/schema.prisma             # Database schema (25+ models)
design-tokens.yaml               # 13-layer design token definitions
references/
├── presentation-system.md       # Compiled presentation spec (PRESENT phase system prompt)
└── exemplars/                   # Golden exemplar HTML fragments
public/
├── styles/presentation.css      # 176+ presentation component classes
├── js/presentation.js           # Presentation runtime (nav, scroll, animations)
├── decks/                       # Generated briefing HTML files
└── briefs/                      # Published presentations
```

---

## Pipeline Architecture Details

### Run Tiers

| Tier | Agents | Use Case |
|------|--------|----------|
| MICRO | 2-3 | Quick, focused questions |
| STANDARD | 4-6 | Typical strategic queries |
| EXTENDED | 7-10 | Deep multi-dimensional analysis |
| MEGA | 11-13 | Comprehensive intelligence sweeps |
| CAMPAIGN | 14-15 | Full-spectrum strategic assessment |

### Abort Signal Protocol
- **Before SYNTHESIZE**: each phase checks `AbortSignal` — safe to cancel
- **After SYNTHESIZE**: never abort. Always finish through PRESENT to avoid losing expensive computation

### MemoryBus
Cross-phase blackboard using `globalThis` for module-reload survival:
```
getOrCreateBus(runId) → agents post findings/signals → removeBus(runId)
```
Signal priorities: `low | medium | high | critical`

### IR Graph
Intermediate representation built progressively:
1. `enrichAfterDeploy()` — agent findings + tool calls
2. `enrichAfterSynthesize()` — emergence insights
3. `enrichAfterQA()` — quality scores + provenance

---

## Database Schema

25+ Prisma models organized across domains:

- **Pipeline**: Run, Agent, Finding, Dimension, Synthesis, MemoryBusSnapshot, IrGraph
- **Presentations**: Presentation, PresentationVersion, SlideVersion, SlideAnnotation, AnnotationReply, PresentationQuality
- **Scenarios**: Scenario, ScenarioLever, ScenarioResult
- **Data Pipeline**: FeedSource, FeedItem, DatasetSource, DatasetSnapshot, DatasetDelta, Signal, Alert
- **Telemetry**: ToolCallLog, EnrichedMetric, EntityRegistry
- **Auth**: User, Account, Session, Team, TeamMember, VerificationToken
- **Config**: Settings, ApiKey

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MCP_*_URL` | No | MCP server SSE endpoints (15 servers, ports 3010-3024) |
| `NCBI_API_KEY` | No | PubMed/NCBI API key |
| `CONGRESS_API_KEY` | No | Congress.gov API key |
| `CENSUS_API_KEY` | No | Census Bureau API key |
| `BLS_API_KEY` | No | Bureau of Labor Statistics API key |
| `ENCRYPTION_SECRET` | No | API key encryption (change default in prod) |

---

## Architecture Reference

For detailed architecture documentation, coding conventions, pipeline phase internals, tool architecture, MCP routing, and design system rules, see [CLAUDE.md](./CLAUDE.md).

---

## License

Private repository.
