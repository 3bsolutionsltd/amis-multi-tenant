import { describe, it, expect } from "vitest";
import { hashPassword, verifyPasswordAsync } from "./password.js";

describe("hashPassword", () => {
  it("returns a non-empty string in salt:dk format", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("produces different hashes for the same plaintext (random salt)", () => {
    const h1 = hashPassword("same-password");
    const h2 = hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });

  it("produces a 64-byte (128 hex chars) derived key", () => {
    const hash = hashPassword("test");
    const dkHex = hash.split(":")[1];
    expect(dkHex).toHaveLength(128);
  });

  it("produces a 32-byte (64 hex chars) salt", () => {
    const hash = hashPassword("test");
    const saltHex = hash.split(":")[0];
    expect(saltHex).toHaveLength(64);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = hashPassword("my-secret");
    expect(await verifyPasswordAsync("my-secret", hash)).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hash = hashPassword("my-secret");
    expect(await verifyPasswordAsync("wrong-password", hash)).toBe(false);
  });

  it("returns false for an empty string when password is non-empty", async () => {
    const hash = hashPassword("my-secret");
    expect(await verifyPasswordAsync("", hash)).toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    expect(await verifyPasswordAsync("anything", "not-a-valid-hash")).toBe(false);
    expect(await verifyPasswordAsync("anything", "")).toBe(false);
    expect(await verifyPasswordAsync("anything", "onlyonepart")).toBe(false);
  });

  it("returns false when stored hash has wrong segment lengths", async () => {
    // Short salt + short dk — should fail the length guard
    expect(await verifyPasswordAsync("test", "aabb:ccdd")).toBe(false);
  });
});
