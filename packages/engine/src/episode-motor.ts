import { StateGraph, START, END } from "@langchain/langgraph";
import type { GraphNode } from "@langchain/langgraph";
import { z } from "zod";

import type { ExecutionBudget, RunState, TransitionEvent } from "@sf/contracts";
import { canTransition, successors } from "@sf/orchestration";

import type { EpisodeCheckpointAdapter } from "./checkpoint-adapter.js";
import {
  DuplicateEpisodeError,
  IllegalTransitionError,
  InvalidCheckpointError,
  InvalidEpisodeInputError,
  InvalidStepResultError,
  MissingStepHandlerError,
  NoCheckpointError,
} from "./episode-errors.js";
import {
  episodeCheckpointSchema,
  episodeRunInputSchema,
  episodeRuntimeSchema,
  type EpisodeCheckpoint,
  type EpisodeFailure,
  type EpisodeRunInput,
  type EpisodeRuntime,
} from "./episode-runtime.js";
import { stepResultSchema, type StepFailureResult, type StepResult } from "./step-result.js";

/** Estados con paso propio: los 9 no terminales de la tabla de @sf/orchestration. */
const activeStepStates = [
  "ready",
  "preparing",
  "planning",
  "implementing",
  "verifying",
  "repairing",
  "reviewing",
  "prReady",
  "awaitingMerge",
] as const satisfies readonly RunState[];

type ActiveStepState = (typeof activeStepStates)[number];

/** La tabla garantiza que desde cualquier estado activo se puede bloquear con evidencia. */
for (const state of activeStepStates) {
  if (!canTransition(state, "blocked")) {
    throw new Error(
      `TABLE_INVARIANT: el estado activo ${state} no tiene a blocked como sucesor; el motor no puede encauzar fallos`,
    );
  }
}

export interface EpisodeStepContext {
  readonly runtime: EpisodeRuntime;
  readonly state: ActiveStepState;
}

export type EpisodeStepHandler = (context: EpisodeStepContext) => StepResult | Promise<StepResult>;

export type EpisodeSteps = Partial<Record<RunState, EpisodeStepHandler>>;

export interface EpisodeMotorConfig {
  readonly steps: EpisodeSteps;
  readonly checkpointAdapter: EpisodeCheckpointAdapter;
  readonly budget: ExecutionBudget;
  readonly now?: () => Date;
}

export type EpisodeRunResult =
  | { readonly status: "completed"; readonly runtime: EpisodeRuntime }
  | { readonly status: "blocked"; readonly runtime: EpisodeRuntime }
  | { readonly status: "paused"; readonly runtime: EpisodeRuntime };

export interface EpisodeMotor {
  start(input: EpisodeRunInput): Promise<EpisodeRunResult>;
  resume(episodeId: string): Promise<EpisodeRunResult>;
}

/* ------------------------------------------------------------------ */
/* Guarda pura: convierte el resultado de un paso en el siguiente      */
/* runtime o lanza errores tipados. Sin LangGraph, sin I/O.            */
/* ------------------------------------------------------------------ */

export function decideStepOutcome(
  runtime: EpisodeRuntime,
  outcome: StepResult,
  budget: ExecutionBudget,
  at: string,
): EpisodeRuntime {
  if (outcome.kind === "pause") {
    return { ...runtime, pausedReason: outcome.reason };
  }
  if (outcome.kind === "failure") {
    return decideFailure(runtime, outcome, budget, at);
  }
  return decideTransition(runtime, outcome, budget, at);
}

function decideFailure(
  runtime: EpisodeRuntime,
  failure: StepFailureResult,
  budget: ExecutionBudget,
  at: string,
): EpisodeRuntime {
  const candidates = successors(runtime.runState);
  const repairPossible = candidates.includes("repairing");
  if (failure.repair && repairPossible && runtime.attempt < budget.maxAttempts) {
    return commitTransition({
      runtime,
      to: "repairing",
      reason: `PASO_FALLIDO_REPARABLE: ${failure.reason}`,
      evidence: failure.evidence,
      at,
      attemptIncrement: 1,
    });
  }
  const exhausted = failure.repair && repairPossible && runtime.attempt >= budget.maxAttempts;
  const code: EpisodeFailure["code"] = exhausted ? "BUDGET_AGOTADO" : "DEFINITIVO";
  const reason = exhausted
    ? `PRESUPUESTO_AGOTADO: ${failure.reason}`
    : `PASO_FALLIDO_DEFINITIVO: ${failure.reason}`;
  return commitTransition({
    runtime,
    to: "blocked",
    reason,
    evidence: failure.evidence,
    at,
    attemptIncrement: 0,
    failure: { code, message: failure.reason, at },
  });
}

