import { describe, expect, it } from "vitest";

import { riskPolicySchema } from "../src/index.js";

const validPolicy = {
  maxRetries: 2,
  maxRunTimeoutSeconds: 3600,
  maxConcurrentRuns: 3,
  maxCostPerRunUsd: 5,
  maxMonthlyCostUsd: 200,
};

describe("riskPolicySchema", () => {
  it("acepta una politica de riesgo completa", () => {
    expect(riskPolicySchema.safeParse(validPolicy).success).toBe(true);
  });

  it("rechaza politicas con valores fuera de rango", () => {
    const invalid = { ...validPolicy, maxRetries: -1 };
    expect(riskPolicySchema.safeParse(invalid).success).toBe(false);
  });

  it("rechaza politicas incompletas", () => {
    const partial: Record<string, unknown> = { ...validPolicy };
    delete partial.maxCostPerRunUsd;
    expect(riskPolicySchema.safeParse(partial).success).toBe(false);
  });

  it("rechaza propiedades desconocidas por seguridad", () => {
    const invalid = { ...validPolicy, unlimited: true };
    expect(riskPolicySchema.safeParse(invalid).success).toBe(false);
  });
});
