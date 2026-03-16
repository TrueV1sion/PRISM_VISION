import { vi } from "vitest";

/**
 * Lightweight DB mock — the app now uses `db` from `@/lib/db` (Supabase)
 * rather than a Prisma client.  This mock stubs the db object so tests
 * that import `@/lib/db` get a no-op implementation.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler: ProxyHandler<any> = {
  get(_target, prop) {
    if (typeof prop === "symbol") return undefined;
    // Return a nested proxy so db.run.create(...) etc. resolve to async no-ops
    return new Proxy(
      {},
      {
        get() {
          return vi.fn().mockResolvedValue(undefined);
        },
      },
    );
  },
};

export const dbMock = new Proxy({}, handler);

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

export function resetDbMock() {
  // individual fn mocks can be reset via vi.clearAllMocks()
  vi.clearAllMocks();
}