type TransitionOutcome = {
  kind: "transition";
  to: RunState;
  reason: string;
  evidence: EpisodeRuntime["evidence"];
};

function decideTransition(
  runtime: EpisodeRuntime,
  outcome: TransitionOutcome,
  budget: ExecutionBudget,
  at: string,
): EpisodeRuntime {
  if (!canTransition(runtime.runState, outcome.to)) {
    throw new IllegalTransitionError({
      episodeId: runtime.episodeId,
      from: runtime.runState,
      to: outcome.to,
      legal: successors(runtime.runState),
    });
  }
  if (outcome.to === "repairing" && runtime.attempt >= budget.maxAttempts) {
    return commitTransition({
      runtime,
      to: "blocked",
      reason: `PRESUPUESTO_AGOTADO: ${outcome.reason}`,
      evidence: outcome.evidence,
      at,
      attemptIncrement: 0,
      failure: { code: "BUDGET_AGOTADO", message: outcome.reason, at },
    });
  }
  return commitTransition({
    runtime,
    to: outcome.to,
    reason: outcome.reason,
    evidence: outcome.evidence,
    at,
    attemptIncrement: outcome.to === "repairing" ? 1 : 0,
  });
}

function commitTransition(params: {
  runtime: EpisodeRuntime;
  to: RunState;
  reason: string;
  evidence: EpisodeRuntime["evidence"];
  at: string;
  attemptIncrement: number;
  failure?: EpisodeFailure;
}): EpisodeRuntime {
  const { runtime, to, reason, evidence, at, attemptIncrement } = params;
  const event: TransitionEvent = {
    issueId: runtime.issueId,
    from: runtime.runState,
    to,
    reason,
    at,
  };
  return {
    ...runtime,
    runState: to,
    attempt: runtime.attempt + attemptIncrement,
    events: [...runtime.events, event],
    evidence: [...runtime.evidence, ...evidence],
    pausedReason: null,
    failure: params.failure ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Grafo LangGraph: entry (router) -> paso -> checkpoint -> router     */
/* ------------------------------------------------------------------ */

type MotorState = { runtime: EpisodeRuntime };
type MotorUpdate = { runtime?: EpisodeRuntime };

const graphStateSchema = z.object({
  runtime: episodeRuntimeSchema,
});

function isoNow(now: () => Date): string {
  return now().toISOString();
}

function createStateNode(
  state: ActiveStepState,
  config: EpisodeMotorConfig,
  now: () => Date,
): GraphNode<typeof graphStateSchema> {
  return async (inputs: MotorState): Promise<MotorUpdate> => {
    const { runtime } = inputs;
    const handler = config.steps[state];
    if (handler === undefined) {
      throw new MissingStepHandlerError({ state, episodeId: runtime.episodeId });
    }
    const raw = await handler({ runtime, state });
    const parsed = stepResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new InvalidStepResultError(state, runtime.episodeId, z.prettifyError(parsed.error));
    }
    const next = decideStepOutcome(runtime, parsed.data, config.budget, isoNow(now));
    return { runtime: next };
  };
}

function createCheckpointNode(
  config: EpisodeMotorConfig,
  now: () => Date,
): GraphNode<typeof graphStateSchema> {
  return async (inputs: MotorState): Promise<MotorUpdate> => {
    await config.checkpointAdapter.save({
      runtime: inputs.runtime,
      savedAt: isoNow(now),
    });
    return {};
  };
}

function routeNext(state: MotorState): string {
  const current = state.runtime;
  if (
    current.runState === "done" ||
    current.runState === "blocked" ||
    current.pausedReason !== null
  ) {
    return END;
  }
  return current.runState;
}

type MotorNodeName = "entry" | "checkpoint" | ActiveStepState;

function buildGraph(config: EpisodeMotorConfig) {
  const now = config.now ?? defaultNow;
  const nodeNames: MotorNodeName[] = ["entry", "checkpoint", ...activeStepStates];
  const destinations: (MotorNodeName | typeof END)[] = [...nodeNames, END];
  const builder = new StateGraph(graphStateSchema, { nodes: [...nodeNames] });
  builder.addNode("entry", (): MotorUpdate => ({}));
  builder.addEdge(START, "entry");
  builder.addConditionalEdges("entry", routeNext, destinations);
  for (const state of activeStepStates) {
    builder.addNode(state, createStateNode(state, config, now));
    builder.addEdge(state, "checkpoint");
  }
  builder.addNode("checkpoint", createCheckpointNode(config, now));
  builder.addConditionalEdges("checkpoint", routeNext, destinations);
  return builder.compile();
}

const defaultNow = (): Date => new Date();

/* ------------------------------------------------------------------ */
/* Motor: start, resume y ejecucion determinista                       */
/* ------------------------------------------------------------------ */

function toResult(runtime: EpisodeRuntime): EpisodeRunResult {
  if (runtime.runState === "done") {
    return { status: "completed", runtime };
  }
  if (runtime.runState === "blocked") {
    return { status: "blocked", runtime };
  }
  if (runtime.pausedReason !== null) {
    return { status: "paused", runtime };
  }
  throw new Error(
    `INVARIANT_MOTOR: el runtime final no es terminal ni pausado (estado ${runtime.runState})`,
  );
}

class EpisodeMotorImpl implements EpisodeMotor {
  constructor(
    private readonly config: EpisodeMotorConfig,
    private readonly graph: ReturnType<typeof buildGraph>,
  ) {}

  async start(input: EpisodeRunInput): Promise<EpisodeRunResult> {
    const parsed = episodeRunInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new InvalidEpisodeInputError(input, z.prettifyError(parsed.error));
    }
    const existing = await this.config.checkpointAdapter.load(parsed.data.episodeId);
    if (existing !== null) {
      throw new DuplicateEpisodeError({
        episodeId: parsed.data.episodeId,
        existingRunState: existing.runtime.runState,
      });
    }
    const initial: EpisodeRuntime = {
      episodeId: parsed.data.episodeId,
      issueId: parsed.data.issueId,
      branch: parsed.data.branch,
      runState: "ready",
      attempt: 1,
      events: [],
      evidence: [],
      pausedReason: null,
      failure: null,
    };
    await this.config.checkpointAdapter.save({
      runtime: initial,
      savedAt: isoNow(this.now),
    });
    return this.execute(initial);
  }

  async resume(episodeId: string): Promise<EpisodeRunResult> {
    const loaded = await this.loadCheckpoint(episodeId);
    if (loaded.runtime.runState === "done" || loaded.runtime.runState === "blocked") {
      return toResult(loaded.runtime);
    }
    const seed: EpisodeRuntime = { ...loaded.runtime, pausedReason: null };
    return this.execute(seed);
  }

  private get now(): () => Date {
    return this.config.now ?? defaultNow;
  }

  private async loadCheckpoint(episodeId: string): Promise<EpisodeCheckpoint> {
    const raw = await this.config.checkpointAdapter.load(episodeId);
    if (raw === null) {
      throw new NoCheckpointError(episodeId);
    }
    const parsed = episodeCheckpointSchema.safeParse(raw);
    if (!parsed.success) {
      throw new InvalidCheckpointError(episodeId, z.prettifyError(parsed.error));
    }
    return parsed.data;
  }

  private async execute(runtime: EpisodeRuntime): Promise<EpisodeRunResult> {
    const final = await this.graph.invoke({ runtime }, { recursionLimit: 512 });
    return toResult(final.runtime);
  }
}

export function createEpisodeMotor(config: EpisodeMotorConfig): EpisodeMotor {
  return new EpisodeMotorImpl(config, buildGraph(config));
}
