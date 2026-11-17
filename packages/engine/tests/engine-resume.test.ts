import { describe, expect, it } from "vitest";

import { createEpisodeMotor, createInMemoryCheckpointAdapter } from "../src/index.js";
import {
  advanceHandlers,
  baseBudget,
  constantClock,
  EPISODE_ID,
  recordingAdapter,
  runInput,
  type StepCounters,
} from "./helpers.js";

async function startExpectingCrash(motor: ReturnType<typeof createEpisodeMotor>): Promise<void> {
  try {
    await motor.start(runInput);
  } catch (error) {
    if (error instanceof Error && error.message.includes("CRASH_SIMULADO")) {
      return;
    }
    throw error;
  }
  throw new Error("deberia haber fallado con CRASH_SIMULADO");
}

function assertCountersAfterResume(paused: StepCounters, resumed: StepCounters): void {
  expect(paused.get("verifying")).toBe(1);
  expect(paused.get("planning")).toBe(1);
  expect(paused.get("implementing")).toBe(1);
  expect(resumed.get("ready")).toBeUndefined();
  expect(resumed.get("preparing")).toBeUndefined();
  expect(resumed.get("planning")).toBeUndefined();
  expect(resumed.get("implementing")).toBeUndefined();
  expect(resumed.get("verifying")).toBe(1);
  expect(resumed.get("reviewing")).toBe(1);
  expect(resumed.get("prReady")).toBe(1);
  expect(resumed.get("awaitingMerge")).toBe(1);
}

function assertNoRepeatedTransitions(runtime: { events: { from: string; to: string }[] }): void {
  const pairs = runtime.events.map((event) => `${event.from}->${event.to}`);
  expect(pairs).toHaveLength(8);
  expect(new Set(pairs).size).toBe(8);
}

describe("checkpoints y reanudacion", () => {
  it("pausa guardando checkpoint, reanuda y no repite ningun paso ya finalizado", async () => {
    let verifyingCalls = 0;
    const paused = advanceHandlers({
      overrides: {
        verifying: () => {
          verifyingCalls += 1;
          if (verifyingCalls === 1) {
            return { kind: "pause", reason: "ESPERANDO_EVIDENCIAS_VERIFICACION" };
          }
          return {
            kind: "transition",
            to: "reviewing",
            reason: "PASO_VERIFICACION_OK",
            evidence: [],
          };
        },
      },
    });
    const memory = createInMemoryCheckpointAdapter();
    const { adapter, history } = recordingAdapter(memory);
    const firstSession = createEpisodeMotor({
      steps: paused.steps,
      checkpointAdapter: adapter,
      budget: baseBudget,
      now: constantClock(),
    });

    const pausedResult = await firstSession.start(runInput);
    expect(pausedResult.status).toBe("paused");
    expect(pausedResult.runtime.runState).toBe("verifying");
    expect(pausedResult.runtime.pausedReason).toBe("ESPERANDO_EVIDENCIAS_VERIFICACION");
    expect(pausedResult.runtime.failure).toBeNull();
    const pausedEvents = pausedResult.runtime.events;
    expect(pausedEvents).toHaveLength(4);
    expect(pausedEvents[pausedEvents.length - 1]).toMatchObject({
      from: "implementing",
      to: "verifying",
    });

    const stored = await adapter.load(EPISODE_ID);
    expect(stored?.runtime.pausedReason).toBe("ESPERANDO_EVIDENCIAS_VERIFICACION");

    const resumedFixture = advanceHandlers();
    const resumedSession = createEpisodeMotor({
      steps: resumedFixture.steps,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });

    const resumed = await resumedSession.resume(EPISODE_ID);
    expect(resumed.status).toBe("completed");
    expect(resumed.runtime.runState).toBe("done");
    expect(resumed.runtime.pausedReason).toBeNull();
    assertNoRepeatedTransitions(resumed.runtime);
    assertCountersAfterResume(paused.counters, resumedFixture.counters);

    const afterResume = await adapter.load(EPISODE_ID);
    expect(afterResume?.runtime.pausedReason).toBeNull();
    expect(afterResume?.runtime.runState).toBe("done");
    expect(history.saves).toHaveLength(6);
  });

  it("un paso en vuelo que truena se reanuda sin repetir ningun paso terminado", async () => {
    let verifyingCalls = 0;
    const crashing = advanceHandlers({
      overrides: {
        verifying: () => {
          verifyingCalls += 1;
          if (verifyingCalls === 1) {
            throw new Error("CRASH_SIMULADO en el paso en vuelo");
          }
          return {
            kind: "transition",
            to: "reviewing",
            reason: "PASO_VERIFICACION_OK",
            evidence: [],
          };
        },
      },
    });
    const memory = createInMemoryCheckpointAdapter();
    const firstSession = createEpisodeMotor({
      steps: crashing.steps,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });

    await startExpectingCrash(firstSession);
    const stored = await memory.load(EPISODE_ID);
    expect(stored?.runtime.runState).toBe("verifying");
    expect(stored?.runtime.events).toHaveLength(4);
    expect(verifyingCalls).toBe(1);

    const resumedFixture = advanceHandlers();
    const resumedSession = createEpisodeMotor({
      steps: resumedFixture.steps,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });

    const resumed = await resumedSession.resume(EPISODE_ID);
    expect(resumed.status).toBe("completed");
    expect(resumed.runtime.runState).toBe("done");
    assertNoRepeatedTransitions(resumed.runtime);

    expect(crashing.counters.get("ready")).toBe(1);
    expect(crashing.counters.get("planning")).toBe(1);
    expect(crashing.counters.get("implementing")).toBe(1);
    expect(resumedFixture.counters.get("ready")).toBeUndefined();
    expect(resumedFixture.counters.get("preparing")).toBeUndefined();
    expect(resumedFixture.counters.get("planning")).toBeUndefined();
    expect(resumedFixture.counters.get("implementing")).toBeUndefined();
    expect(resumedFixture.counters.get("verifying")).toBe(1);
    expect(resumedFixture.counters.get("reviewing")).toBe(1);
  });

  it("resume sobre un episodio terminado es idempotente y no vuelve a ejecutar pasos", async () => {
    const first = advanceHandlers();
    const memory = createInMemoryCheckpointAdapter();
    const motor = createEpisodeMotor({
      steps: first.steps,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });
    const completed = await motor.start(runInput);
    expect(completed.status).toBe("completed");

    const again = await motor.resume(EPISODE_ID);
    expect(again.status).toBe("completed");
    expect(again.runtime).toEqual(completed.runtime);
    for (const count of first.counters.values()) {
      expect(count).toBe(1);
    }
  });
});
