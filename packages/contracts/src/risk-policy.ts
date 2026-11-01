import { z } from "zod";

export const riskPolicySchema = z
  .object({
    maxRetries: z.number().int().min(0).max(10),
    maxRunTimeoutSeconds: z.number().int().min(1).max(86400),
    maxConcurrentRuns: z.number().int().min(1).max(16),
    maxCostPerRunUsd: z.number().min(0),
    maxMonthlyCostUsd: z.number().min(0),
  })
  .strict();

export type RiskPolicy = z.infer<typeof riskPolicySchema>;
