# Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 4-step welcome wizard and coach-marks tour system for non-technical stakeholders.

**Architecture:** Full-screen OnboardingWizard overlay gates InputPhase. CoachMarkProvider wraps phase router, rendering floating tooltips on phase transitions. API key fallback stored encrypted in new ApiKey table. Settings model extended with two boolean flags.

**Tech Stack:** Next.js 16, React 19, Framer Motion, Prisma + SQLite, Node crypto (AES-256-GCM), Tailwind CSS with PRISM theme

---

### Task 1: Extend Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add onboarding fields to Settings and new ApiKey model**

In `prisma/schema.prisma`, add two fields to the Settings model and a new ApiKey model:

```prisma
model Settings {
  id                   String   @id @default("default")
  data                 String   @default("{}")
  onboardingDismissed  Boolean  @default(false)
  hasCompletedTour     Boolean  @default(false)
  updatedAt            DateTime @updatedAt
}

model ApiKey {
  id           String   @id @default(uuid())
  provider     String   @unique
  encryptedKey String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Step 2: Generate migration and apply**

Run:
```bash
npx prisma migrate dev --name add-onboarding-fields
```
Expected: Migration created and applied, `dev.db` updated.

**Step 3: Verify Prisma client types**

Run:
```bash
npx prisma generate
```
Expected: Client generated with new fields.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(onboarding): extend schema with onboarding flags and ApiKey model"
```

---

### Task 2: Crypto Utility

**Files:**
- Create: `src/lib/crypto.ts`

**Step 1: Implement AES-256-GCM encrypt/decrypt**

```typescript
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ENCRYPTION_SECRET env var must be at least 32 characters"
    );
  }
  return Buffer.from(secret.slice(0, 32), "utf-8");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf-8");
}
```

**Step 2: Add ENCRYPTION_SECRET to .env**

Append to `.env`:
```
ENCRYPTION_SECRET="prism-dev-secret-key-change-in-prod"
```

**Step 3: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/crypto.ts .env
git commit -m "feat(onboarding): add AES-256-GCM crypto utility"
```

---

### Task 3: Onboarding API Routes

**Files:**
- Create: `src/app/api/onboarding/status/route.ts`
- Create: `src/app/api/onboarding/keys/route.ts`
- Create: `src/app/api/onboarding/dismiss/route.ts`
- Create: `src/app/api/onboarding/tour-complete/route.ts`

**Step 1: Create GET /api/onboarding/status**

```typescript
// src/app/api/onboarding/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  // Check API keys: env first, then DB
  const anthropicEnv = !!process.env.ANTHROPIC_API_KEY;
  const openaiEnv = !!process.env.OPENAI_API_KEY;

  let anthropicDb = false;
  let openaiDb = false;

  try {
    const keys = await prisma.apiKey.findMany();
    anthropicDb = keys.some((k) => k.provider === "anthropic");
    openaiDb = keys.some((k) => k.provider === "openai");
  } catch {
    // Table may not exist yet
  }

  return NextResponse.json({
    onboardingDismissed: settings?.onboardingDismissed ?? false,
    hasCompletedTour: settings?.hasCompletedTour ?? false,
    keys: {
      anthropic: anthropicEnv || anthropicDb,
      openai: openaiEnv || openaiDb,
    },
  });
}
```

**Step 2: Create POST /api/onboarding/keys**

```typescript
// src/app/api/onboarding/keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const { provider, key } = await req.json();

  if (!provider || !key) {
    return NextResponse.json(
      { error: "provider and key are required" },
      { status: 400 }
    );
  }

  const encryptedKey = encrypt(key);

  await prisma.apiKey.upsert({
    where: { provider },
    update: { encryptedKey },
    create: { provider, encryptedKey },
  });

  return NextResponse.json({ ok: true });
}
```

**Step 3: Create POST /api/onboarding/dismiss**

```typescript
// src/app/api/onboarding/dismiss/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: { onboardingDismissed: true },
    create: { id: "default", onboardingDismissed: true },
  });

  return NextResponse.json({ ok: true });
}
```

**Step 4: Create POST /api/onboarding/tour-complete**

```typescript
// src/app/api/onboarding/tour-complete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: { hasCompletedTour: true },
    create: { id: "default", hasCompletedTour: true },
  });

  return NextResponse.json({ ok: true });
}
```

**Step 5: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 6: Commit**

```bash
git add src/app/api/onboarding/
git commit -m "feat(onboarding): add status, keys, dismiss, and tour-complete API routes"
```

---

### Task 4: API Key Resolution Helper

**Files:**
- Create: `src/lib/resolve-api-key.ts`

**Step 1: Implement resolveApiKey**

```typescript
// src/lib/resolve-api-key.ts
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  ncbi: "NCBI_API_KEY",
};

