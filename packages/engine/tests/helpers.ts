import type { ExecutionBudget, EvidenceEntry, RunState } from "@sf/contracts";

import type { EpisodeCheckpoint, EpisodeRunInput } from "../src/episode-runtime.js";
import type { EpisodeStepHandler, EpisodeSteps } from "../src/episode-motor.js";
import { createInMemoryCheckpointAdapter } from "../src/checkpoint-adapter.js";
import type { EpisodeCheckpointAdapter } from "../src/checkpoint-adapter.js";

export const EPISODE_ID = "5e6abe7e-1f16-4b0e-9dd8-63f7d84f447f";

export const runInput: EpisodeRunInput = {
  episodeId: EPISODE_ID,
  issueId: "GEN-48",
  branch: "feat/GEN-48-motor-episodios",
};

export const baseBudget: ExecutionBudget = {
  maxAttempts: 3,
  attemptTimeoutSeconds: 900,
  maxConcurrency: 1,
};

/** Reloj fijo: las ISO de todos los eventos coinciden entre ejecuciones. */
export function constantClock(): () => Date {
  const fixed = new Date("2026-11-10T09:00:00.000Z");
  return () => new Date(fixed.getTime());
}

/** Reloj reproducible que avanza un segundo por consulta. */
export function tickingClock(): () => Date {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 10, 10, 9, 0, tick++));
}

const stepTargets: Readonly<Record<RunState, RunState>> = {
  ready: "preparing",
  preparing: "planning",
  planning: "implementing",
  implementing: "verifying",
  verifying: "reviewing",
  repairing: "verifying",
  reviewing: "prReady",
  prReady: "awaitingMerge",
  awaitingMerge: "done",
  blocked: "blocked",
  done: "done",
};

export type StepCounters = Map<RunState, number>;

export interface AdvanceFixture {
  readonly steps: EpisodeSteps;
  readonly counters: StepCounters;
}

export interface AdvanceFixtureOptions {
  readonly overrides?: Partial<Record<RunState, EpisodeStepHandler>>;
  readonly evidence?: Partial<Record<RunState, readonly EvidenceEntry[]>>;
}

/**
 * Handlers deterministas que avanzan cada estado hacia su sucesor feliz,
 * llevan contadores de invocaciones y adjuntan evidencia si se indica.
 */
export function advanceHandlers(options: AdvanceFixtureOptions = {}): AdvanceFixture {
  const counters: StepCounters = new Map();
  const steps: EpisodeSteps = {};
  for (const [state, handler] of Object.entries(options.overrides ?? {})) {
    steps[state as RunState] = countedHandler(state as RunState, counters, handler);
  }
  for (const state of Object.keys(stepTargets) as RunState[]) {
    if (state === "done" || state === "blocked") {
      continue;
    }
    if (steps[state] !== undefined) {
      continue;
    }
    const target = stepTargets[state];
    const evidence = options.evidence?.[state] ?? [];
    steps[state] = countedHandler(state, counters, () => ({
      kind: "transition",
      to: target,
      reason: `PASO_${state.toUpperCase()}_OK`,
      evidence: [...evidence],
    }));
  }
  return { steps, counters };
}

function countedHandler(
  state: RunState,
  counters: StepCounters,
  base: EpisodeStepHandler,
): EpisodeStepHandler {
  return (context: Parameters<EpisodeStepHandler>[0]) => {
    counters.set(state, (counters.get(state) ?? 0) + 1);
    return base(context);
  };
}

export interface CheckpointHistory {
  readonly saves: EpisodeCheckpoint[];
}

/** Adapter de grabacion: registra cada checkpoint column por columna. */
export function recordingAdapter(underlying: EpisodeCheckpointAdapter): {
  adapter: EpisodeCheckpointAdapter;
  history: CheckpointHistory;
} {
  const saves: EpisodeCheckpoint[] = [];
  return {
    adapter: {
      save: async (checkpoint) => {
        saves.push(structuredClone(checkpoint));
        await underlying.save(checkpoint);
      },
      load: async (episodeId) => underlying.load(episodeId),
    },
    history: { saves },
  };
}

export { createInMemoryCheckpointAdapter };
