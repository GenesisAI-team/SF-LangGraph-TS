import { expect, it, describe } from "vitest";

import { parseIssueEnvelope } from "../src/index.js";

const validEnvelope = {
  issueId: "GEN-999",
  repo: "GenesisAI-team/SF-LangGraph-TS",
  branch: "feat/GEN-999-implementar-x",
  title: "Implementar X",
  objective: "Entregar X verificable",
  acceptanceCriteria: ["Comando typecheck pasa en CI", "Test de X cubre caso feliz y error"],
  riskTier: "medium",
  budget: { maxAttempts: 2, attemptTimeoutSeconds: 900, maxConcurrency: 1 },
};

describe("parseIssueEnvelope", () => {
  it("acepta un sobre de issue valido y devuelve los datos tipados", () => {
    const parsed = parseIssueEnvelope(validEnvelope);
    expect(parsed.issueId).toBe("GEN-999");
    expect(parsed.riskTier).toBe("medium");
    expect(parsed.acceptanceCriteria).toHaveLength(2);
  });

  it("rechaza el sobre si falta el repositorio", () => {
    const invalid = { ...validEnvelope } as { repo?: string };
    delete invalid.repo;
    expect(() => parseIssueEnvelope(invalid)).toThrow();
  });

  it("rechaza el sobre si faltan los criterios de aceptacion", () => {
    const invalid = { ...validEnvelope } as { acceptanceCriteria?: readonly string[] };
    delete invalid.acceptanceCriteria;
    expect(() => parseIssueEnvelope(invalid)).toThrow();
  });

  it("rechaza un identificador de issue que no cumple el formato GEN-N", () => {
    const invalid = { ...validEnvelope, issueId: "ISSUE-999" };
    expect(() => parseIssueEnvelope(invalid)).toThrow();
  });
});
