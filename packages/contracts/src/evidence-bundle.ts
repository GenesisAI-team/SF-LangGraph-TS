import { z } from "zod";

export const evidenceEntrySchema = z
  .object({
    name: z.string().min(1),
    status: z.enum(["passed", "failed"]),
    detail: z.string().max(10000),
  })
  .strict();

export const evidenceBundleSchema = z
  .object({
    runId: z.string().uuid(),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime().optional(),
    evidence: z.array(evidenceEntrySchema).min(1),
  })
  .strict();

export type EvidenceEntry = z.infer<typeof evidenceEntrySchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
