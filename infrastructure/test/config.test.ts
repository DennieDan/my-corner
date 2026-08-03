import { describe, expect, it } from "vitest";

import { getEnvironmentConfig } from "../lib/config.js";

describe("getEnvironmentConfig", () => {
  it("defaults to development", () => {
    expect(getEnvironmentConfig(undefined)).toEqual({
      name: "development",
      stackPrefix: "Dennie-development",
      terminationProtection: false,
    });
  });

  it("protects production stacks", () => {
    expect(getEnvironmentConfig("production").terminationProtection).toBe(true);
  });

  it("rejects unknown environments", () => {
    expect(() => getEnvironmentConfig("preview")).toThrow(/development, staging, production/);
  });
});
