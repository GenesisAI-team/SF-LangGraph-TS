import { z } from "zod";

export const runStates = [
  "ready",
  "preparing",
  "planning",
  "implementing",
  "verifying",
  "reviewing",
  "repairing",
  "prReady",
  "awaitingMerge",
  "done",
  "blocked",
] as const;

export const runStateSchema = z.enum(runStates);

export type RunState = z.infer<typeof runStateSchema>;
