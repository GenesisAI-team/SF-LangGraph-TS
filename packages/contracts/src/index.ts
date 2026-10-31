export type IssueId = `GEN-${number}`;

export type RiskTier = "low" | "medium" | "high";

export interface ExecutionBudget {
  /** Intentos de implementacion/repair ya contando el primero. */
  readonly maxAttempts: number;
  /** Timeout de cada intento de agente, en segundos. */
  readonly attemptTimeoutSeconds: number;
  /** Ejecuciones concurrentes permitidas para esta issue. */
  readonly maxConcurrency: number;
}

export interface IssueEnvelope {
  readonly issueId: IssueId;
  readonly repo: string;
  readonly branch: string;
  readonly title: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly riskTier: RiskTier;
  readonly budget: ExecutionBudget;
}

export function parseIssueEnvelope(_input: unknown): IssueEnvelope {
  void _input;
  throw new Error(
    "NOT_IMPLEMENTED: contracts - parseIssueEnvelope. RED de F2; la implementacion llega en GREEN tras aprobacion humana (GEN-16).",
  );
}
