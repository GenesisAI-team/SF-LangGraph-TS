import { describe, expect, it } from "vitest";

import { stepResultSchema, stepTransitionResultSchema } from "../src/step-result.js";
import type { EvidenceEntry } from "@sf/contracts";

/** Evidencia sintetica: cada entrada es unica para que ninguna se descarte. */
function syntheticEvidence(count: number, prefix: string): EvidenceEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix}-${index + 1}`,
    status: "passed",
    detail: "en verde",
  }));
}

describe("limite de evidencia agregada de un resultado de paso", () => {
  it("acepta el peor caso legal de un paso verify: 9 reintentos + 50 checks + 50 evidencias de salida", () => {
    const evidence = [
      ...syntheticEvidence(9, "reintento"),
      ...syntheticEvidence(50, "check"),
      ...syntheticEvidence(50, "salida"),
    ];
    expect(evidence).toHaveLength(109);

    const parsed = stepTransitionResultSchema.safeParse({
      kind: "transition",
      to: "reviewing",
      reason: "qa_en_verde",
      evidence,
    });

    expect(parsed.success).toBe(true);
  });

  it("acepta el peor caso legal de un paso sin checks: 9 reintentos + 50 evidencias de salida", () => {
    const evidence = [...syntheticEvidence(9, "reintento"), ...syntheticEvidence(50, "salida")];

    const parsed = stepResultSchema.safeParse({
      kind: "failure",
      reason: "gates_en_rojo",
      repair: true,
      evidence,
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza una lista de evidencia mas alla del peor caso legal documentado", () => {
    const parsed = stepTransitionResultSchema.safeParse({
      kind: "transition",
      to: "reviewing",
      reason: "qa_en_verde",
      evidence: syntheticEvidence(111, "evidencia"),
    });

    expect(parsed.success).toBe(false);
  });
});
