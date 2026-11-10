import { describe, expect, it } from "vitest";
import { createCorsOriginValidator } from "./corsOrigin.js";

describe("createCorsOriginValidator", () => {
  const isAllowed = createCorsOriginValidator(
    "http://kti.local, http://100.92.197.118",
    "172.16.0.0/24",
  );

  it("allows configured exact origins", () => {
    expect(isAllowed("http://kti.local")).toBe(true);
    expect(isAllowed("http://100.92.197.118")).toBe(true);
  });

  it("allows HTTP origins in the configured IPv4 subnet", () => {
    expect(isAllowed("http://172.16.0.1")).toBe(true);
    expect(isAllowed("http://172.16.0.99")).toBe(true);
    expect(isAllowed("http://172.16.0.255")).toBe(true);
  });

  it("rejects origins outside the configured subnet", () => {
    expect(isAllowed("http://172.16.1.1")).toBe(false);
    expect(isAllowed("http://172.168.0.99")).toBe(false);
    expect(isAllowed("http://172.16.0.99:3001")).toBe(false);
    expect(isAllowed("https://172.16.0.99")).toBe(false);
  });

  it("rejects unconfigured origins and malformed values", () => {
    expect(isAllowed("http://attacker.example")).toBe(false);
    expect(isAllowed("null")).toBe(false);
    expect(isAllowed(undefined)).toBe(true);
  });

  it("normalizes exact configured origins and rejects invalid configuration", () => {
    const allowsTrailingSlash = createCorsOriginValidator("http://kti.local/", "");
    expect(allowsTrailingSlash("http://kti.local")).toBe(true);
    expect(() => createCorsOriginValidator("http://kti.local/path", "")).toThrow(
      "Invalid CORS origin",
    );
    expect(() => createCorsOriginValidator("", "172.16.0.0/33")).toThrow(
      "Invalid CORS IPv4 CIDR",
    );
  });
});
