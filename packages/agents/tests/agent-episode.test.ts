import { describe, expect, it } from "vitest";
import { createEpisodeMotor, createInMemoryCheckpointAdapter } from "@sf/engine";
import type { EpisodeStepContext } from "@sf/engine";
import type { RunState } from "@sf/contracts";

import {
  createAgentManager,
  createRoleStepHandlers,
  createScriptedAgentAdapter,
} from "../src/index.js";
import type { ScriptedAgentAdapterOptions } from "../src/index.js";
import {
  baseBudget,
  constantClock,
  EPISODE_ID,
  evidence,
  fullSteps,
  contradictoryVerifyOutput,
  invalidPlanOutput,
  invalidVerifyOutput,
  reviewApprovedOutput,
  reviewChangesOutput,
  validImplementOutput,
  validPlanOutput,
  validRepairOutput,
  verifyFailedOutput,
  verifyPassedOutput,
} from "./helpers.js";

const runInput = {
  episodeId: EPISODE_ID,
  issueId: "GEN-53",
  branch: "feat/GEN-53-agent-manager-roles",
} as const;

const happyEvents = [
  "ready->preparing",
  "preparing->planning",
  "planning->implementing",
  "implementing->verifying",
  "verifying->reviewing",
  "reviewing->prReady",
  "prReady->awaitingMerge",
  "awaitingMerge->done",
] as const;

function buildMotor(scripts: ScriptedAgentAdapterOptions, budget = baseBudget) {
  const adapter = createScriptedAgentAdapter(scripts);
  const manager = createAgentManager({ adapter, budget });
  const counters = new Map<RunState, number>();
  const steps = fullSteps(createRoleStepHandlers({ manager }), counters);
  const motor = createEpisodeMotor({
    steps,
    checkpointAdapter: createInMemoryCheckpointAdapter(),
    budget,
    now: constantClock(),
  });
  return { motor, adapter, counters };
}

