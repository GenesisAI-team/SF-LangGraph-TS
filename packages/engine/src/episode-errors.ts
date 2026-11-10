import type { RunState } from "@sf/contracts";

export class EpisodeEngineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidEpisodeInputError extends EpisodeEngineError {
  constructor(input: unknown, issues: string) {
    super(
      `INVALID_EPISODE_INPUT: el input del episodio no cumple episodeRunInputSchema: ${issues}; input=${describeJson(input)}`,
    );
  }
}

export class InvalidStepResultError extends EpisodeEngineError {
  constructor(state: RunState, episodeId: string, issues: string) {
    super(
      `INVALID_STEP_RESULT: la salida del paso "${state}" del episodio ${episodeId} no cumple stepResultSchema: ${issues}`,
    );
  }
}

export class IllegalTransitionError extends EpisodeEngineError {
  readonly episodeId: string;
  readonly from: RunState;
  readonly to: RunState;
  readonly legal: readonly RunState[];

  constructor(params: {
    episodeId: string;
    from: RunState;
    to: RunState;
    legal: readonly RunState[];
  }) {
    super(
      `ILEGAL_TRANSITION: no se permite pasar de ${params.from} a ${params.to} en el episodio ${params.episodeId}; sucesores legales: ${params.legal.join(", ") || "(ninguno)"}`,
    );
    this.episodeId = params.episodeId;
    this.from = params.from;
    this.to = params.to;
    this.legal = params.legal;
  }
}

export class DuplicateEpisodeError extends EpisodeEngineError {
  readonly episodeId: string;
  readonly existingRunState: RunState;

  constructor(params: { episodeId: string; existingRunState: RunState }) {
    super(
      `DUPLICATE_EPISODE: el episodio ${params.episodeId} ya tiene un checkpoint en estado ${params.existingRunState}; use resume() en lugar de start() para reintentos duplicados`,
    );
    this.episodeId = params.episodeId;
    this.existingRunState = params.existingRunState;
  }
}

export class NoCheckpointError extends EpisodeEngineError {
  readonly episodeId: string;

  constructor(episodeId: string) {
    super(`NO_CHECKPOINT: no existe checkpoint para el episodio ${episodeId}`);
    this.episodeId = episodeId;
  }
}

export class InvalidCheckpointError extends EpisodeEngineError {
  readonly episodeId: string;

  constructor(episodeId: string, issues: string) {
    super(`INVALID_CHECKPOINT: el checkpoint del episodio ${episodeId} es ilegible: ${issues}`);
    this.episodeId = episodeId;
  }
}

export class MissingStepHandlerError extends EpisodeEngineError {
  readonly state: RunState;
  readonly episodeId: string;

  constructor(params: { state: RunState; episodeId: string }) {
    super(
      `MISSING_STEP_HANDLER: el episodio ${params.episodeId} requiring paso para "${params.state}" y la configuracion no define un handler para ese estado`,
    );
    this.state = params.state;
    this.episodeId = params.episodeId;
  }
}

function describeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
