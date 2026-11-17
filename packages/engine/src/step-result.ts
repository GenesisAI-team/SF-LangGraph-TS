import { z } from "zod";

import { evidenceEntrySchema, runStateSchema } from "@sf/contracts";

/**
 * Limite de evidencia por resultado de paso: cubre el peor caso legal de un
 * paso de rol sin descartar evidencia de auditoria. Un verify puede aportar
 * 50 checks + 50 evidencias de salida (limites de agent-outputs) y hasta 9
 * entradas de reintentos del gestor (maxAttempts <= 10 en
 * executionBudgetSchema de @sf/contracts); combinarlos no debe abortar el
 * episodio con InvalidStepResultError (revision GEN-53).
 */
const MAX_STEP_EVIDENCE = 110;

const evidenceListSchema = z
  .array(evidenceEntrySchema)
  .max(MAX_STEP_EVIDENCE)
  .default(() => []);

export const stepTransitionResultSchema = z
  .object({
    kind: z.literal("transition"),
    to: runStateSchema,
    reason: z.string().min(1).max(500),
    evidence: evidenceListSchema,
  })
  .strict();

export const stepFailureResultSchema = z
  .object({
    kind: z.literal("failure"),
    reason: z.string().min(1).max(500),
    repair: z.boolean().default(() => true),
    evidence: evidenceListSchema,
  })
  .strict();

export const stepPauseResultSchema = z
  .object({
    kind: z.literal("pause"),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const stepResultSchema = z.discriminatedUnion("kind", [
  stepTransitionResultSchema,
  stepFailureResultSchema,
  stepPauseResultSchema,
]);

export type StepTransitionResult = z.infer<typeof stepTransitionResultSchema>;
export type StepFailureResult = z.infer<typeof stepFailureResultSchema>;
export type StepPauseResult = z.infer<typeof stepPauseResultSchema>;
export type StepResult = z.infer<typeof stepResultSchema>;