describe("integracion de roles con episodios", () => {
  it("recorre el episodio completo con los roles validados y termina en done", async () => {
    const { motor, adapter, counters } = buildMotor({
      scripts: {
        plan: [validPlanOutput],
        implement: [validImplementOutput],
        verify: [verifyPassedOutput],
        review: [reviewApprovedOutput],
      },
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    expect(result.runtime.runState).toBe("done");
    expect(result.runtime.attempt).toBe(1);
    expect(result.runtime.failure).toBeNull();
    expect(result.runtime.pausedReason).toBeNull();
    expect(result.runtime.events.map((event) => `${event.from}->${event.to}`)).toEqual(happyEvents);
    expect(result.runtime.evidence).toContainEqual(evidence("plan-borrador", "2 pasos definidos"));
    expect(result.runtime.evidence).toContainEqual({
      name: "pnpm-verify",
      status: "passed",
      detail: "format, lint, typecheck, test y build en verde",
    });
    for (const role of ["plan", "implement", "verify", "review"] as const) {
      expect(adapter.invocationsFor(role)).toBe(1);
    }
    expect(adapter.invocationsFor("repair")).toBe(0);
    for (const state of ["ready", "preparing", "prReady", "awaitingMerge"] as const) {
      expect(counters.get(state)).toBe(1);
    }
  });

  it("reintenta una salida malformada dentro del paso sin duplicar eventos ni evidencia", async () => {
    const { motor, adapter } = buildMotor({
      scripts: {
        plan: [invalidPlanOutput, validPlanOutput],
        implement: [validImplementOutput],
        verify: [verifyPassedOutput],
        review: [reviewApprovedOutput],
      },
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    expect(result.runtime.attempt).toBe(1);
    expect(
      result.runtime.events.filter(
        (event) => event.from === "planning" && event.to === "implementing",
      ),
    ).toHaveLength(1);
    expect(
      result.runtime.evidence.filter((entry) => entry.name === "agent-plan-invalid-output"),
    ).toHaveLength(1);
    expect(result.runtime.evidence).toContainEqual(evidence("plan-borrador", "2 pasos definidos"));
    expect(adapter.invocationsFor("plan")).toBe(2);
  });

  it("el presupuesto del gestor agotado detiene el episodio en blocked con evidencia", async () => {
    const { motor, adapter } = buildMotor(
      {
        scripts: {
          plan: [validPlanOutput],
          implement: [validImplementOutput],
          verify: [invalidVerifyOutput],
        },
      },
      { ...baseBudget, maxAttempts: 2 },
    );

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    expect(result.runtime.runState).toBe("blocked");
    expect(result.runtime.attempt).toBe(1);
    expect(result.runtime.failure?.code).toBe("DEFINITIVO");
    expect(result.runtime.events.map((event) => `${event.from}->${event.to}`)).toEqual([
      "ready->preparing",
      "preparing->planning",
      "planning->implementing",
      "implementing->verifying",
      "verifying->blocked",
    ]);
    expect(
      result.runtime.evidence.filter((entry) => entry.name === "agent-verify-invalid-output"),
    ).toHaveLength(2);
    expect(adapter.invocationsFor("verify")).toBe(2);
    expect(adapter.invocationsFor("repair")).toBe(0);
  });

  it("la verificacion fallida repetida agota el presupuesto del episodio con BUDGET_AGOTADO", async () => {
    const { motor, adapter } = buildMotor(
      {
        scripts: {
          plan: [validPlanOutput],
          implement: [validImplementOutput],
          verify: [verifyFailedOutput],
          review: [reviewApprovedOutput],
          repair: [validRepairOutput],
        },
      },
      { ...baseBudget, maxAttempts: 2 },
    );

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    expect(result.runtime.runState).toBe("blocked");
    expect(result.runtime.attempt).toBe(2);
    expect(result.runtime.failure?.code).toBe("BUDGET_AGOTADO");
    expect(
      result.runtime.evidence.filter(
        (entry) => entry.name === "pnpm-verify" && entry.status === "failed",
      ),
    ).toHaveLength(2);
    expect(result.runtime.evidence).toContainEqual(evidence("repair-parche", "1 fix aplicado"));
    expect(adapter.invocationsFor("verify")).toBe(2);
    expect(adapter.invocationsFor("repair")).toBe(1);
    expect(adapter.invocationsFor("review")).toBe(0);
  });

  it("reintenta una salida contradictoria y avanza cuando el adaptador la corrige", async () => {
    const { motor, adapter } = buildMotor({
      scripts: {
        plan: [validPlanOutput],
        implement: [validImplementOutput],
        verify: [contradictoryVerifyOutput, verifyPassedOutput],
        review: [reviewApprovedOutput],
      },
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    expect(result.runtime.runState).toBe("done");
    expect(
      result.runtime.events.filter(
        (event) => event.from === "verifying" && event.to === "reviewing",
      ),
    ).toHaveLength(1);
    expect(
      result.runtime.evidence.filter((entry) => entry.name === "agent-verify-invalid-output"),
    ).toHaveLength(1);
    expect(adapter.invocationsFor("verify")).toBe(2);
    expect(adapter.invocationsFor("review")).toBe(1);
  });

  it("un veredicto passed con checks fallidos es salida invalida y bloquea sin pasar a reviewing", async () => {
    const { motor, adapter } = buildMotor(
      {
        scripts: {
          plan: [validPlanOutput],
          implement: [validImplementOutput],
          verify: [contradictoryVerifyOutput],
        },
      },
      { ...baseBudget, maxAttempts: 2 },
    );

    const result = await motor.start(runInput);

    expect(result.status).toBe("blocked");
    expect(result.runtime.runState).toBe("blocked");
    expect(result.runtime.failure?.code).toBe("DEFINITIVO");
    expect(result.runtime.attempt).toBe(1);
    expect(result.runtime.events.map((event) => `${event.from}->${event.to}`)).not.toContain(
      "verifying->reviewing",
    );
    expect(
      result.runtime.evidence.filter((entry) => entry.name === "agent-verify-invalid-output"),
    ).toHaveLength(2);
    expect(adapter.invocationsFor("verify")).toBe(2);
    expect(adapter.invocationsFor("review")).toBe(0);
    expect(adapter.invocationsFor("repair")).toBe(0);
  });

  it("un review con cambios solicitados dispara reparacion y el episodio termina en done", async () => {
    const { motor, adapter } = buildMotor({
      scripts: {
        plan: [validPlanOutput],
        implement: [validImplementOutput],
        verify: [verifyPassedOutput],
        review: [reviewChangesOutput, reviewApprovedOutput],
        repair: [validRepairOutput],
      },
    });

    const result = await motor.start(runInput);

    expect(result.status).toBe("completed");
    expect(result.runtime.runState).toBe("done");
    expect(result.runtime.attempt).toBe(2);
    const events = result.runtime.events.map((event) => `${event.from}->${event.to}`);
    expect(events).toContain("reviewing->repairing");
    expect(events).toContain("repairing->verifying");
    expect(events).toHaveLength(11);
    expect(adapter.invocationsFor("review")).toBe(2);
    expect(adapter.invocationsFor("repair")).toBe(1);
    expect(adapter.invocationsFor("verify")).toBe(2);
  });

  it("dos episodios identicos producen runtimes identicos", async () => {
    const scripts = {
      scripts: {
        plan: [validPlanOutput],
        implement: [validImplementOutput],
        verify: [verifyPassedOutput],
        review: [reviewApprovedOutput],
      },
    } as const;
    const first = buildMotor(scripts);
    const second = buildMotor(scripts);

    const runA = await first.motor.start(runInput);
    const runB = await second.motor.start(runInput);

    expect(JSON.stringify(runA.runtime)).toBe(JSON.stringify(runB.runtime));
  });

  it("acota el reason del paso al limite de transitionEventSchema", async () => {
    const adapter = createScriptedAgentAdapter({
      scripts: { plan: [{ ...validPlanOutput, summary: "x".repeat(490) }] },
    });
    const manager = createAgentManager({ adapter, budget: baseBudget });
    const handlers = createRoleStepHandlers({ manager });
    const planning = handlers.planning;
    if (planning === undefined) {
      throw new Error("INVARIANT_TEST: el handler de planning deberia existir");
    }
    const context = {
      runtime: {
        episodeId: EPISODE_ID,
        issueId: "GEN-53",
        branch: "feat/GEN-53-agent-manager-roles",
        attempt: 1,
      },
      state: "planning",
    } as unknown as EpisodeStepContext;

    const result = await planning(context);

    if (result.kind !== "transition") {
      throw new Error("INVARIANT_TEST: el paso deberia transicionar a implementing");
    }
    expect(result.to).toBe("implementing");
    expect(result.reason).toHaveLength(500);
    expect(result.reason.startsWith("ROL_PLAN_OK: ")).toBe(true);
  });

  it("mapea el error de peticion malformada a un fallo definitivo con evidencia", async () => {
    const adapter = createScriptedAgentAdapter({ scripts: { plan: [validPlanOutput] } });
    const manager = createAgentManager({ adapter, budget: baseBudget });
    const handlers = createRoleStepHandlers({ manager });
    const planning = handlers.planning;
    if (planning === undefined) {
      throw new Error("INVARIANT_TEST: el handler de planning deberia existir");
    }
    const context = {
      runtime: { episodeId: EPISODE_ID, issueId: "GEN-53", branch: "rama-invalida", attempt: 1 },
      state: "planning",
    } as unknown as EpisodeStepContext;

    const result = await planning(context);

    if (result.kind !== "failure") {
      throw new Error("INVARIANT_TEST: el paso deberia fallar con AGENTE_ENTRADA_INVALIDA");
    }
    expect(result.repair).toBe(false);
    expect(result.reason).toMatch(/^AGENTE_ENTRADA_INVALIDA:/);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.name).toBe("agent-plan-invalid-request");
    expect(result.evidence[0]?.status).toBe("failed");
    expect(result.evidence[0]?.detail).toMatch(/^AGENTE_ENTRADA_INVALIDA:/);
  });

  it("mapea un fallo inesperado del adaptador a un fallo reparable con evidencia", async () => {
    const adapter = createScriptedAgentAdapter({});
    const manager = createAgentManager({ adapter, budget: baseBudget });
    const handlers = createRoleStepHandlers({ manager });
    const planning = handlers.planning;
    if (planning === undefined) {
      throw new Error("INVARIANT_TEST: el handler de planning deberia existir");
    }
    const context = {
      runtime: {
        episodeId: EPISODE_ID,
        issueId: "GEN-53",
        branch: "feat/GEN-53-agent-manager-roles",
        attempt: 1,
      },
      state: "planning",
    } as unknown as EpisodeStepContext;

    const result = await planning(context);

    if (result.kind !== "failure") {
      throw new Error("INVARIANT_TEST: el paso deberia fallar con AGENTE_ERROR");
    }
    expect(result.repair).toBe(true);
    expect(result.reason).toMatch(/^AGENTE_ERROR:/);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.name).toBe("agent-plan-crash");
    expect(result.evidence[0]?.status).toBe("failed");
    expect(result.evidence[0]?.detail).toMatch(/SALIDA_NO_PROGRAMADA/);
  });
});
