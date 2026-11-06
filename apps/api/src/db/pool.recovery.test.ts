/**
 * pool.recovery.test.ts
 *
 * Verifies that the pg-pool auto-recovery logic replaces a wedged pool
 * (3 consecutive idle-client errors) without requiring a container restart.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import EventEmitter from "events";

// ---------------------------------------------------------------------------
// Lightweight mock for pg.Pool that lets us fire synthetic 'error' and
// 'connect' events and observe whether end() was called.
// ---------------------------------------------------------------------------
class MockPool extends EventEmitter {
  ended = false;
  connectError: Error | undefined;
  queryError: Error | undefined;
  releasedWithError: Array<boolean | Error | undefined> = [];

  async query() {
    if (this.queryError) {
      const error = this.queryError;
      this.queryError = undefined;
      throw error;
    }
    return { rows: [] };
  }

  async connect() {
    if (this.connectError) {
      const error = this.connectError;
      this.connectError = undefined;
      throw error;
    }

    return {
      query: async () => {
        if (this.queryError) {
          const error = this.queryError;
          this.queryError = undefined;
          throw error;
        }
        return { rows: [] };
      },
      release: (error?: boolean | Error) => {
        this.releasedWithError.push(error);
      },
    };
  }

  async end() {
    this.ended = true;
  }
}

// Capture pool instances created by createPool so tests can inspect them.
const createdPools: MockPool[] = [];

// Mock the pg module — hoisted by Vitest before any imports.
vi.mock("pg", () => ({
  default: {
    Pool: vi.fn().mockImplementation(function () {
      const p = new MockPool();
      createdPools.push(p);
      return p;
    }),
  },
}));

import {
  isConnectionError,
  pool,
  querySuperPool,
  superPool,
  _resetPoolForTesting,
} from "./pool.js";

describe("pg-pool auto-recovery", () => {
  beforeEach(() => {
    // Clear captured instances and reset the lazy singleton.
    createdPools.length = 0;
    _resetPoolForTesting();
  });

  it("creates a new pool after 3 consecutive idle-client errors", () => {
    // Trigger lazy init.
    void (pool as unknown as { query: unknown }).query;

    expect(createdPools).toHaveLength(1);
    const first = createdPools[0];

    // Fire 2 errors — should NOT reset yet.
    first.emit("error", new Error("connection terminated"));
    first.emit("error", new Error("connection terminated"));
    expect(first.ended).toBe(false);
    expect(createdPools).toHaveLength(1);

    // Third error — triggers recovery.
    first.emit("error", new Error("connection terminated"));
    expect(first.ended).toBe(true);

    // Next proxy access must create a fresh pool.
    void (pool as unknown as { query: unknown }).query;
    expect(createdPools).toHaveLength(2);
  });

  it("resets the consecutive-error counter on a successful connect", () => {
    void (pool as unknown as { query: unknown }).query;
    const first = createdPools[0];

    // 2 errors then a successful connect — counter resets.
    first.emit("error", new Error("connection terminated"));
    first.emit("error", new Error("connection terminated"));
    first.emit("connect");

    // 2 more errors — still below threshold.
    first.emit("error", new Error("connection terminated"));
    first.emit("error", new Error("connection terminated"));
    expect(first.ended).toBe(false);

    // 3rd error since last reset triggers replacement.
    first.emit("error", new Error("connection terminated"));
    expect(first.ended).toBe(true);
  });

  it("replaces the superuser pool after 3 consecutive idle-client errors", () => {
    void (superPool as unknown as { query: unknown }).query;

    expect(createdPools).toHaveLength(1);
    const first = createdPools[0];

    first.emit("error", new Error("connection terminated"));
    first.emit("error", new Error("connection terminated"));
    first.emit("error", new Error("connection terminated"));
    expect(first.ended).toBe(true);

    void (superPool as unknown as { query: unknown }).query;
    expect(createdPools).toHaveLength(2);
  });

  it("retries superuser pool acquisition timeouts using a fresh pool", async () => {
    expect(
      isConnectionError(new Error("timeout exceeded when trying to connect")),
    ).toBe(true);

    void (superPool as unknown as { query: unknown }).query;
    const first = createdPools[0];
    first.connectError = new Error("timeout exceeded when trying to connect");

    await superPool.query("SELECT 1");

    expect(first.ended).toBe(true);
    expect(createdPools).toHaveLength(2);
  });

  it("does not retry a query execution error", async () => {
    void (superPool as unknown as { query: unknown }).query;
    const first = createdPools[0];
    first.queryError = new Error("server closed the connection");

    await expect(querySuperPool("UPDATE platform.users SET is_active = true")).rejects.toThrow(
      "server closed the connection",
    );

    expect(createdPools).toHaveLength(1);
    expect(first.releasedWithError).toEqual([true]);
  });
});
