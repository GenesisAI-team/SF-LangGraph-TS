import { describe, expect, it } from "vitest";

import {
  agentOutputSchema,
  implementOutputSchema,
  planOutputSchema,
  repairOutputSchema,
  reviewOutputSchema,
  validateRoleOutput,
  verifyOutputSchema,
} from "../src/index.js";
import type { VerifyAgentOutput } from "../src/index.js";
import {
  reviewApprovedOutput,
  reviewChangesOutput,
  contradictoryVerifyOutput,
  validImplementOutput,
  validPlanOutput,
  validRepairOutput,
  verifyFailedOutput,
  verifyPassedOutput,
} from "./helpers.js";

const allValidOutputs = [
  validPlanOutput,
  validImplementOutput,
  verifyPassedOutput,
  verifyFailedOutput,
  reviewApprovedOutput,
  reviewChangesOutput,
  validRepairOutput,
] as const;

describe("salidas esquemadas por rol", () => {
  it("cada rol valida su salida de ejemplo contra su esquema y contra la union", () => {
    expect(planOutputSchema.parse(validPlanOutput)).toEqual(validPlanOutput);
    expect(implementOutputSchema.parse(validImplementOutput)).toEqual(validImplementOutput);
    expect(verifyOutputSchema.parse(verifyPassedOutput)).toEqual(verifyPassedOutput);
    expect(verifyOutputSchema.parse(verifyFailedOutput)).toEqual(verifyFailedOutput);
    expect(reviewOutputSchema.parse(reviewApprovedOutput)).toEqual(reviewApprovedOutput);
    expect(reviewOutputSchema.parse(reviewChangesOutput)).toEqual(reviewChangesOutput);
    expect(repairOutputSchema.parse(validRepairOutput)).toEqual(validRepairOutput);
    for (const output of allValidOutputs) {
      expect(agentOutputSchema.parse(output)).toEqual(output);
    }
  });

  it("la evidencia de la salida cumple evidenceEntrySchema de @sf/contracts", () => {
    const parsed = verifyOutputSchema.parse({
      ...verifyPassedOutput,
      evidence: [{ name: "logs-ci", status: "passed", detail: "salida de CI" }],
    });
    expect(parsed.evidence).toEqual([
      { name: "logs-ci", status: "passed", detail: "salida de CI" },
    ]);
  });

  it("la evidencia por defecto es una lista vacia", () => {
    const parsed = planOutputSchema.parse({
      role: "plan",
      summary: "plan sin evidencia",
      plan: [{ title: "titulo", detail: "detalle" }],
    });
    expect(parsed.evidence).toEqual([]);
  });

  it("rechaza campos desconocidos en la salida y en las entradas anidadas", () => {
    expect(planOutputSchema.safeParse({ ...validPlanOutput, extra: true }).success).toBe(false);
    expect(
      planOutputSchema.safeParse({
        ...validPlanOutput,
        plan: [{ title: "titulo", detail: "detalle", extra: 1 }],
      }).success,
    ).toBe(false);
  });

  it("rechaza resumenes vacios o fuera del limite de transitionEventSchema", () => {
    expect(planOutputSchema.safeParse({ ...validPlanOutput, summary: "" }).success).toBe(false);
    expect(
      planOutputSchema.safeParse({ ...validPlanOutput, summary: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rechaza listas vacias o fuera de rango por rol", () => {
    expect(planOutputSchema.safeParse({ ...validPlanOutput, plan: [] }).success).toBe(false);
    expect(
      planOutputSchema.safeParse({
        ...validPlanOutput,
        plan: Array.from({ length: 21 }, () => ({
          title: "titulo",
          detail: "detalle",
        })),
      }).success,
    ).toBe(false);
    expect(
      implementOutputSchema.safeParse({ ...validImplementOutput, changedFiles: [] }).success,
    ).toBe(false);
    expect(verifyOutputSchema.safeParse({ ...verifyPassedOutput, checks: [] }).success).toBe(false);
  });

  it("rechaza checks sin veredicto booleano", () => {
    expect(
      verifyOutputSchema.safeParse({
        ...verifyPassedOutput,
        checks: [{ name: "pnpm-verify", passed: "si", detail: "detalle" }],
      }).success,
    ).toBe(false);
  });

  it("rechaza un veredicto passed con checks fallidos: salida contradictoria", () => {
    expect(verifyOutputSchema.safeParse(contradictoryVerifyOutput).success).toBe(false);
    expect(agentOutputSchema.safeParse(contradictoryVerifyOutput).success).toBe(false);
    expect(validateRoleOutput("verify", contradictoryVerifyOutput).ok).toBe(false);
  });

  it("acepta un veredicto failed con todos los checks pasados: conservador y sin avance", () => {
    const conservador: VerifyAgentOutput = {
      ...verifyPassedOutput,
      verdict: "failed",
      summary: "veredicto failed sin checks fallidos",
    };
    expect(verifyOutputSchema.safeParse(conservador).success).toBe(true);
    expect(validateRoleOutput("verify", conservador).ok).toBe(true);
  });

  it("rechaza una salida de otro rol via validateRoleOutput", () => {
    expect(validateRoleOutput("plan", validImplementOutput).ok).toBe(false);
    expect(validateRoleOutput("implement", validPlanOutput).ok).toBe(false);
    expect(validateRoleOutput("plan", validPlanOutput)).toEqual({
      ok: true,
      output: validPlanOutput,
    });
  });
});
