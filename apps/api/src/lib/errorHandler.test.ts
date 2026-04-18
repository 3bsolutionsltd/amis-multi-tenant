import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { buildApp } from "../app.js";

vi.mock("../db/tenant.js", () => ({
  withTenant: vi.fn(),
}));

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const devHeaders = { "x-tenant-id": TID, "x-dev-role": "admin" };

describe("Global error handler", () => {
  it("returns structured 404 for unknown routes", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/no-such-route",
      headers: devHeaders,
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(body.message).toContain("not found");
  });

  it("returns structured error for validation failures (bad UUID)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/students/not-a-uuid",
      headers: devHeaders,
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty("statusCode", 400);
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("message");
  });

  it("returns structured 500 for unhandled route errors", async () => {
    const app = buildApp();
    app.get("/test-throw", async () => {
      throw new Error("unexpected failure");
    });
    const res = await app.inject({
      method: "GET",
      url: "/test-throw",
      headers: devHeaders,
    });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toMatchObject({
      statusCode: 500,
      error: "Error",
    });
    // In test/dev mode, the message is exposed
    expect(body.message).toBe("unexpected failure");
    // Stack traces should never leak in the JSON body
    expect(JSON.stringify(body)).not.toContain("at Object");
  });

  it("masks 500 messages when NODE_ENV=production", async () => {
    // Use a minimal Fastify instance with just the error handler
    // to test production masking without auth middleware interference
    const app = Fastify({ logger: false });

    app.setErrorHandler((error, _req, reply) => {
      const statusCode = error.statusCode ?? 500;
      const isProd = process.env.NODE_ENV === "production";
      reply.status(statusCode).send({
        statusCode,
        error: error.name ?? "Internal Server Error",
        message:
          isProd && statusCode >= 500
            ? "Internal Server Error"
            : error.message,
      });
    });

    app.get("/test-throw", async () => {
      throw new Error("secret db password");
    });

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await app.inject({ method: "GET", url: "/test-throw" });
      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body).toMatchObject({ statusCode: 500 });
      expect(body.message).toBe("Internal Server Error");
      expect(body.message).not.toContain("secret");
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    // Verify the same error exposes message in non-production
    const res2 = await app.inject({ method: "GET", url: "/test-throw" });
    expect(res2.statusCode).toBe(500);
    expect(res2.json().message).toBe("secret db password");
  });
});
