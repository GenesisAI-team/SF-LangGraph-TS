import { z } from "zod";

import type { EvidenceEntry, ExecutionBudget } from "@sf/contracts";

import type { AgentAdapter } from "./agent-adapter.js";
import { AgentBudgetExhaustedError, InvalidAgentRequestError } from "./agent-errors.js";
import { validateRoleOutput } from "./agent-outputs.js";
import type { AgentOutput } from "./agent-outputs.js";
import { agentRequestSchema } from "./agent-request.js";
import type { AgentRequest } from "./agent-request.js";
import { boundDetail } from "./limits.js";

export interface AgentInvocation {
  readonly output: AgentOutput;
  readonly attempts: number;
  readonly evidence: readonly EvidenceEntry[];
}

export interface AgentManagerConfig {
  readonly adapter: AgentAdapter;
  readonly budget: ExecutionBudget;
}

export interface AgentManager {
  invoke(request: AgentRequest): Promise<AgentInvocation>;
}

export function createAgentManager(config: AgentManagerConfig): AgentManager {
  return {
    async invoke(request: AgentRequest): Promise<AgentInvocation> {
      const parsedRequest = agentRequestSchema.safeParse(request);
      if (!parsedRequest.success) {
        throw new InvalidAgentRequestError(request, z.prettifyError(parsedRequest.error));
      }
      const { role } = parsedRequest.data;
      const failedEvidence: EvidenceEntry[] = [];
      for (let attempt = 1; attempt <= config.budget.maxAttempts; attempt += 1) {
        const raw = await config.adapter.invoke(parsedRequest.data);
        const validation = validateRoleOutput(role, raw);
        if (validation.ok) {
          return { output: validation.output, attempts: attempt, evidence: [...failedEvidence] };
        }
        failedEvidence.push({
          name: `agent-${role}-invalid-output`,
          status: "failed",
          detail: boundDetail(validation.issues),
        });
      }
      throw new AgentBudgetExhaustedError({
        role,
        attempts: config.budget.maxAttempts,
        evidence: [...failedEvidence],
      });
    },
  };
}
