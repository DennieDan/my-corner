import { describe, expect, it } from "vitest";
import { CitationGate } from "../src/citations.js";

describe("citation gate", () => {
  it("releases a checked statement before generation finishes", () => {
    const gate = new CitationGate(new Set(["S1", "S2"]));
    expect(gate.push("A supported fact [S1]")).toEqual(["A supported fact [S1]\n"]);
    expect(gate.push("\nAnother supported fact [S1, S2]")).toEqual(["Another supported fact [S1, S2]\n"]);
    expect(gate.finish()).toEqual({ remaining: [], refusal: false });
  });

  it("accepts a refusal without emitting model text", () => {
    const gate = new CitationGate(new Set(["S1"]));
    expect(gate.push("NO_EVI")).toEqual([]);
    expect(gate.push("DENCE")).toEqual([]);
    expect(gate.finish().refusal).toBe(true);
  });

  it("rejects uncited and invented output", () => {
    expect(() => new CitationGate(new Set(["S1"])).push("False claim [S2] ")).toThrow("ANSWER_UNVERIFIED");
    const gate = new CitationGate(new Set(["S1"]));
    gate.push("An uncited statement");
    expect(() => gate.finish()).toThrow("ANSWER_UNVERIFIED");
  });
});
