import { z } from "zod";

import { evidenceEntrySchema } from "@sf/contracts";

import type { AgentRole } from "./agent-roles.js";

const evidenceListSchema = z
  .array(evidenceEntrySchema)
  .max(50)
  .default(() => []);

const summarySchema = z.string().min(1).max(500);

const planStepSchema = z
  .object({
    title: z.string().min(1).max(200),
    detail: z.string().min(1).max(500),
  })
  .strict();

export const planOutputSchema = z
  .object({
    role: z.literal("plan"),
    summary: summarySchema,
    plan: z.array(planStepSchema).min(1).max(20),
    evidence: evidenceListSchema,
  })
  .strict();

export const implementOutputSchema = z
  .object({
    role: z.literal("implement"),
    summary: summarySchema,
    changedFiles: z.array(z.string().min(1).max(200)).min(1).max(200),
    evidence: evidenceListSchema,
  })
  .strict();

const checkSchema = z
  .object({
    name: z.string().min(1).max(200),
    passed: z.boolean(),
    detail: z.string().min(1).max(500),
  })
  .strict();

/**
 * Un veredicto passed con checks fallidos es una salida contradictoria: el
 * repositorio exige verificacion local verde antes de salir de verifying
 * (AGENTS.md), asi que se rechaza en la validacion y el gestor la reintenta
 * con su presupuesto en lugar de avanzar a reviewing (revision GEN-53).
 */
export const verifyOutputSchema = z
  .object({
    role: z.literal("verify"),
    summary: summarySchema,
    verdict: z.enum(["passed", "failed"]),
    checks: z.array(checkSchema).min(1).max(50),
    evidence: evidenceListSchema,
  })
  .strict()
  .superRefine((output, ctx) => {
    if (output.verdict === "passed" && output.checks.some((check) => !check.passed)) {
      ctx.addIssue({
        code: "custom",
        path: ["verdict"],
        message: "un veredicto passed no puede coexistir con checks fallidos",
      });
    }
  });

export const reviewOutputSchema = z
  .object({
    role: z.literal("review"),
    summary: summarySchema,
    verdict: z.enum(["approved", "changesRequested"]),
    comments: z
      .array(z.string().min(1).max(500))
      .max(20)
      .default(() => []),
    evidence: evidenceListSchema,
  })
  .strict();

export const repairOutputSchema = z
  .object({
    role: z.literal("repair"),
    summary: summarySchema,
    fixes: z
      .array(
        z
          .object({
            issue: z.string().min(1).max(200),
            resolution: z.string().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    evidence: evidenceListSchema,
  })
  .strict();

export const agentOutputSchema = z.discriminatedUnion("role", [
  planOutputSchema,
  implementOutputSchema,
  verifyOutputSchema,
  reviewOutputSchema,
  repairOutputSchema,
]);

export type PlanAgentOutput = z.infer<typeof planOutputSchema>;
export type ImplementAgentOutput = z.infer<typeof implementOutputSchema>;
export type VerifyAgentOutput = z.infer<typeof verifyOutputSchema>;
export type ReviewAgentOutput = z.infer<typeof reviewOutputSchema>;
export type RepairAgentOutput = z.infer<typeof repairOutputSchema>;
export type AgentOutput = z.infer<typeof agentOutputSchema>;

export type RoleOutputValidation =
  | { readonly ok: true; readonly output: AgentOutput }
  | { readonly ok: false; readonly issues: string };

export function validateRoleOutput(role: AgentRole, raw: unknown): RoleOutputValidation {
  switch (role) {
    case "plan":
      return validateWith(planOutputSchema, raw);
    case "implement":
      return validateWith(implementOutputSchema, raw);
    case "verify":
      return validateWith(verifyOutputSchema, raw);
    case "review":
      return validateWith(reviewOutputSchema, raw);
    case "repair":
      return validateWith(repairOutputSchema, raw);
    default:
      return assertNever(role);
  }
}

function validateWith<T extends AgentOutput>(
  schema: z.ZodType<T>,
  raw: unknown,
): RoleOutputValidation {
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, output: parsed.data };
  }
  return { ok: false, issues: z.prettifyError(parsed.error) };
}

function assertNever(value: never): never {
  throw new Error(`INVARIANT_AGENTS: rol sin esquema de salida: ${JSON.stringify(value)}`);
}
