import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolConnect: vi.fn(),
  poolQuery: vi.fn(),
  superPoolConnect: vi.fn(),
}));

vi.mock("../../db/pool.js", () => ({
  pool: { connect: mocks.poolConnect, query: mocks.poolQuery },
  superPool: { connect: mocks.superPoolConnect },
  isConnectionError: vi.fn(() => false),
}));

vi.mock("../../lib/password.js", () => ({
  hashPasswordAsync: vi.fn(async () => "password-hash"),
}));

vi.mock("../../lib/jwt.js", () => ({
  signToken: vi.fn(() => "access-token"),
}));

vi.mock("../../lib/email.js", () => ({
  sendMail: vi.fn(),
  buildTenantVerificationEmail: vi.fn(),
  buildWelcomeEmail: vi.fn(),
}));

import { onboardingRoutes } from "./onboarding.routes.js";

const SEEDED_TENANT_ID = "de000000-0000-0000-0000-000000000003";
const NEW_TENANT_ID = "00000000-0000-0000-0000-000000000010";
const USER_ID = "00000000-0000-0000-0000-000000000011";
const YEAR_ID = "00000000-0000-0000-0000-000000000012";

function makeClient(tenants: { id: string; slug: string }[]) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT id, slug FROM platform.tenants")) {
      return { rows: tenants, rowCount: tenants.length };
    }
    if (sql.includes("SELECT 1 FROM platform.users")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("UPDATE platform.tenants")) {
      return { rows: [{ id: SEEDED_TENANT_ID }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO platform.tenants")) {
      return { rows: [{ id: NEW_TENANT_ID }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO platform.users")) {
      return { rows: [{ id: USER_ID }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO app.academic_years")) {
      return { rows: [{ id: YEAR_ID }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });

  return { query, release: vi.fn() };
}

function installBody() {
  return {
    instituteName: "Example VTI",
    slug: "example-vti",
    contactEmail: "office@example.test",
    ownershipType: "public",
    adminEmail: "admin@example.test",
    adminPassword: "a-long-enough-test-password",
  };
}

describe("POST /onboarding self-hosted bootstrap", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SELF_HOSTED_MODE = "true";
    delete process.env.ENABLE_PUBLIC_ONBOARDING;
    mocks.poolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    app = Fastify();
    app.register(onboardingRoutes);
  });

  afterEach(async () => {
    delete process.env.SELF_HOSTED_MODE;
    delete process.env.ENABLE_PUBLIC_ONBOARDING;
    await app.close();
  });

  it("initializes the institute by reusing the empty seeded demo tenant", async () => {
    const client = makeClient([{ id: SEEDED_TENANT_ID, slug: "demovti" }]);
    mocks.superPoolConnect.mockResolvedValue(client);

    const response = await app.inject({
      method: "POST",
      url: "/onboarding",
      payload: installBody(),
    });

    expect(response.statusCode).toBe(201);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE platform.tenants"),
      expect.arrayContaining(["example-vti"]),
    );
    expect(mocks.poolConnect).not.toHaveBeenCalled();
  });

  it("refuses a second setup after an institute is initialized", async () => {
    const client = makeClient([
      { id: NEW_TENANT_ID, slug: "existing-vti" },
    ]);
    mocks.superPoolConnect.mockResolvedValue(client);

    const response = await app.inject({
      method: "POST",
      url: "/onboarding",
      payload: installBody(),
    });

    expect(response.statusCode).toBe(409);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO platform.users"),
      expect.anything(),
    );
  });

  it("keeps onboarding disabled outside self-hosted mode by default", async () => {
    delete process.env.SELF_HOSTED_MODE;

    const response = await app.inject({
      method: "POST",
      url: "/onboarding",
      payload: installBody(),
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.superPoolConnect).not.toHaveBeenCalled();
  });
});
