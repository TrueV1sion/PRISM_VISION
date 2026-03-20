/**
 * PRISM Auth Configuration (Node.js Runtime)
 *
 * Full NextAuth.js v5 configuration with Prisma adapter.
 * This file is used by API routes (Node.js runtime).
 * Edge middleware uses auth.config.ts instead.
 *
 * Supported providers:
 * - Google OAuth (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
 * - Microsoft Entra ID (requires AZURE_AD_CLIENT_ID + AZURE_AD_CLIENT_SECRET + AZURE_AD_TENANT_ID)
 * - Credentials (development only — email-based, no password)
 *
 * All providers are optional — configure via environment variables.
 */

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

// ─── Build full providers list (Node.js runtime) ────────────
// We rebuild providers here instead of extending auth.config.ts because
// the Credentials authorize function needs Prisma (Node.js only).

const fullProviders: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  fullProviders.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
  fullProviders.push(
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  );
}

if (process.env.NODE_ENV === "development") {
  fullProviders.push(
    Credentials({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@protoprism.local" },
        name: { label: "Name", type: "text", placeholder: "Dev User" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        if (!email) return null;

        const rawName = credentials?.name as string | undefined;
        const name = rawName && rawName !== "undefined" && rawName.trim()
          ? rawName.trim()
          : "Dev User";

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              emailVerified: new Date(),
            },
          });
        } else if (user.name === "undefined" || !user.name) {
          // Fix previously created users with bad name
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name },
          });
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

// ─── Full Auth (with Prisma adapter + real Credentials) ──────

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: fullProviders,
});

// ─── Re-export edge-safe config ─────────────────────────────

export { isAuthEnabled } from "@/lib/auth.config";

// ─── Helper: Get current user's teams ──────────────────────

export async function getUserTeams(userId: string) {
  return prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });
}

// ─── Helper: Check team membership + role ──────────────────

export type TeamRole = "owner" | "admin" | "analyst" | "viewer";

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};

export async function checkTeamRole(
  userId: string,
  teamId: string,
  requiredRole: TeamRole = "viewer",
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (!membership) return false;

  const userLevel = ROLE_HIERARCHY[membership.role as TeamRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return userLevel >= requiredLevel;
}

// ─── Helper: Get accessible runs for a user ────────────────

export async function getAccessibleRuns(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);

  return prisma.run.findMany({
    where: {
      OR: [
        { createdById: userId },
        { teamId: { in: teamIds }, visibility: { in: ["team", "public"] } },
        { visibility: "public" },
        { createdById: null },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}
