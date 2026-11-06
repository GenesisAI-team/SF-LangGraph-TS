import type { RunState } from "@sf/contracts";

const transitionTableRaw: Record<RunState, readonly RunState[]> = {
  ready: ["preparing", "blocked"],
  preparing: ["planning", "blocked"],
  planning: ["implementing", "blocked"],
  implementing: ["verifying", "blocked"],
  verifying: ["reviewing", "repairing", "blocked"],
  repairing: ["verifying", "blocked"],
  reviewing: ["prReady", "repairing", "blocked"],
  prReady: ["awaitingMerge", "blocked"],
  awaitingMerge: ["done", "blocked"],
  done: [],
  blocked: [],
};

const transitionTable = Object.fromEntries(
  (Object.keys(transitionTableRaw) as RunState[]).map((state) => [
    state,
    Object.freeze([...transitionTableRaw[state]]),
  ]),
) as Readonly<Record<RunState, readonly RunState[]>>;

export function successors(from: RunState): readonly RunState[] {
  return transitionTable[from];
}

export function canTransition(from: RunState, to: RunState): boolean {
  return successors(from).includes(to);
}

export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `ILEGAL_TRANSITION: no se permite pasar de ${from} a ${to}; sucesores legales: ${successors(from).join(", ") || "(ninguno)"}`,
    );
  }
}
