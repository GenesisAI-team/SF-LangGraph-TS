import type { AgentRequest } from "./agent-request.js";
import type { AgentRole } from "./agent-roles.js";
import { NoScriptedOutputError } from "./agent-errors.js";

export interface AgentAdapter {
  invoke(request: AgentRequest): Promise<unknown>;
}

export interface ScriptedAgentAdapterOptions {
  readonly scripts?: Partial<Record<AgentRole, readonly unknown[]>>;
}

/** Adaptador simulado determinista: consume el guion del rol en orden y, agotado, repite la ultima salida. */
export class ScriptedAgentAdapter implements AgentAdapter {
  private readonly cursors = new Map<AgentRole, number>();
  private readonly calls = new Map<AgentRole, number>();

  constructor(private readonly options: ScriptedAgentAdapterOptions = {}) {}

  invoke(request: AgentRequest): Promise<unknown> {
    const script = this.options.scripts?.[request.role];
    if (script === undefined || script.length === 0) {
      return Promise.reject(new NoScriptedOutputError(request.role));
    }
    const index = Math.min(this.cursors.get(request.role) ?? 0, script.length - 1);
    this.cursors.set(request.role, index + 1);
    this.calls.set(request.role, (this.calls.get(request.role) ?? 0) + 1);
    return Promise.resolve(script[index]);
  }

  invocationsFor(role: AgentRole): number {
    return this.calls.get(role) ?? 0;
  }
}

export function createScriptedAgentAdapter(
  options: ScriptedAgentAdapterOptions = {},
): ScriptedAgentAdapter {
  return new ScriptedAgentAdapter(options);
}
