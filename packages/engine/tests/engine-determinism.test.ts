import { describe, expect, it } from "vitest";

import {
  createEpisodeMotor,
  createInMemoryCheckpointAdapter,
  decideStepOutcome,
  IllegalTransitionError,
} from "../src/index.js";
import type { EpisodeCheckpoint, EpisodeRuntime, StepResult } from "../src/index.js";
import {
  advanceHandlers,
  constantClock,
  recordingAdapter,
  runInput,
  EPISODE_ID,
} from "./helpers.js";

const budget = {
  maxAttempts: 3,
  attemptTimeoutSeconds: 900,
  maxConcurrency: 1,
} as const;

async function runFullEpisode(clock: () => Date): Promise<{
  runtime: EpisodeRuntime;
  saves: EpisodeCheckpoint[];
}> {
  const fixture = advanceHandlers();
  const memory = createInMemoryCheckpointAdapter();
  const { adapter, history } = recordingAdapter(memory);
  const motor = createEpisodeMotor({
    steps: fixture.steps,
    checkpointAdapter: adapter,
    budget,
    now: clock,
  });
  const result = await motor.start(runInput);
  if (result.status !== "completed") {
    throw new Error("el episodio debia completar el flujo feliz");
  }
  return { runtime: result.runtime, saves: history.saves };
}

/** Reloj incremental con raiz reproducible: la ISO n-esima depende solo de n. */
function tickingClockAt(record: number[]): () => Date {
  let tick = 0;
  return () => {
    const n = tick++;
    record.push(n);
    return new Date(Date.UTC(2026, 10, 10, 9, 0, n));
  };
}

describe("determinismo del motor", () => {
  it("dos ejecuciones con reloj fijo producen runtime y checkpoints identicos", async () => {
    const first = await runFullEpisode(constantClock());
    const second = await runFullEpisode(constantClock());
    expect(first.runtime).toEqual(second.runtime);
    expect(first.saves).toEqual(second.saves);
  });

  it("dos ejecuciones con relojes incrementales independientes producen eventos identicos", async () => {
    const ticksA: number[] = [];
    const ticksB: number[] = [];
    const first = await runFullEpisode(tickingClockAt(ticksA));
    const second = await runFullEpisode(tickingClockAt(ticksB));
    expect(first.runtime.events).toEqual(second.runtime.events);
    expect(ticksA.length).toBeGreaterThan(8);
  });

  it("decideStepOutcome es puro: mismas entradas devuelven el mismo runtime y el mismo diagnostico", () => {
    const at = "2026-11-10T09:00:00.000Z";
    const initial: EpisodeRuntime = {
      episodeId: EPISODE_ID,
      issueId: "GEN-48",
      branch: "feat/GEN-48-motor-episodios",
      runState: "ready",
      attempt: 1,
      events: [],
      evidence: [],
      pausedReason: null,
      failure: null,
    };
    const chain = [
      { to: "preparing", reason: "PASO_READY_OK" },
      { to: "planning", reason: "PASO_PLANNING_OK" },
      { to: "implementing", reason: "PASO_PLANNING_OK" },
      { to: "verifying", reason: "PASO_VERIFICACION_OK" },
    ] as const;
    let base = initial;
    for (const step of chain) {
      const outcome: StepResult = {
        kind: "transition",
        to: step.to,
        reason: step.reason,
        evidence: [],
      };
      base = decideStepOutcome(base, outcome, budget, at);
    }
    const outcome: StepResult = {
      kind: "transition",
      to: "reviewing",
      reason: "PASO_VERIFICACION_OK",
      evidence: [],
    };
    const first = decideStepOutcome(base, outcome, budget, at);
    const second = decideStepOutcome(base, outcome, budget, at);
    expect(first).toEqual(second);

    const illegal: StepResult = {
      kind: "transition",
      to: "prReady",
      reason: "salto",
      evidence: [],
    };
    expect(() => decideStepOutcome(base, illegal, budget, at)).toThrow(IllegalTransitionError);
  });
});