export async function resolveApiKey(
  provider: string
): Promise<string | null> {
  // 1. Check environment variable
  const envVar = ENV_MAP[provider];
  if (envVar) {
    const envValue = process.env[envVar];
    if (envValue) return envValue;
  }

  // 2. Check database
  try {
    const record = await prisma.apiKey.findUnique({
      where: { provider },
    });
    if (record) return decrypt(record.encryptedKey);
  } catch {
    // DB may not be available
  }

  return null;
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/resolve-api-key.ts
git commit -m "feat(onboarding): add resolveApiKey helper (env then DB fallback)"
```

---

### Task 5: Onboarding Hook

**Files:**
- Create: `src/hooks/use-onboarding.ts`

**Step 1: Implement the hook**

This hook manages onboarding state for the client: fetches status, tracks wizard step, and provides actions.

```typescript
// src/hooks/use-onboarding.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export interface OnboardingStatus {
  onboardingDismissed: boolean;
  hasCompletedTour: boolean;
  keys: { anthropic: boolean; openai: boolean };
}

export type WizardStep = "welcome" | "readiness" | "config" | "ready";

const STEPS: WizardStep[] = ["welcome", "readiness", "config", "ready"];

export function useOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>("welcome");

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: OnboardingStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const nextStep = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const prevStep = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const saveKey = useCallback(
    async (provider: string, key: string) => {
      await fetch("/api/onboarding/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      // Refresh status
      const data = await fetch("/api/onboarding/status").then((r) => r.json());
      setStatus(data);
    },
    []
  );

  const dismiss = useCallback(async () => {
    await fetch("/api/onboarding/dismiss", { method: "POST" });
    setStatus((s) => (s ? { ...s, onboardingDismissed: true } : s));
  }, []);

  const showWizard = !loading && status !== null && !status.onboardingDismissed;
  const stepIndex = STEPS.indexOf(step);

  return {
    status,
    loading,
    showWizard,
    step,
    stepIndex,
    totalSteps: STEPS.length,
    nextStep,
    prevStep,
    saveKey,
    dismiss,
  };
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/hooks/use-onboarding.ts
git commit -m "feat(onboarding): add useOnboarding hook for wizard state management"
```

---

### Task 6: WelcomeStep Component

**Files:**
- Create: `src/components/onboarding/WelcomeStep.tsx`

**Step 1: Implement WelcomeStep**

```tsx
// src/components/onboarding/WelcomeStep.tsx
"use client";

import { motion } from "framer-motion";
import { Hexagon, ChevronRight } from "lucide-react";

export default function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      {/* Animated logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 blur-3xl bg-prism-sky/20 rounded-full scale-150" />
        <Hexagon
          className="w-20 h-20 text-prism-sky relative z-10"
          strokeWidth={1.5}
        />
      </motion.div>

      {/* Brand */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-5xl font-bold mb-4"
      >
        <span className="bg-gradient-to-r from-white via-prism-sky to-prism-cerulean bg-clip-text text-transparent">
          PRISM
        </span>
        <span className="text-prism-muted font-light ml-3">|</span>
        <span className="text-white font-light ml-3">Strategic Intelligence</span>
      </motion.h1>

      {/* Value prop */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-prism-muted text-lg max-w-2xl leading-relaxed mb-12"
      >
        PRISM deploys coordinated AI agent teams to analyze complex strategic
        questions across multiple dimensions simultaneously, synthesizing
        findings into executive-ready intelligence briefs.
      </motion.p>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={onNext}
        className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
      >
        Get Started
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): add WelcomeStep component"
```

---

### Task 7: ReadinessStep Component

**Files:**
- Create: `src/components/onboarding/ReadinessStep.tsx`

**Step 1: Implement ReadinessStep**

```tsx
// src/components/onboarding/ReadinessStep.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Key, ChevronRight, ChevronLeft } from "lucide-react";

interface ReadinessStepProps {
  keys: { anthropic: boolean; openai: boolean };
  onSaveKey: (provider: string, key: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

function KeyCard({
  provider,
  label,
  ready,
  required,
  onSave,
}: {
  provider: string;
  label: string;
  ready: boolean;
  required: boolean;
  onSave: (provider: string, key: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(provider, value.trim());
    setSaving(false);
    setEditing(false);
    setValue("");
  };

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Key className="w-4 h-4 text-prism-muted" />
          <span className="text-sm font-medium text-white">{label}</span>
          {required && (
            <span className="text-[10px] font-mono px-1.5 py-px rounded bg-prism-sky/10 text-prism-sky border border-prism-sky/20">
              REQUIRED
            </span>
          )}
          {!required && (
            <span className="text-[10px] font-mono px-1.5 py-px rounded bg-white/5 text-prism-muted border border-white/5">
              OPTIONAL
            </span>
          )}
        </div>
        {ready ? (
          <CheckCircle2 className="w-5 h-5 text-prism-jade" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        )}
      </div>

      {ready ? (
        <p className="text-xs text-prism-jade">Configured and ready</p>
      ) : editing ? (
        <div className="flex gap-2 mt-3">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${label}...`}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-prism-muted/50 focus:outline-none focus:border-prism-sky/40"
          />
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-prism-sky text-prism-bg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-prism-sky hover:text-white transition-colors mt-1"
        >
          Click to configure
        </button>
      )}
    </div>
  );
}

export default function ReadinessStep({
  keys,
  onSaveKey,
  onNext,
  onBack,
}: ReadinessStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center min-h-screen px-6"
    >
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">System Readiness</h2>
          <p className="text-sm text-prism-muted">
            PRISM checks your environment to ensure everything is configured.
          </p>
        </div>

        <div className="space-y-3">
          <KeyCard
            provider="anthropic"
            label="Anthropic API Key"
            ready={keys.anthropic}
            required={true}
            onSave={onSaveKey}
          />
          <KeyCard
            provider="openai"
            label="OpenAI API Key"
            ready={keys.openai}
            required={false}
            onSave={onSaveKey}
          />
        </div>

        <p className="text-xs text-prism-muted text-center">
          Demo Mode is always available without API keys.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm text-prism-muted border border-white/10 hover:border-white/20 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): add ReadinessStep component with inline key entry"
```

---

### Task 8: ConfigStep Component

**Files:**
- Create: `src/components/onboarding/ConfigStep.tsx`

**Step 1: Implement ConfigStep**

```tsx
// src/components/onboarding/ConfigStep.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Activity,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface PipelinePreset {
  id: "quick" | "standard" | "deep";
  name: string;
  description: string;
  icon: typeof Zap;
  maxAgents: number;
  defaultUrgency: "speed" | "balanced" | "thorough";
  enableCriticPass: boolean;
}

const PRESETS: PipelinePreset[] = [
  {
    id: "quick",
    name: "Quick Scan",
    description: "3 agents, fast turnaround (~2 min)",
    icon: Zap,
    maxAgents: 3,
    defaultUrgency: "speed",
    enableCriticPass: false,
  },
  {
    id: "standard",
    name: "Standard Analysis",
    description: "5-8 agents, balanced depth (~5 min)",
    icon: Activity,
    maxAgents: 8,
    defaultUrgency: "balanced",
    enableCriticPass: true,
  },
  {
    id: "deep",
    name: "Deep Investigation",
    description: "10-15 agents, comprehensive (~10 min)",
    icon: Search,
    maxAgents: 15,
    defaultUrgency: "thorough",
    enableCriticPass: true,
  },
];

interface ConfigStepProps {
  onNext: (config: {
    maxAgents: number;
    defaultUrgency: "speed" | "balanced" | "thorough";
    enableMemoryBus: boolean;
    enableCriticPass: boolean;
  }) => void;
  onBack: () => void;
}

export default function ConfigStep({ onNext, onBack }: ConfigStepProps) {
  const [selected, setSelected] = useState<"quick" | "standard" | "deep">(
    "standard"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enableMemoryBus, setEnableMemoryBus] = useState(true);
  const [customCriticPass, setCustomCriticPass] = useState<boolean | null>(
    null
  );

  const preset = PRESETS.find((p) => p.id === selected)!;
  const criticPass = customCriticPass ?? preset.enableCriticPass;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center min-h-screen px-6"
    >
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Configure Analysis</h2>
          <p className="text-sm text-prism-muted">
            Choose a default analysis depth. You can change this per-query later.
          </p>
        </div>

        {/* Preset cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelected(p.id);
                  setCustomCriticPass(null);
                }}
                className={`glass-panel rounded-xl p-5 text-left transition-all duration-200 ${
                  isActive
                    ? "border-prism-sky/40 shadow-[0_0_15px_rgba(89,221,253,0.15)]"
                    : "hover:border-white/10"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                    isActive
                      ? "bg-prism-sky/15 border border-prism-sky/30"
                      : "bg-white/5 border border-white/5"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-prism-sky" : "text-prism-muted"
                    }`}
                  />
                </div>
                <h3
                  className={`font-semibold text-sm mb-1 ${
                    isActive ? "text-white" : "text-prism-muted"
                  }`}
                >
                  {p.name}
                </h3>
                <p className="text-xs text-prism-muted/70">{p.description}</p>
              </button>
            );
          })}
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 mx-auto text-xs text-prism-muted hover:text-prism-sky transition-colors"
        >
          Advanced Settings
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-panel rounded-xl p-5 space-y-4">
                {/* Memory Bus */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-white">Memory Bus</p>
                    <p className="text-xs text-prism-muted">
                      Cross-agent signal propagation during execution
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      enableMemoryBus ? "bg-prism-sky" : "bg-white/10"
                    }`}
                    onClick={() => setEnableMemoryBus(!enableMemoryBus)}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        enableMemoryBus ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>

                {/* Critic Pass */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-white">Critic Pass</p>
                    <p className="text-xs text-prism-muted">
                      Post-synthesis quality assurance review
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      criticPass ? "bg-prism-sky" : "bg-white/10"
                    }`}
                    onClick={() => setCustomCriticPass(!criticPass)}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        criticPass ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm text-prism-muted border border-white/10 hover:border-white/20 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() =>
              onNext({
                maxAgents: preset.maxAgents,
                defaultUrgency: preset.defaultUrgency,
                enableMemoryBus,
                enableCriticPass: criticPass,
              })
            }
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): add ConfigStep with preset selector and advanced toggles"
```

---

### Task 9: ReadyStep Component

**Files:**
- Create: `src/components/onboarding/ReadyStep.tsx`

**Step 1: Implement ReadyStep**

```tsx
// src/components/onboarding/ReadyStep.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, Sparkles } from "lucide-react";

interface ReadyStepProps {
  onDismiss: (dontShowAgain: boolean) => void;
  onBack: () => void;
}

export default function ReadyStep({ onDismiss, onBack }: ReadyStepProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <CheckCircle2 className="w-16 h-16 text-prism-jade" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-white mb-3"
      >
        You&apos;re All Set
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-prism-muted max-w-md mb-8"
      >
        PRISM is ready. Enter a strategic question and watch coordinated AI
        agents analyze it across multiple dimensions in real time.
      </motion.p>

      {/* Dismiss checkbox */}
      <motion.label
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 mb-8 cursor-pointer select-none"
      >
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-prism-sky focus:ring-prism-sky/30"
        />
        <span className="text-xs text-prism-muted">
          Don&apos;t show this again
        </span>
      </motion.label>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm text-prism-muted border border-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={() => onDismiss(dontShowAgain)}
          className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-medium bg-prism-sky text-prism-bg shadow-[0_0_20px_rgba(89,221,253,0.25)] hover:bg-white transition-all duration-300"
        >
          <Sparkles className="w-4 h-4" />
          Begin Analysis
        </button>
      </motion.div>
    </motion.div>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): add ReadyStep with dismiss checkbox"
```

---

### Task 10: OnboardingWizard Container

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`

**Step 1: Implement OnboardingWizard**

```tsx
// src/components/onboarding/OnboardingWizard.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/hooks/use-onboarding";
import WelcomeStep from "./WelcomeStep";
import ReadinessStep from "./ReadinessStep";
import ConfigStep from "./ConfigStep";
import ReadyStep from "./ReadyStep";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const {
    status,
    loading,
    step,
    stepIndex,
    totalSteps,
    nextStep,
    prevStep,
    saveKey,
    dismiss,
  } = useOnboarding();

  if (loading || !status) return null;

  const handleConfigNext = async (config: {
    maxAgents: number;
    defaultUrgency: "speed" | "balanced" | "thorough";
    enableMemoryBus: boolean;
    enableCriticPass: boolean;
  }) => {
    // Save config to settings
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    nextStep();
  };

  const handleDismiss = async (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      await dismiss();
    }
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-prism-bg"
    >
      {/* Progress indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i <= stepIndex
                ? "w-8 bg-prism-sky"
                : "w-4 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <WelcomeStep key="welcome" onNext={nextStep} />
        )}
        {step === "readiness" && (
          <ReadinessStep
            key="readiness"
            keys={status.keys}
            onSaveKey={saveKey}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {step === "config" && (
          <ConfigStep
            key="config"
            onNext={handleConfigNext}
            onBack={prevStep}
          />
        )}
        {step === "ready" && (
          <ReadyStep
            key="ready"
            onDismiss={handleDismiss}
            onBack={prevStep}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): add OnboardingWizard container with step routing and progress bar"
```

---

### Task 11: Integrate Wizard into page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add onboarding state and wizard rendering**

At the top of `page.tsx`, add imports:

```typescript
import { useState, useCallback, useEffect } from "react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
```

Inside the `Home` component, add state for onboarding (after existing state declarations):

```typescript
const [showOnboarding, setShowOnboarding] = useState(false);
const [onboardingChecked, setOnboardingChecked] = useState(false);
```

Add a useEffect to check onboarding status on mount:

```typescript
useEffect(() => {
  fetch("/api/onboarding/status")
    .then((r) => r.json())
    .then((data) => {
      setShowOnboarding(!data.onboardingDismissed);
      setOnboardingChecked(true);
    })
    .catch(() => setOnboardingChecked(true));
}, []);
```

Before the existing `if (effectivePhase === "input")` block, add:

```typescript
if (!onboardingChecked) return null;

if (showOnboarding) {
  return (
    <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Verify the app builds**

Run:
```bash
npx next build
```
Expected: Build succeeds with all routes compiling.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(onboarding): integrate wizard into page.tsx, gate InputPhase"
```

---

### Task 12: CoachMark Component

**Files:**
- Create: `src/components/onboarding/CoachMark.tsx`

**Step 1: Implement CoachMark**

```tsx
// src/components/onboarding/CoachMark.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface CoachMarkProps {
  targetId: string;
  message: string;
  onDismiss: () => void;
  onSkipAll: () => void;
}

export default function CoachMark({
  targetId,
  message,
  onDismiss,
  onSkipAll,
}: CoachMarkProps) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setPosition({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetId]);

  if (!position) return null;

  // Position tooltip below target, centered
  const tooltipTop = position.top + position.height + 12;
  const tooltipLeft = position.left + position.width / 2;

  return createPortal(
    <>
      {/* Highlight ring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed pointer-events-none z-[60] rounded-lg"
        style={{
          top: position.top - 4,
          left: position.left - 4,
          width: position.width + 8,
          height: position.height + 8,
          boxShadow: "0 0 0 4000px rgba(0,0,0,0.5), 0 0 15px rgba(89,221,253,0.4)",
          border: "2px solid rgba(89,221,253,0.5)",
        }}
      />

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed z-[61] -translate-x-1/2"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="glass-panel rounded-xl p-4 max-w-xs shadow-xl border border-prism-sky/20">
          <p className="text-sm text-white leading-relaxed mb-3">{message}</p>
          <div className="flex items-center justify-between">
            <button
              onClick={onSkipAll}
              className="text-xs text-prism-muted hover:text-white transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-prism-sky text-prism-bg hover:bg-white transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/CoachMark.tsx
git commit -m "feat(onboarding): add CoachMark component with highlight ring and portal tooltip"
```

---

### Task 13: CoachMarkProvider

**Files:**
- Create: `src/components/onboarding/CoachMarkProvider.tsx`

**Step 1: Implement CoachMarkProvider**

```tsx
// src/components/onboarding/CoachMarkProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import CoachMark from "./CoachMark";
import type { Phase } from "@/lib/types";

interface TourMark {
  id: string;
  phase: Phase;
  targetId: string;
  message: string;
}

const TOUR_MARKS: TourMark[] = [
  {
    id: "blueprint",
    phase: "blueprint",
    targetId: "tour-deploy-agents",
    message:
      "Review the AI team assembled for your query. When ready, deploy them.",
  },
  {
    id: "executing",
    phase: "executing",
    targetId: "tour-agent-grid",
    message:
      "Each agent independently researches its assigned dimension in parallel.",
  },
  {
    id: "triage",
    phase: "triage",
    targetId: "tour-finding-card",
    message:
      "Review each finding. Keep, boost, flag, or dismiss before synthesis.",
  },
  {
    id: "synthesis",
    phase: "synthesis",
    targetId: "tour-synthesis-layers",
    message:
      "PRISM weaves agent findings into layered strategic insights.",
  },
  {
    id: "complete",
    phase: "complete",
    targetId: "tour-view-brief",
    message:
      "Your executive brief is ready. Open it to see the final output.",
  },
];

interface CoachMarkContextValue {
  currentPhase: Phase;
  setCurrentPhase: (phase: Phase) => void;
}

const CoachMarkContext = createContext<CoachMarkContextValue>({
  currentPhase: "input",
  setCurrentPhase: () => {},
});

export function useCoachMarkPhase() {
  return useContext(CoachMarkContext);
}

export default function CoachMarkProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [currentPhase, setCurrentPhase] = useState<Phase>("input");
  const [tourActive, setTourActive] = useState(false);
  const [shownMarks, setShownMarks] = useState<Set<string>>(new Set());
  const [tourComplete, setTourComplete] = useState(false);

  // Check tour status on mount
  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasCompletedTour) {
          setTourActive(true);
        } else {
          setTourComplete(true);
        }
      })
      .catch(() => {});
  }, []);

  const completeTour = useCallback(async () => {
    setTourActive(false);
    setTourComplete(true);
    await fetch("/api/onboarding/tour-complete", { method: "POST" });
  }, []);

  const dismissMark = useCallback(
    (markId: string) => {
      setShownMarks((prev) => new Set([...prev, markId]));
      // If this was the last mark, complete the tour
      const remaining = TOUR_MARKS.filter((m) => !shownMarks.has(m.id) && m.id !== markId);
      if (remaining.length === 0) {
        completeTour();
      }
    },
    [shownMarks, completeTour]
  );

  // Find the active mark for current phase
  const activeMark =
    tourActive && !tourComplete
      ? TOUR_MARKS.find(
          (m) => m.phase === currentPhase && !shownMarks.has(m.id)
        )
      : null;

  return (
    <CoachMarkContext.Provider value={{ currentPhase, setCurrentPhase }}>
      {children}
      {activeMark && (
        <CoachMark
          key={activeMark.id}
          targetId={activeMark.targetId}
          message={activeMark.message}
          onDismiss={() => dismissMark(activeMark.id)}
          onSkipAll={completeTour}
        />
      )}
    </CoachMarkContext.Provider>
  );
}
```

**Step 2: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/onboarding/CoachMarkProvider.tsx
git commit -m "feat(onboarding): add CoachMarkProvider with phase-based tour marks"
```

---

### Task 14: Add data-tour-id Attributes to Phase Components

**Files:**
- Modify: `src/components/BlueprintApproval.tsx`
- Modify: `src/components/phases/ExecutingPhase.tsx`
- Modify: `src/components/phases/TriagePhase.tsx`
- Modify: `src/components/phases/SynthesisPhase.tsx`
- Modify: `src/components/phases/CompletePhase.tsx`

**Step 1: Add `data-tour-id="tour-deploy-agents"` to the "Deploy Agents" button in BlueprintApproval.tsx**

Find the "Deploy Agents" button (around line 160-166):
```tsx
<button
  onClick={onApprove}
  className="flex items-center gap-2 px-8 py-3 ..."
>
```

Add `data-tour-id="tour-deploy-agents"` to that button element.

**Step 2: Add `data-tour-id="tour-agent-grid"` to the agent card container in ExecutingPhase.tsx**

Find the grid/container that renders AgentCard components and add `data-tour-id="tour-agent-grid"` to it.

**Step 3: Add `data-tour-id="tour-finding-card"` to the first FindingCard wrapper in TriagePhase.tsx**

Find the container that maps FindingCards. Add `data-tour-id="tour-finding-card"` to the outer wrapper div of the findings list.

**Step 4: Add `data-tour-id="tour-synthesis-layers"` to the synthesis layers container in SynthesisPhase.tsx**

Find the container rendering synthesis layers and add the attribute.

**Step 5: Add `data-tour-id="tour-view-brief"` to the "View Brief" button in CompletePhase.tsx**

Find the "View Brief" / "View Executive Brief" button and add the attribute.

**Step 6: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 7: Commit**

```bash
git add src/components/BlueprintApproval.tsx src/components/phases/
git commit -m "feat(onboarding): add data-tour-id attributes to phase components"
```

---

### Task 15: Integrate CoachMarkProvider into page.tsx

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import CoachMarkProvider and useCoachMarkPhase**

Add imports:
```typescript
import CoachMarkProvider, { useCoachMarkPhase } from "@/components/onboarding/CoachMarkProvider";
```

**Step 2: Wrap phase content in CoachMarkProvider**

The existing page renders phases directly. Wrap the entire phase router output in `<CoachMarkProvider>`. Since the provider needs to know the current phase, add a `useEffect` that calls `setCurrentPhase(effectivePhase)` whenever `effectivePhase` changes.

Extract the phase routing into an inner component or add a sync effect:

After the `effectivePhase` calculation, add:
```typescript
const { setCurrentPhase } = useCoachMarkPhase();

useEffect(() => {
  setCurrentPhase(effectivePhase);
}, [effectivePhase, setCurrentPhase]);
```

This requires refactoring: wrap the `Home` component's return in `<CoachMarkProvider>` at the layout level, or create an inner component. The cleanest approach:

In `page.tsx`, wrap the content returned after the onboarding wizard check:

```typescript
// After the showOnboarding check, wrap remaining phase routing:
return (
  <CoachMarkProvider>
    <PhaseRouter ... />
  </CoachMarkProvider>
);
```

Create a `PhaseRouter` inner component that contains all the `if (effectivePhase === ...)` blocks and calls `useCoachMarkPhase()` to sync the phase.

**Step 3: Verify compilation**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 4: Verify app builds**

Run:
```bash
npx next build
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(onboarding): integrate CoachMarkProvider and sync effectivePhase"
```

---

### Task 16: Final Compilation Check

**Files:** None (verification only)

**Step 1: TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: Zero errors.

**Step 2: Full build**

Run:
```bash
npx next build
```
Expected: Build succeeds, all routes compile including new `/api/onboarding/*` routes.

**Step 3: Verify new routes appear in build output**

Expected routes include:
```
├ ƒ /api/onboarding/dismiss
├ ƒ /api/onboarding/keys
├ ƒ /api/onboarding/status
├ ƒ /api/onboarding/tour-complete
```

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(onboarding): resolve compilation issues"
```
