import { describe, expect, it } from "vitest";

import {
  AgentBudgetExhaustedError,
  createAgentManager,
  createScriptedAgentAdapter,
  InvalidAgentRequestError,
  NoScriptedOutputError,
} from "../src/index.js";
import type { AgentRequest } from "../src/index.js";
import { invalidPlanOutput, validPlanOutput, baseBudget, requestFor } from "./helpers.js";

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => {
      throw new Error(`deberia haber fallado: ${JSON.stringify(value)}`);
    },
    (cause: unknown) => cause,
  );
}

describe("AgentManager con presupuesto de intentos", () => {
  it("devuelve la salida validada al primer intento", async () => {
    const adapter = createScriptedAgentAdapter({ scripts: { plan: [validPlanOutput] } });
    const manager = createAgentManager({ adapter, budget: baseBudget });

    const invocation = await manager.invoke(requestFor("plan"));

    expect(invocation.attempts).toBe(1);
    expect(invocation.output).toEqual(validPlanOutput);
    expect(invocation.evidence).toEqual([]);
    expect(adapter.invocationsFor("plan")).toBe(1);
  });

  it("reintenta de forma determinista hasta una salida valida", async () => {
    const invalidWithoutDetail = {
      role: "plan",
      summary: "paso sin detalle",
      plan: [{ title: "titulo", detail: "" }],
    };
    const adapter = createScriptedAgentAdapter({
      scripts: { plan: [invalidPlanOutput, invalidWithoutDetail, validPlanOutput] },
    });
    const manager = createAgentManager({ adapter, budget: baseBudget });

    const invocation = await manager.invoke(requestFor("plan"));

    expect(invocation.attempts).toBe(3);
    expect(invocation.output).toEqual(validPlanOutput);
    expect(adapter.invocationsFor("plan")).toBe(3);
    expect(invocation.evidence).toHaveLength(2);
    expect(invocation.evidence.every((entry) => entry.name === "agent-plan-invalid-output")).toBe(
      true,
    );
    expect(new Set(invocation.evidence.map((entry) => entry.detail)).size).toBe(
      invocation.evidence.length,
    );
  });

  it("agotado el presupuesto lanza un error tipado con evidencia por intento", async () => {
    const adapter = createScriptedAgentAdapter({
      scripts: { plan: [invalidPlanOutput] },
    });
    const manager = createAgentManager({ adapter, budget: { ...baseBudget, maxAttempts: 2 } });

    const error = await captureRejection(manager.invoke(requestFor("plan")));

    expect(error).toBeInstanceOf(AgentBudgetExhaustedError);
    if (error instanceof AgentBudgetExhaustedError) {
      expect(error.role).toBe("plan");
      expect(error.attempts).toBe(2);
      expect(error.evidence).toHaveLength(2);
      expect(error.evidence[0]?.name).toBe("agent-plan-invalid-output");
      expect(error.evidence[0]?.status).toBe("failed");
    }
    expect(adapter.invocationsFor("plan")).toBe(2);
  });

  it("respeta un presupuesto de un solo intento", async () => {
    const adapter = createScriptedAgentAdapter({
      scripts: { plan: [invalidPlanOutput, validPlanOutput] },
    });
    const manager = createAgentManager({ adapter, budget: { ...baseBudget, maxAttempts: 1 } });

    const error = await captureRejection(manager.invoke(requestFor("plan")));

    expect(error).toBeInstanceOf(AgentBudgetExhaustedError);
    expect(adapter.invocationsFor("plan")).toBe(1);
  });

  it("rechaza la peticion malformada sin invocar al adaptador", async () => {
    const adapter = createScriptedAgentAdapter({ scripts: { plan: [validPlanOutput] } });
    const manager = createAgentManager({ adapter, budget: baseBudget });

    const badRole = { ...requestFor("plan"), role: "architect" } as unknown as AgentRequest;
    const error = await captureRejection(manager.invoke(badRole));

    expect(error).toBeInstanceOf(InvalidAgentRequestError);
    expect(adapter.invocationsFor("plan")).toBe(0);

    const badIssue = { ...requestFor("plan"), issueId: "TICKET-1" };
    await expect(manager.invoke(badIssue)).rejects.toBeInstanceOf(InvalidAgentRequestError);

    const badAttempt = { ...requestFor("plan"), attempt: 0 };
    await expect(manager.invoke(badAttempt)).rejects.toBeInstanceOf(InvalidAgentRequestError);

    const badBranch = { ...requestFor("plan"), branch: "rama-invalida" };
    await expect(manager.invoke(badBranch)).rejects.toBeInstanceOf(InvalidAgentRequestError);

    const badEpisode = { ...requestFor("plan"), episodeId: "no-uuid" };
    await expect(manager.invoke(badEpisode)).rejects.toBeInstanceOf(InvalidAgentRequestError);

    const extraField = { ...requestFor("plan"), extra: true };
    await expect(manager.invoke(extraField)).rejects.toBeInstanceOf(InvalidAgentRequestError);

    expect(adapter.invocationsFor("plan")).toBe(0);
  });

  it("dos gestores identicos producen resultados identicos", async () => {
    const scripts = { plan: [invalidPlanOutput, validPlanOutput] } as const;
    const first = createAgentManager({
      adapter: createScriptedAgentAdapter({ scripts }),
      budget: baseBudget,
    });
    const second = createAgentManager({
      adapter: createScriptedAgentAdapter({ scripts }),
      budget: baseBudget,
    });

    const firstInvocation = await first.invoke(requestFor("plan"));
    const secondInvocation = await second.invoke(requestFor("plan"));

    expect(JSON.stringify(firstInvocation)).toBe(JSON.stringify(secondInvocation));
  });

  it("el adaptador simulado repite su ultima salida al agotar el guion", async () => {
    const adapter = createScriptedAgentAdapter({
      scripts: { plan: [invalidPlanOutput, validPlanOutput] },
    });
    const manager = createAgentManager({ adapter, budget: baseBudget });

    const first = await manager.invoke(requestFor("plan"));
    const second = await manager.invoke(requestFor("plan"));

    expect(first.attempts).toBe(2);
    expect(second.attempts).toBe(1);
    expect(second.output).toEqual(validPlanOutput);
    expect(adapter.invocationsFor("plan")).toBe(3);
  });

  it("un guion vacio lanza un error tipado determinista", async () => {
    const adapter = createScriptedAgentAdapter({ scripts: { plan: [] } });
    const manager = createAgentManager({ adapter, budget: baseBudget });

    await expect(manager.invoke(requestFor("plan"))).rejects.toBeInstanceOf(NoScriptedOutputError);
  });
});
