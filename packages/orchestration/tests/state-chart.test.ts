import { describe, expect, it } from "vitest";

import type { RunState } from "@sf/contracts";

import { assertTransition, canTransition, successors } from "../src/index.js";

const happyPathPairs: readonly (readonly [RunState, RunState])[] = [
  ["ready", "preparing"],
  ["preparing", "planning"],
  ["planning", "implementing"],
  ["implementing", "verifying"],
  ["verifying", "reviewing"],
  ["reviewing", "prReady"],
  ["prReady", "awaitingMerge"],
  ["awaitingMerge", "done"],
];

describe("state chart", () => {
  it("permite el camino feliz completo del workflow", () => {
    for (const [from, to] of happyPathPairs) {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("permite el bucle de reparacion con limite en la tabla", () => {
    expect(canTransition("verifying", "repairing")).toBe(true);
    expect(canTransition("repairing", "verifying")).toBe(true);
    expect(canTransition("reviewing", "repairing")).toBe(true);
  });

  it("prohibe saltos ilegales fuera de la tabla", () => {
    expect(canTransition("ready", "prReady")).toBe(false);
    expect(() => assertTransition("ready", "prReady")).toThrow(/ILEGAL_TRANSITION/);
  });

  it("bloquea desde cualquier estado no terminal", () => {
    const nonTerminal = happyPathPairs.map(([from]) => from);
    for (const state of nonTerminal) {
      expect(canTransition(state, "blocked")).toBe(true);
    }
  });

  it("done y blocked son terminales; de blocked solo sale el humano", () => {
    expect(successors("done")).toHaveLength(0);
    expect(successors("blocked")).toHaveLength(0);
    expect(canTransition("blocked", "ready")).toBe(false);
  });

  it("es puro e idempotente: dos consultas devuelven el mismo resultado", () => {
    const first = successors("verifying");
    const second = successors("verifying");
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
