import { z } from "zod";

import {
  branchSchema,
  evidenceEntrySchema,
  issueIdSchema,
  runStateSchema,
  transitionEventSchema,
} from "@sf/contracts";
import type { RunState } from "@sf/contracts";
import { canTransition } from "@sf/orchestration";

export const episodeRunInputSchema = z
  .object({
    episodeId: z.string().uuid(),
    issueId: issueIdSchema,
    branch: branchSchema,
  })
  .strict();

export type EpisodeRunInput = z.infer<typeof episodeRunInputSchema>;

export const episodeFailureCodeSchema = z.enum(["DEFINITIVO", "BUDGET_AGOTADO"]);

export const episodeFailureSchema = z
  .object({
    code: episodeFailureCodeSchema,
    message: z.string().min(1).max(500),
    at: z.string().datetime(),
  })
  .strict();

export type EpisodeFailure = z.infer<typeof episodeFailureSchema>;

interface CadenaRuntime {
  readonly runState: RunState;
  readonly attempt: number;
  readonly events: readonly { from: RunState; to: RunState }[];
  readonly failure: unknown;
}

function inconsistenciaDeCadena(runtime: CadenaRuntime): string | null {
  const { events, runState, attempt } = runtime;
  if (events.length === 0) {
    if (runState !== "ready") {
      return `RUNTIME_INCONSISTENTE: sin eventos el runState debe ser "ready", pero es ${runState}`;
    }
    if (attempt !== 1) {
      return `RUNTIME_INCONSISTENTE: sin eventos el attempt debe ser 1, pero es ${attempt}`;
    }
  }

  let current: RunState = "ready";
  let repairs = 0;
  for (const event of events) {
    if (event.from !== current) {
      return `RUNTIME_INCONSISTENTE: el evento declara origen ${event.from} pero la cadena efectiva esta en ${current}`;
    }
    if (!canTransition(current, event.to)) {
      return `RUNTIME_INCONSISTENTE: la transicion ${current} -> ${event.to} no es legal segun la tabla`;
    }
    current = event.to;
    if (event.to === "repairing") {
      repairs += 1;
    }
  }

  if (events.length > 0 && current !== runState) {
    return `RUNTIME_INCONSISTENTE: la cadena de eventos termina en ${current} pero el runState declarado es ${runState}`;
  }
  if (attempt !== repairs + 1) {
    return `RUNTIME_INCONSISTENTE: attempt=${attempt} no coincide con los ${repairs} reintentos registrados`;
  }
  if (runtime.failure !== null && runState !== "blocked") {
    return `RUNTIME_INCONSISTENTE: failure solo puede existir en el estado terminal blocked (estado actual: ${runState})`;
  }
  return null;
}

export const episodeRuntimeSchema = z
  .object({
    episodeId: z.string().uuid(),
    issueId: issueIdSchema,
    branch: branchSchema,
    runState: runStateSchema,
    attempt: z.number().int().min(1),
    events: z.array(transitionEventSchema),
    evidence: z.array(evidenceEntrySchema),
    pausedReason: z.union([z.string().min(1).max(500), z.null()]),
    failure: z.union([episodeFailureSchema, z.null()]),
  })
  .strict()
  .superRefine((runtime, ctx) => {
    const issue = inconsistenciaDeCadena(runtime);
    if (issue !== null) {
      ctx.addIssue({ code: "custom", message: issue });
    }
  });

export type EpisodeRuntime = z.infer<typeof episodeRuntimeSchema>;

export function parseRuntime(value: unknown): EpisodeRuntime {
  return episodeRuntimeSchema.parse(value);
}

export const episodeCheckpointSchema = z
  .object({
    runtime: episodeRuntimeSchema,
    savedAt: z.string().datetime(),
  })
  .strict();

export type EpisodeCheckpoint = z.infer<typeof episodeCheckpointSchema>;

export function parseCheckpoint(value: unknown): EpisodeCheckpoint {
  return episodeCheckpointSchema.parse(value);
}

export function parseRunInput(value: unknown): EpisodeRunInput {
  return episodeRunInputSchema.parse(value);
}
