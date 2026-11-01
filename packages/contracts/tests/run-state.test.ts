import { describe, expect, it } from "vitest";

import { runStateSchema, runStates } from "../src/index.js";

describe("runStateSchema", () => {
  it("acepta los 10 estados del workflow mas BLOCKED", () => {
    expect(runStates).toHaveLength(11);
    for (const state of runStates) {
      const parsed = runStateSchema.safeParse(state);
      expect(parsed.success).toBe(true);
    }
  });

  it("rechaza estados no definidos", () => {
    const parsed = runStateSchema.safeParse("deploying");
    expect(parsed.success).toBe(false);
  });
});
