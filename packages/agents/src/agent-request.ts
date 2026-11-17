import { z } from "zod";

import { branchSchema, issueIdSchema } from "@sf/contracts";

import { agentRoleSchema } from "./agent-roles.js";

export const agentRequestSchema = z
  .object({
    role: agentRoleSchema,
    episodeId: z.string().uuid(),
    issueId: issueIdSchema,
    branch: branchSchema,
    attempt: z.number().int().min(1),
  })
  .strict();

export type AgentRequest = z.infer<typeof agentRequestSchema>;
