/**
 * PRISM Auth Configuration (Edge-compatible)
 *
 * This file contains the auth config WITHOUT the Prisma adapter,
 * making it safe to import in Edge Runtime (middleware).
 * The full auth.ts imports this and adds the adapter.
 */

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  );
}

// Credentials provider for dev (note: in edge middleware, authorize is not called,
// so this is safe to declare here but only executes in the Node.js API route)
if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      // authorize runs in Node.js runtime (API route), not Edge (middleware)
      authorize: () => null, // Placeholder — overridden in auth.ts
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
    async authorized({ auth }) {
      if (providers.length === 0) return true;
      return !!auth;
    },
  },
};

export function isAuthEnabled(): boolean {
  return providers.length > 0;
}
