import { z } from "zod";

export const issueIdSchema = z.string().regex(/^GEN-\d+$/, "issueId debe cumplir el formato GEN-N");

export const repoSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "repo debe ser owner/name");

export const branchSchema = z
  .string()
  .regex(
    /^(feat|fix|refactor|chore|docs|perf)\/GEN-\d+-[a-z0-9-]+$/,
    "branch debe cumplir feat|fix|refactor|chore|docs|perf/GEN-N-descripcion-corta",
  );

export const riskTierSchema = z.enum(["low", "medium", "high"]);

export type RiskTier = z.infer<typeof riskTierSchema>;

export const executionBudgetSchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(10),
    attemptTimeoutSeconds: z.number().int().min(1).max(86400),
    maxConcurrency: z.number().int().min(1).max(16),
  })
  .strict();

export type ExecutionBudget = z.infer<typeof executionBudgetSchema>;

export const issueEnvelopeSchema = z
  .object({
    issueId: issueIdSchema,
    repo: repoSchema,
    branch: branchSchema,
    title: z.string().min(1),
    objective: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    riskTier: riskTierSchema,
    budget: executionBudgetSchema,
  })
  .strict();

export type IssueEnvelope = z.infer<typeof issueEnvelopeSchema>;

export function parseIssueEnvelope(input: unknown): IssueEnvelope {
  return issueEnvelopeSchema.parse(input);
}
