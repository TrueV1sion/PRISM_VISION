/**
 * Unit tests for PRISM AES-256-GCM encryption utilities (src/lib/crypto.ts)
 *
 * Tests validate:
 * - Encrypt/decrypt round-trip preserves plaintext
 * - Different ciphertexts produced for the same input (random IV)
 * - Encrypted format is iv:authTag:ciphertext hex
 * - Throws if ENCRYPTION_SECRET env var is missing
 * - Throws if ENCRYPTION_SECRET is too short (< 16 chars)
 * - Fails to decrypt with a wrong key
 */

import { describe, it, expect, vi } from "vitest";

/** Helper: dynamically import crypto.ts after env is stubbed */
async function loadCrypto() {
  const mod = await import("@/lib/crypto");
  return mod;
}

describe("crypto (AES-256-GCM)", () => {
  describe("with valid ENCRYPTION_SECRET", () => {
    it("encrypts and decrypts round-trip", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "test-secret-that-is-long-enough");
      const { encrypt, decrypt } = await loadCrypto();

      const plaintext = "Hello, PRISM healthcare analytics!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for the same input (random IV)", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "test-secret-that-is-long-enough");
      const { encrypt } = await loadCrypto();

      const plaintext = "Deterministic output would be a security flaw";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("encrypted format is iv:authTag:ciphertext hex", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "test-secret-that-is-long-enough");
      const { encrypt } = await loadCrypto();

      const encrypted = encrypt("test data");
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(3);

      const [ivHex, authTagHex, ciphertextHex] = parts;

      // IV is 12 bytes = 24 hex chars
      expect(ivHex).toMatch(/^[0-9a-f]{24}$/);
      // Auth tag is 16 bytes = 32 hex chars
      expect(authTagHex).toMatch(/^[0-9a-f]{32}$/);
      // Ciphertext is non-empty hex
      expect(ciphertextHex).toMatch(/^[0-9a-f]+$/);
      expect(ciphertextHex.length).toBeGreaterThan(0);
    });

    it("handles empty string round-trip", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "test-secret-that-is-long-enough");
      const { encrypt, decrypt } = await loadCrypto();

      const encrypted = encrypt("");
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe("");
    });

    it("handles unicode round-trip", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "test-secret-that-is-long-enough");
      const { encrypt, decrypt } = await loadCrypto();

      const plaintext = "Healthcare analytics: \u2764\uFE0F \u{1F3E5} \u2022 $1.5M revenue";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("missing or short ENCRYPTION_SECRET", () => {
    it("throws if ENCRYPTION_SECRET is missing", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "");
      const { encrypt } = await loadCrypto();

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_SECRET env var must be at least 16 characters"
      );
    });

    it("throws if ENCRYPTION_SECRET is undefined", async () => {
      // Do not stub -- leave it undefined
      delete process.env.ENCRYPTION_SECRET;
      const { encrypt } = await loadCrypto();

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_SECRET env var must be at least 16 characters"
      );
    });

    it("throws if ENCRYPTION_SECRET is too short (< 16 chars)", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "short");
      const { encrypt } = await loadCrypto();

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_SECRET env var must be at least 16 characters"
      );
    });

    it("accepts ENCRYPTION_SECRET exactly 16 chars", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "exactly16chars!!");
      const { encrypt, decrypt } = await loadCrypto();

      const encrypted = encrypt("boundary test");
      expect(decrypt(encrypted)).toBe("boundary test");
    });
  });

  describe("wrong key decryption", () => {
    it("fails to decrypt with a different key", async () => {
      vi.stubEnv("ENCRYPTION_SECRET", "original-secret-key-for-encrypt");
      const { encrypt } = await loadCrypto();
      const encrypted = encrypt("secret data");

      // Reset modules and use a different key for decrypt
      vi.resetModules();
      vi.stubEnv("ENCRYPTION_SECRET", "different-secret-key-for-decrypt");
      const { decrypt } = await loadCrypto();

      expect(() => decrypt(encrypted)).toThrow();
    });
  });
});
