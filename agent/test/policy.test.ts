import { describe, expect, it } from "vitest";

import { mustDecline } from "../src/policy.js";

describe("high-confidence request policy", () => {
  it("declines owner-restricted job-seeking questions in English and Vietnamese", () => {
    expect(mustDecline("Is Dan looking for a job?")).toBe(true);
    expect(mustDecline("Dan đang tìm công việc hoặc vị trí nào?")).toBe(true);
  });

  it("allows a public-project false premise to be corrected", () => {
    expect(mustDecline("Why did Dan build ARAAg for medical diagnosis?")).toBe(false);
    expect(mustDecline("What is Dan's diagnosis?")).toBe(true);
  });
});
