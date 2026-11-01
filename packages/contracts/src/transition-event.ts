import { z } from "zod";

import { issueIdSchema } from "./issue-envelope.js";
import { runStateSchema } from "./run-state.js";

export const transitionEventSchema = z
  .object({
    issueId: issueIdSchema,
    from: runStateSchema,
    to: runStateSchema,
    reason: z.string().min(1).max(500),
    at: z.string().datetime(),
  })
  .strict();

export type TransitionEvent = z.infer<typeof transitionEventSchema>;
