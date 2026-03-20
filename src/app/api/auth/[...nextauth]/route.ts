/**
 * NextAuth.js v5 API Route Handler
 *
 * Handles all auth-related API requests:
 * - GET /api/auth/signin
 * - POST /api/auth/signin/:provider
 * - GET /api/auth/signout
 * - POST /api/auth/signout
 * - GET /api/auth/session
 * - GET /api/auth/csrf
 * - GET /api/auth/providers
 * - GET /api/auth/callback/:provider
 */

export { GET, POST } from "@/lib/auth";
