import { describe, expect, it } from "vitest";

import {
  createEpisodeMotor,
  createInMemoryCheckpointAdapter,
  InvalidEpisodeInputError,
  MissingStepHandlerError,
  NoCheckpointError,
} from "../src/index.js";
import {
  advanceHandlers,
  baseBudget,
  constantClock,
  EPISODE_ID,
  recordingAdapter,
  runInput,
  tickingClock,
} from "./helpers.js";

const happyPath = [
  "ready->preparing",
  "preparing->planning",
  "planning->implementing",
  "implementing->verifying",
  "verifying->reviewing",
  "reviewing->prReady",
  "prReady->awaitingMerge",
  "awaitingMerge->done",
] as const;

describe("flujo feliz del motor de episodios", () => {
  it("ejecuta las transiciones legales, guarda checkpoint tras cada paso y termina en done", async () => {
    const { steps, counters } = advanceHandlers({
      evidence: {
        implementing: [{ name: "commit-diff", status: "passed", detail: "10 archivos tocados" }],
      },
    });
    const memory = createInMemoryCheckpointAdapter();
    const { adapter, history } = recordingAdapter(memory);
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: adapter,
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    const runtime = result.runtime;
    expect(runtime.runState).toBe("done");
    expect(runtime.attempt).toBe(1);
    expect(runtime.failure).toBeNull();
    expect(runtime.pausedReason).toBeNull();
    expect(runtime.episodeId).toBe(EPISODE_ID);
    expect(runtime.issueId).toBe("GEN-48");
    expect(runtime.branch).toBe("feat/GEN-48-motor-episodios");

    expect(runtime.events.map((event) => `${event.from}->${event.to}`)).toEqual(happyPath);
    for (const event of runtime.events) {
      expect(event.issueId).toBe("GEN-48");
      expect(event.reason.length).toBeGreaterThan(0);
      expect(event.at.startsWith("2026-11-10T09:00:00")).toBe(true);
    }

    expect(runtime.evidence).toContainEqual({
      name: "commit-diff",
      status: "passed",
      detail: "10 archivos tocados",
    });

    for (const state of [
      "ready",
      "preparing",
      "planning",
      "implementing",
      "verifying",
      "reviewing",
      "prReady",
      "awaitingMerge",
    ] as const) {
      expect(counters.get(state)).toBe(1);
    }

    expect(history.saves.length).toBe(9);
    expect(history.saves[0]?.runtime.runState).toBe("ready");
    expect(history.saves[0]?.runtime.events).toHaveLength(0);
    expect(history.saves[history.saves.length - 1]?.runtime.runState).toBe("done");
    expect((await adapter.load(EPISODE_ID))?.runtime.runState).toBe("done");
  });

  it("con un reloj incremental los timestamps de los eventos avanzan", async () => {
    const { steps } = advanceHandlers();
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: tickingClock(),
    });

    const result = await motor.start(runInput);
    const ats = result.runtime.events.map((event) => event.at);
    expect(ats).toHaveLength(8);
    expect(new Set(ats).size).toBe(8);
    const sorted = [...ats].sort();
    expect(ats).toEqual(sorted);
    for (const at of ats) {
      expect(at.startsWith("2026-11-10T09:00:")).toBe(true);
    }
  });

  it("rechaza el input del episodio con diagnostico tipado y sin guardar checkpoint", async () => {
    const motor = createEpisodeMotor({
      steps: advanceHandlers().steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });

    const byIssueId = { ...runInput, issueId: "TICKET-1" };
    await expect(motor.start(byIssueId)).rejects.toBeInstanceOf(InvalidEpisodeInputError);
    const byIds = { ...runInput, episodeId: "no-uuid" };
    await expect(motor.start(byIds)).rejects.toThrow(/INVALID_EPISODE_INPUT/);
  });

  it("detecta un paso sin handler configurado y no avanza el runtime", async () => {
    const { steps } = advanceHandlers();
    const withoutPlanning = { ...steps };
    delete withoutPlanning.planning;
    const memory = createInMemoryCheckpointAdapter();
    const motor = createEpisodeMotor({
      steps: withoutPlanning,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });

    const error = await motor.start(runInput).then(
      () => {
        throw new Error("deberia haber fallado");
      },
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(MissingStepHandlerError);
    if (error instanceof MissingStepHandlerError) {
      expect(error.state).toBe("planning");
      expect(error.episodeId).toBe(EPISODE_ID);
    }
    expect((await memory.load(EPISODE_ID))?.runtime.runState).toBe("planning");
  });

  it("resume de un episodio desconocido lanza NoCheckpointError", async () => {
    const motor = createEpisodeMotor({
      steps: advanceHandlers().steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });
    await expect(motor.resume(EPISODE_ID)).rejects.toBeInstanceOf(NoCheckpointError);
  });
});
