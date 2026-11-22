import type { EvidenceEntry } from "@sf/contracts";

import type { AgentRole } from "./agent-roles.js";

export class AgentsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidAgentRequestError extends AgentsError {
  readonly request: unknown;

  constructor(request: unknown, issues: string) {
    super(
      `AGENTE_ENTRADA_INVALIDA: la peticion al agente no cumple agentRequestSchema: ${issues}; peticion=${describeJson(request)}`,
    );
    this.request = request;
  }
}

export class AgentBudgetExhaustedError extends AgentsError {
  readonly role: AgentRole;
  readonly attempts: number;
  readonly evidence: readonly EvidenceEntry[];

  constructor(params: { role: AgentRole; attempts: number; evidence: readonly EvidenceEntry[] }) {
    super(
      `AGENTE_PRESUPUESTO_AGOTADO: el rol ${params.role} agoto ${params.attempts} intentos sin una salida valida`,
    );
    this.role = params.role;
    this.attempts = params.attempts;
    this.evidence = params.evidence;
  }
}

export class NoScriptedOutputError extends AgentsError {
  readonly role: AgentRole;

  constructor(role: AgentRole) {
    super(
      `SALIDA_NO_PROGRAMADA: el adaptador simulado no tiene salida programada para el rol ${role}`,
    );
    this.role = role;
  }
}

function describeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
