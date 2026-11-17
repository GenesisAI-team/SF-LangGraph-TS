import type { ExecutionBudget, EvidenceEntry, RunState } from "@sf/contracts";
import type { EpisodeStepHandler, EpisodeSteps } from "@sf/engine";

import type { AgentRequest } from "../src/agent-request.js";
import type { AgentRole } from "../src/agent-roles.js";
import type {
  ImplementAgentOutput,
  PlanAgentOutput,
  RepairAgentOutput,
  ReviewAgentOutput,
  VerifyAgentOutput,
} from "../src/agent-outputs.js";
import type { RoleSteps } from "../src/role-steps.js";

export const EPISODE_ID = "4f8a2c3e-1b7d-4e5f-9a0b-2c3d4e5f6a7b";

export const baseBudget: ExecutionBudget = {
  maxAttempts: 3,
  attemptTimeoutSeconds: 900,
  maxConcurrency: 1,
};

export function constantClock(): () => Date {
  const fixed = new Date("2026-11-17T09:00:00.000Z");
  return () => new Date(fixed.getTime());
}

export function evidence(
  name: string,
  detail: string,
  status: "passed" | "failed" = "passed",
): EvidenceEntry {
  return { name, status, detail };
}

export function requestFor(role: AgentRole): AgentRequest {
  return {
    role,
    episodeId: EPISODE_ID,
    issueId: "GEN-53",
    branch: "feat/GEN-53-agent-manager-roles",
    attempt: 1,
  };
}

export const validPlanOutput: PlanAgentOutput = {
  role: "plan",
  summary: "Plan de dos pasos para GEN-53",
  plan: [
    { title: "Definir esquemas de salida", detail: "Schemas Zod por rol en packages/agents" },
    { title: "Integrar con episodios", detail: "Handlers por rol para el motor" },
  ],
  evidence: [evidence("plan-borrador", "2 pasos definidos")],
};

export const invalidPlanOutput = { role: "plan", summary: "sin pasos", plan: [] };

export const invalidVerifyOutput = { role: "verify", summary: "sin checks", verdict: "passed" };

export const validImplementOutput: ImplementAgentOutput = {
  role: "implement",
  summary: "Agent Manager implementado con adaptadores simulados",
  changedFiles: ["packages/agents/src/agent-manager.ts", "packages/agents/src/role-steps.ts"],
  evidence: [],
};

export const verifyPassedOutput: VerifyAgentOutput = {
  role: "verify",
  summary: "gates verdes",
  verdict: "passed",
  checks: [
    {
      name: "pnpm-verify",
      passed: true,
      detail: "format, lint, typecheck, test y build en verde",
    },
  ],
  evidence: [],
};

export const verifyFailedOutput: VerifyAgentOutput = {
  role: "verify",
  summary: "gates en rojo",
  verdict: "failed",
  checks: [{ name: "pnpm-verify", passed: false, detail: "el test de presupuesto fallo" }],
  evidence: [],
};

export const reviewApprovedOutput: ReviewAgentOutput = {
  role: "review",
  summary: "cambios conforme al objetivo",
  verdict: "approved",
  comments: [],
  evidence: [],
};

export const reviewChangesOutput: ReviewAgentOutput = {
  role: "review",
  summary: "falta cubrir el presupuesto",
  verdict: "changesRequested",
  comments: ["agrega el test de presupuesto agotado"],
  evidence: [],
};

export const validRepairOutput: RepairAgentOutput = {
  role: "repair",
  summary: "presupuesto cubierto",
  fixes: [{ issue: "test de presupuesto agotado", resolution: "test agregado y en verde" }],
  evidence: [evidence("repair-parche", "1 fix aplicado")],
};

/**
 * Handlers passthrough deterministas para los estados del episodio que no
 * pertenecen a un rol agente (ready, preparing, prReady, awaitingMerge).
 */
export function fullSteps(roleSteps: RoleSteps, counters: Map<RunState, number>): EpisodeSteps {
  const pass =
    (from: RunState, to: RunState): EpisodeStepHandler =>
    () => {
      counters.set(from, (counters.get(from) ?? 0) + 1);
      return { kind: "transition", to, reason: `PASO_${from.toUpperCase()}_OK`, evidence: [] };
    };
  return {
    ...roleSteps,
    ready: pass("ready", "preparing"),
    preparing: pass("preparing", "planning"),
    prReady: pass("prReady", "awaitingMerge"),
    awaitingMerge: pass("awaitingMerge", "done"),
  };
}
