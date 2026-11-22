import type { EvidenceEntry, RunState } from "@sf/contracts";
import type { EpisodeStepContext, EpisodeSteps, StepResult } from "@sf/engine";

import { AgentBudgetExhaustedError, InvalidAgentRequestError } from "./agent-errors.js";
import type { AgentInvocation, AgentManager } from "./agent-manager.js";
import type { AgentRequest } from "./agent-request.js";
import type { AgentRole } from "./agent-roles.js";
import type { VerifyAgentOutput } from "./agent-outputs.js";
import { boundDetail, stepReason } from "./limits.js";

export const roleStates = [
  "planning",
  "implementing",
  "verifying",
  "reviewing",
  "repairing",
] as const satisfies readonly RunState[];

export type RoleState = (typeof roleStates)[number];

export const roleByState: Readonly<Record<RoleState, AgentRole>> = {
  planning: "plan",
  implementing: "implement",
  verifying: "verify",
  reviewing: "review",
  repairing: "repair",
};

export interface RoleStepDeps {
  readonly manager: AgentManager;
}

export type RoleSteps = Pick<EpisodeSteps, RoleState>;

export function createRoleStepHandlers(deps: RoleStepDeps): RoleSteps {
  const handlers: RoleSteps = {};
  for (const state of roleStates) {
    const role = roleByState[state];
    handlers[state] = (context: EpisodeStepContext) => runRoleStep(role, context, deps.manager);
  }
  return handlers;
}

async function runRoleStep(
  role: AgentRole,
  context: EpisodeStepContext,
  manager: AgentManager,
): Promise<StepResult> {
  const request: AgentRequest = {
    role,
    episodeId: context.runtime.episodeId,
    issueId: context.runtime.issueId,
    branch: context.runtime.branch,
    attempt: context.runtime.attempt,
  };
  let invocation: AgentInvocation;
  try {
    invocation = await manager.invoke(request);
  } catch (error) {
    return failureFromError(role, error);
  }
  return outcomeFromOutput(role, invocation);
}

function failureFromError(role: AgentRole, error: unknown): StepResult {
  if (error instanceof AgentBudgetExhaustedError) {
    return {
      kind: "failure",
      reason: stepReason(
        "AGENTE_PRESUPUESTO_AGOTADO",
        `el rol ${role} agoto ${error.attempts} intentos sin salida valida`,
      ),
      repair: false,
      evidence: [...error.evidence],
    };
  }
  if (error instanceof InvalidAgentRequestError) {
    return {
      kind: "failure",
      reason: stepReason(
        "AGENTE_ENTRADA_INVALIDA",
        `la peticion del rol ${role} no cumple agentRequestSchema`,
      ),
      repair: false,
      evidence: [
        {
          name: `agent-${role}-invalid-request`,
          status: "failed",
          detail: boundDetail(error.message),
        },
      ],
    };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return {
    kind: "failure",
    reason: stepReason("AGENTE_ERROR", `el rol ${role} fallo inesperadamente`),
    repair: true,
    evidence: [{ name: `agent-${role}-crash`, status: "failed", detail: boundDetail(detail) }],
  };
}

function outcomeFromOutput(role: AgentRole, invocation: AgentInvocation): StepResult {
  const { output } = invocation;
  const evidence = [...invocation.evidence, ...output.evidence];
  switch (output.role) {
    case "plan":
      return {
        kind: "transition",
        to: "implementing",
        reason: stepReason("ROL_PLAN_OK", output.summary),
        evidence,
      };
    case "implement":
      return {
        kind: "transition",
        to: "verifying",
        reason: stepReason("ROL_IMPLEMENT_OK", output.summary),
        evidence,
      };
    case "verify": {
      const verifyEvidence: EvidenceEntry[] = [
        ...invocation.evidence,
        ...evidenceFromChecks(output),
        ...output.evidence,
      ];
      if (output.verdict === "passed") {
        return {
          kind: "transition",
          to: "reviewing",
          reason: stepReason("ROL_VERIFY_OK", output.summary),
          evidence: verifyEvidence,
        };
      }
      return {
        kind: "failure",
        reason: stepReason("ROL_VERIFY_FALLO", output.summary),
        repair: true,
        evidence: verifyEvidence,
      };
    }
    case "review":
      if (output.verdict === "approved") {
        return {
          kind: "transition",
          to: "prReady",
          reason: stepReason("ROL_REVIEW_OK", output.summary),
          evidence,
        };
      }
      return {
        kind: "failure",
        reason: stepReason("ROL_REVIEW_CAMBIOS", output.summary),
        repair: true,
        evidence,
      };
    case "repair":
      return {
        kind: "transition",
        to: "verifying",
        reason: stepReason("ROL_REPAIR_OK", output.summary),
        evidence,
      };
    default:
      return assertNeverOutput(output, role);
  }
}

function evidenceFromChecks(output: VerifyAgentOutput): EvidenceEntry[] {
  return output.checks.map((check) => ({
    name: check.name,
    status: check.passed ? "passed" : "failed",
    detail: boundDetail(check.detail),
  }));
}

function assertNeverOutput(value: never, role: AgentRole): never {
  throw new Error(
    `INVARIANT_AGENTS: salida sin mapeo a paso para el rol ${role}: ${JSON.stringify(value)}`,
  );
}
