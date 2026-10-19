import { describe, expect, it } from "vitest";

import { getEnvironmentConfig } from "../lib/config.js";

describe("getEnvironmentConfig", () => {
  it("defaults to development", () => {
    expect(getEnvironmentConfig(undefined)).toEqual({
      name: "development",
      stackPrefix: "Dennie-development",
      terminationProtection: false,
      allowedOrigins: ["https://dandinh.net", "http://localhost:3000"],
      awsBudgetUsd: null,
    });
  });

  it("protects production stacks", () => {
    const production = getEnvironmentConfig("production");
    expect(production.terminationProtection).toBe(true);
    expect(production.allowedOrigins).toEqual(["https://dandinh.net"]);
  });

  it("rejects unknown environments", () => {
    expect(() => getEnvironmentConfig("preview")).toThrow(/development, staging, production/);
  });
});
