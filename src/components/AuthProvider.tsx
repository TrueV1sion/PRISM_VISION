"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client-side session provider wrapper.
 * Provides session context to all child components via useSession().
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
