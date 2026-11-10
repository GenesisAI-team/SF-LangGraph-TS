import { z } from "zod";

import { evidenceEntrySchema, runStateSchema } from "@sf/contracts";

const evidenceListSchema = z
  .array(evidenceEntrySchema)
  .max(50)
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
