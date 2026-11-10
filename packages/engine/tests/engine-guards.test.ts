import { describe, expect, it } from "vitest";

import {
  createEpisodeMotor,
  createInMemoryCheckpointAdapter,
  DuplicateEpisodeError,
  IllegalTransitionError,
  InvalidCheckpointError,
  InvalidStepResultError,
} from "../src/index.js";
import type { EpisodeCheckpointAdapter, EpisodeRuntime, StepResult } from "../src/index.js";
import {
  advanceHandlers,
  baseBudget,
  constantClock,
  EPISODE_ID,
  recordingAdapter,
  runInput,
} from "./helpers.js";

const fullBudgetConfig = (adapter = createInMemoryCheckpointAdapter()) =>
  ({
    checkpointAdapter: adapter,
    budget: baseBudget,
    now: constantClock(),
  }) as const;

describe("guardrails del motor", () => {
  it("rechaza una transicion ilegal pedida por el paso y deja el checkpoint en el estado legal previo", async () => {
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => ({
          kind: "transition",
          to: "prReady",
          reason: "salto ilegal pedido",
          evidence: [],
        }),
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

    const error = await motor.start(runInput).then(
      () => {
        throw new Error("deberia haber fallado");
      },
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(IllegalTransitionError);
    if (error instanceof IllegalTransitionError) {
      expect(error.episodeId).toBe(EPISODE_ID);
      expect(error.from).toBe("verifying");
      expect(error.to).toBe("prReady");
      expect(error.legal).toContain("reviewing");
      expect(error.legal).toContain("blocked");
    }
    const last = await adapter.load(EPISODE_ID);
    expect(last?.runtime.runState).toBe("verifying");
    expect(last?.runtime.events).toHaveLength(4);
    expect(history.saves).toHaveLength(5);
  });

  it("rechaza reintentos duplicados: start() sobre un episodio ya checkpointeado", async () => {
    const shared = createInMemoryCheckpointAdapter();
    const firstMotor = createEpisodeMotor({
      steps: advanceHandlers().steps,
      ...fullBudgetConfig(shared),
    });
    await firstMotor.start(runInput);

    const duplicateMotor = createEpisodeMotor({
      steps: advanceHandlers().steps,
      ...fullBudgetConfig(shared),
    });
    const error = await duplicateMotor.start(runInput).then(
      () => {
        throw new Error("deberia haber fallado");
      },
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(DuplicateEpisodeError);
    if (error instanceof DuplicateEpisodeError) {
      expect(error.episodeId).toBe(EPISODE_ID);
      expect(error.existingRunState).toBe("done");
    }
  });

  it("rechaza salidas de paso que no cumplen el esquema (fail-fast de guardrail)", async () => {
    const rogue = { kind: "zap", to: "reviewing" } as unknown as StepResult;
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => rogue,
      },
    });
    const motor = createEpisodeMotor({ steps, ...fullBudgetConfig() });

    const error = await motor.start(runInput).then(
      () => {
        throw new Error("deberia haber fallado");
      },
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(InvalidStepResultError);
    if (error instanceof InvalidStepResultError) {
      expect(error.message).toContain("INVALID_STEP_RESULT");
      expect(error.message).toContain("verifying");
    }
  });

  it("bloquea con debido diagnostico cuando el fallo no es reparable y registra evidencia", async () => {
    const { steps } = advanceHandlers({
      overrides: {
        preparing: () => ({
          kind: "failure",
          reason: "envelope incompleto",
          repair: false,
          evidence: [{ name: "preparing", status: "failed", detail: "sin branch" }],
        }),
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

    expect(result.status).toBe("blocked");
    const runtime = result.runtime;
    expect(runtime.runState).toBe("blocked");
    expect(runtime.failure?.code).toBe("DEFINITIVO");
    expect(runtime.failure?.message).toBe("envelope incompleto");
    const lastEvent = runtime.events[runtime.events.length - 1];
    expect(lastEvent?.from).toBe("preparing");
    expect(lastEvent?.to).toBe("blocked");
    expect(lastEvent?.reason).toContain("PASO_FALLIDO_DEFINITIVO");
    expect(runtime.evidence).toContainEqual({
      name: "preparing",
      status: "failed",
      detail: "sin branch",
    });
    expect(history.saves[history.saves.length - 1]?.runtime.runState).toBe("blocked");
  });

  it("un fallo en reinstalacion se encauza a repairing y el bucle respeta el budget (BUDGET_AGOTADO)", async () => {
    let verifyingCalls = 0;
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => {
          verifyingCalls += 1;
          return {
            kind: "failure",
            reason: `qa_roja_${verifyingCalls}`,
            repair: true,
            evidence: [],
          };
        },
        repairing: () => ({
          kind: "transition",
          to: "verifying",
          reason: "PASO_REPARACION_OK",
          evidence: [],
        }),
      },
    });
    const memory = createInMemoryCheckpointAdapter();
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: memory,
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    const runtime = result.runtime;
    expect(runtime.runState).toBe("blocked");
    expect(runtime.attempt).toBe(baseBudget.maxAttempts);
    expect(runtime.failure?.code).toBe("BUDGET_AGOTADO");
    expect(verifyingCalls).toBe(3);
    const reasons = runtime.events.map((event) => event.reason);
    expect(reasons.filter((reason) => reason.startsWith("PASO_FALLIDO_REPARABLE")).length).toBe(2);
    expect(reasons.filter((reason) => reason.startsWith("PRESUPUESTO_AGOTADO")).length).toBe(1);
    const lastEvent = runtime.events[runtime.events.length - 1];
    expect(lastEvent?.from).toBe("verifying");
    expect(lastEvent?.to).toBe("blocked");
  });

  it("resume sobre un checkpoint alterado se rechaza con diagnostico (cadena ilegal)", async () => {
    const healthy = createEpisodeMotor({
      steps: advanceHandlers().steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });
    await healthy.start(runInput);

    const corruptedRuntime: EpisodeRuntime = {
      episodeId: EPISODE_ID,
      issueId: "GEN-48",
      branch: "feat/GEN-48-motor-episodios",
      runState: "reviewing",
      attempt: 1,
      events: [],
      evidence: [],
      pausedReason: null,
      failure: null,
    };
    const corruptAdapter: EpisodeCheckpointAdapter = {
      load: (episodeId) =>
        episodeId === EPISODE_ID
          ? Promise.resolve({ runtime: corruptedRuntime, savedAt: "2026-11-10T09:00:00.000Z" })
          : Promise.resolve(null),
      save: (checkpoint) => {
        void checkpoint;
        return Promise.resolve();
      },
    };
    const suspicious = createEpisodeMotor({
      steps: advanceHandlers().steps,
      checkpointAdapter: corruptAdapter,
      budget: baseBudget,
      now: constantClock(),
    });

    const error = await suspicious.resume(EPISODE_ID).then(
      () => {
        throw new Error("deberia haber fallado");
      },
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(InvalidCheckpointError);
    if (error instanceof InvalidCheckpointError) {
      expect(error.message).toContain("RUNTIME_INCONSISTENTE");
      expect(error.episodeId).toBe(EPISODE_ID);
    }
  });
});
