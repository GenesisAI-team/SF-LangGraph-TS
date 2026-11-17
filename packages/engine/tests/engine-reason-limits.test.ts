import { describe, expect, it } from "vitest";

import { transitionEventSchema } from "@sf/contracts";

import { createEpisodeMotor } from "../src/index.js";
import {
  advanceHandlers,
  baseBudget,
  constantClock,
  createInMemoryCheckpointAdapter,
  runInput,
} from "./helpers.js";

/** Reason de paso en el limite exacto aceptado por stepResultSchema. */
const MAX_REASON = "x".repeat(500);

/** Todo evento que el motor persiste debe cumplir transitionEventSchema. */
function expectEventsWithinLimit(
  events: readonly { from: string; to: string; reason: string; at: string; issueId: string }[],
): void {
  for (const event of events) {
    expect(event.reason.length).toBeLessThanOrEqual(500);
    expect(transitionEventSchema.safeParse(event).success).toBe(true);
  }
}

describe("limites de reason en eventos prefijados por el motor", () => {
  it("acota el motivo con prefijo PASO_FALLIDO_REPARABLE para que el checkpoint sea persistible", async () => {
    let verifyingCalls = 0;
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => {
          verifyingCalls += 1;
          return verifyingCalls === 1
            ? { kind: "failure", reason: MAX_REASON, repair: true, evidence: [] }
            : { kind: "transition", to: "reviewing", reason: "qa_en_verde", evidence: [] };
        },
      },
    });
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    const repairEvent = result.runtime.events.find((event) =>
      event.reason.startsWith("PASO_FALLIDO_REPARABLE"),
    );
    expect(repairEvent).toBeDefined();
    expect(repairEvent?.reason.length).toBe(500);
    expectEventsWithinLimit(result.runtime.events);
  });

  it("acota el motivo con prefijo PASO_FALLIDO_DEFINITIVO sin perder el mensaje crudo del fallo", async () => {
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => ({
          kind: "failure",
          reason: MAX_REASON,
          repair: false,
          evidence: [],
        }),
      },
    });
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    const blockedEvent = result.runtime.events[result.runtime.events.length - 1];
    expect(blockedEvent?.to).toBe("blocked");
    expect(blockedEvent?.reason.startsWith("PASO_FALLIDO_DEFINITIVO")).toBe(true);
    expect(blockedEvent?.reason.length).toBe(500);
    expect(result.runtime.failure?.code).toBe("DEFINITIVO");
    expect(result.runtime.failure?.message).toBe(MAX_REASON);
    expectEventsWithinLimit(result.runtime.events);
  });

  it("acota el motivo con prefijo PRESUPUESTO_AGOTADO al agotar reintentos con fallo reparable", async () => {
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => ({
          kind: "failure",
          reason: MAX_REASON,
          repair: true,
          evidence: [],
        }),
      },
    });
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    expect(result.runtime.attempt).toBe(baseBudget.maxAttempts);
    const budgetEvent = result.runtime.events[result.runtime.events.length - 1];
    expect(budgetEvent?.to).toBe("blocked");
    expect(budgetEvent?.reason.startsWith("PRESUPUESTO_AGOTADO")).toBe(true);
    expect(budgetEvent?.reason.length).toBe(500);
    expect(result.runtime.failure?.code).toBe("BUDGET_AGOTADO");
    expect(result.runtime.failure?.message).toBe(MAX_REASON);
    expectEventsWithinLimit(result.runtime.events);
  });

  it("acota PRESUPUESTO_AGOTADO cuando el propio paso pide repairing con el budget agotado", async () => {
    let verifyingCalls = 0;
    const { steps } = advanceHandlers({
      overrides: {
        verifying: () => {
          verifyingCalls += 1;
          if (verifyingCalls < baseBudget.maxAttempts) {
            return { kind: "failure", reason: "fallo_reparable", repair: true, evidence: [] };
          }
          return { kind: "transition", to: "repairing", reason: MAX_REASON, evidence: [] };
        },
      },
    });
    const motor = createEpisodeMotor({
      steps,
      checkpointAdapter: createInMemoryCheckpointAdapter(),
      budget: baseBudget,
      now: constantClock(),
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    const budgetEvent = result.runtime.events[result.runtime.events.length - 1];
    expect(budgetEvent?.to).toBe("blocked");
    expect(budgetEvent?.reason.startsWith("PRESUPUESTO_AGOTADO")).toBe(true);
    expect(budgetEvent?.reason.length).toBe(500);
    expect(result.runtime.failure?.code).toBe("BUDGET_AGOTADO");
    expect(result.runtime.failure?.message).toBe(MAX_REASON);
    expectEventsWithinLimit(result.runtime.events);
  });
});
