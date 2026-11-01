import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { evidenceBundleSchema } from "../src/index.js";

const validBundle = {
  runId: randomUUID(),
  startedAt: new Date().toISOString(),
  evidence: [{ name: "vitest", status: "passed", detail: "4 tests passed" }],
};

describe("evidenceBundleSchema", () => {
  it("acepta un paquete de evidencias minimo", () => {
    expect(evidenceBundleSchema.safeParse(validBundle).success).toBe(true);
  });

  it("rechaza paquetes sin evidencias", () => {
    const invalid = { ...validBundle, evidence: [] };
    expect(evidenceBundleSchema.safeParse(invalid).success).toBe(false);
  });

  it("rechaza evidencias con status fuera de la union", () => {
    const invalid = {
      ...validBundle,
      evidence: [{ name: "vitest", status: "skipped", detail: "x" }],
    };
    expect(evidenceBundleSchema.safeParse(invalid).success).toBe(false);
  });
});
